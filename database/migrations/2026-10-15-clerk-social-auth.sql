-- ============================================================
-- Migração: Autenticação social via Clerk (Google, Apple, etc.)
-- Idempotente: pode correr várias vezes sem erro (IF NOT EXISTS).
-- ============================================================

-- 1. Coluna clerk_id: guarda o ID do utilizador nas contas Clerk
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_clerk_id ON users (clerk_id) WHERE clerk_id IS NOT NULL;

-- 2. Utilizadores criados via social (Google/Apple) não têm senha:
-- password_hash passa a ser opcional.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 3. Avatar para contas sociais (foto do Google/Apple)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 4. Verificação de email: contas Clerk vêm já verificadas
-- (is_email_verified já tem DEFAULT TRUE; nada a alterar).
