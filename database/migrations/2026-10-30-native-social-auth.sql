-- ============================================================
-- Migração: Autenticação social NATIVA (Google / Apple, sem Clerk)
-- Idempotente: pode correr várias vezes sem erro (IF NOT EXISTS).
--
-- Substitui a ligação social que antes guardava o clerk_id:
-- a coluna clerk_id é removida e o ID social passa a ser guardado
-- diretamente em google_id (sub do ID Token do Google) e apple_id
-- (sub do ID Token da Apple).
-- Nenhuma tabela nova é criada; só a tabela users é ajustada.
-- ============================================================

-- 1. Colunas para os IDs sociais nativos
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_apple_id ON users (apple_id) WHERE apple_id IS NOT NULL;

-- 2. Remover tudo o que restava do Clerk
DROP INDEX IF EXISTS uq_users_clerk_id;
ALTER TABLE users DROP COLUMN IF EXISTS clerk_id;

-- 3. Utilizadores criados via social (Google/Apple) não têm senha:
-- password_hash tem de ficar opcional.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 4. Avatar para contas sociais (foto do Google)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 5. Verificação de email: contas sociais vêm já verificadas
-- (o backend define is_email_verified = true; nada a alterar na estrutura).
