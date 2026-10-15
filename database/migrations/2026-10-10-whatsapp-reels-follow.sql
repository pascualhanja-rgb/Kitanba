-- ============================================================
-- Migração: WhatsApp do vendedor + redes sociais, Reels (TikTok-style),
-- seguidores no chat e mensagens ligadas a Reels.
-- Idempotente: pode correr várias vezes sem erro (IF NOT EXISTS).
-- ============================================================

-- ------------------------------------------------------------
-- 1. stores: número do vendedor, link gerado e redes sociais
-- ------------------------------------------------------------
ALTER TABLE stores ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS whatsapp_link TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS youtube_url TEXT;

-- Função e Trigger: pega o número (ex: 923000000), adiciona o 244
-- e gera https://wa.me/244923000000
CREATE OR REPLACE FUNCTION format_angola_whatsapp_link()
RETURNS TRIGGER AS $$
DECLARE
    clean_number VARCHAR(30);
BEGIN
    IF NEW.whatsapp_number IS NOT NULL AND NEW.whatsapp_number != '' THEN
        clean_number := REGEXP_REPLACE(NEW.whatsapp_number, '\D', '', 'g');
        IF clean_number NOT LIKE '244%' THEN
            clean_number := '244' || clean_number;
        END IF;
        NEW.whatsapp_number := clean_number;
        NEW.whatsapp_link := 'https://wa.me/' || clean_number;
    ELSE
        NEW.whatsapp_link := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_format_whatsapp_link ON stores;
CREATE TRIGGER trg_format_whatsapp_link
BEFORE INSERT OR UPDATE OF whatsapp_number ON stores
FOR EACH ROW EXECUTE FUNCTION format_angola_whatsapp_link();

-- ------------------------------------------------------------
-- 2. advertisements: campos do Reels estilo TikTok
-- ------------------------------------------------------------
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS is_reels BOOLEAN DEFAULT FALSE;  -- vídeo vertical/Reels
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;      -- coração (ex: 276.6K)
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS comments_count INT DEFAULT 0;   -- balão de comentários (ex: 3501)
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS saves_count INT DEFAULT 0;      -- guardar/salvar (ex: 13K)
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS shares_count INT DEFAULT 0;     -- seta de partilha (ex: 4586)

-- ------------------------------------------------------------
-- 3. chat_rooms: indicação se o cliente é seguidor da loja
-- ------------------------------------------------------------
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS is_following BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------
-- 4. messages: ligação a Reels publicado (advertisements)
-- ------------------------------------------------------------
ALTER TABLE messages ADD COLUMN IF NOT EXISTS advertisement_id UUID REFERENCES advertisements(id) ON DELETE CASCADE;
ALTER TABLE messages ALTER COLUMN room_id DROP NOT NULL;
