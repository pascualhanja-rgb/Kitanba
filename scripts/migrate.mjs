#!/usr/bin/env node
/**
 * Aplica o schema base e as migrações SQL em produção.
 *
 * - Idempotente: cada ficheiro é registado em `schema_migrations` e só corre uma vez.
 * - Usa DATABASE_URL (Neon) quando definido; caso contrário DB_HOST/DB_*.
 * - Corre antes do deploy (Render `preDeployCommand`).
 *
 * Uso local:  npm run db:migrate
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Carrega .env local sem dependência extra (em produção as vars já existem).
async function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath) || process.env.DATABASE_URL) return;
  const content = await readFile(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
}

await loadEnv();

const connectionString = process.env.DATABASE_URL;
const host = process.env.DB_HOST || 'localhost';
const useSsl =
  process.env.DB_SSL === 'true' ||
  (!connectionString && host !== 'localhost' && host !== '127.0.0.1');

const client = new pg.Client(
  connectionString
    ? {
        connectionString,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      }
    : {
        host,
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE || 'kitanda',
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      },
);

const log = (msg) => console.log(`[migrate] ${msg}`);

async function runFile(name, sql) {
  const canUseTransaction = !/\bCONCURRENTLY\b/i.test(sql);
  try {
    if (canUseTransaction) await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name],
    );
    if (canUseTransaction) await client.query('COMMIT');
    log(`✅ ${name}`);
  } catch (error) {
    if (canUseTransaction) await client.query('ROLLBACK').catch(() => {});
    console.error(`[migrate] ❌ Falhou: ${name}`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    throw error;
  }
}

try {
  await client.connect();
  log(`Ligado a ${connectionString ? 'DATABASE_URL' : `${host}/${process.env.DB_DATABASE || 'kitanda'}`}`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = new Set(
    (await client.query('SELECT name FROM schema_migrations')).rows.map(
      (row) => row.name,
    ),
  );

  // 1. Schema base — só numa base de dados vazia.
  const baseExists =
    (await client.query("SELECT to_regclass('public.users') AS t")).rows[0]?.t !==
    null;
  if (!baseExists) {
    log('Base de dados vazia — a aplicar schema base…');
    await runFile('0000-base-schema', await readFile(join(root, 'database/schema.sql'), 'utf8'));
  }

  // 2. Migrações incrementais, por ordem de nome (data).
  const dir = join(root, 'database/migrations');
  const files = (await readdir(dir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      log(`↩︎  já aplicada: ${file}`);
      continue;
    }
    await runFile(file, await readFile(join(dir, file), 'utf8'));
  }

  log('Concluído.');
} catch {
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
