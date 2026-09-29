import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersDeliveriesInvoicesCampaignsLivesAffiliates1700000000002
  implements MigrationInterface
{
  name = 'CreateOrdersDeliveriesInvoicesCampaignsLivesAffiliates1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- ==========================================================================
      -- PEDIDOS (COMPRAS FEITAS PELO CLIENTE PARA ENTREGA EM CASA)
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_number VARCHAR(50) NOT NULL UNIQUE,
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        delivery_address TEXT NOT NULL,
        delivery_latitude DECIMAL(10, 8) NOT NULL,
        delivery_longitude DECIMAL(11, 8) NOT NULL,
        delivery_notes TEXT,
        subtotal DECIMAL(12,2) NOT NULL,
        shipping_cost DECIMAL(12,2) DEFAULT 0.00,
        total_amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(12,2) NOT NULL,
        total_price DECIMAL(12,2) NOT NULL
      );

      -- Associar o Pedido à Entrega no Mapa
      ALTER TABLE deliveries
        ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

      -- ==========================================================================
      -- PERFIL FISCAL DA LOJA (DADOS EMPRESARIAIS OU INDIVIDUAIS)
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS store_billing_profiles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
        entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('individual', 'company')),
        company_name VARCHAR(150),
        nif VARCHAR(50) NOT NULL,
        tax_address TEXT,
        bank_name VARCHAR(100),
        iban VARCHAR(50),
        swift VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- ==========================================================================
      -- FATURAS EMITIDAS AOS CLIENTES
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        invoice_number VARCHAR(50) NOT NULL UNIQUE,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        issuer_name VARCHAR(150) NOT NULL,
        issuer_nif VARCHAR(50),
        entity_type VARCHAR(20) NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL,
        tax_amount DECIMAL(12,2) DEFAULT 0.00,
        total_amount DECIMAL(12,2) NOT NULL,
        download_token VARCHAR(255) UNIQUE NOT NULL,
        pdf_url TEXT,
        status VARCHAR(20) DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
        issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        description VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(12,2) NOT NULL,
        total_price DECIMAL(12,2) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_store ON invoices(store_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_token ON invoices(download_token);

      -- ==========================================================================
      -- CAMPANHAS PROMOCIONAIS ("SEXTOU")
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS promotional_campaigns (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        campaign_type VARCHAR(30) DEFAULT 'sextou',
        discount_percentage DECIMAL(5,2) CHECK (discount_percentage BETWEEN 0 AND 100),
        starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
        ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS campaign_products (
        campaign_id UUID NOT NULL REFERENCES promotional_campaigns(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        promotional_price DECIMAL(12,2) NOT NULL,
        PRIMARY KEY (campaign_id, product_id)
      );

      -- ==========================================================================
      -- TRANSMISSÕES AO VIVO
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS live_streams (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        title VARCHAR(150) NOT NULL,
        description TEXT,
        stream_key VARCHAR(255) NOT NULL UNIQUE,
        playback_url TEXT,
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended')),
        started_at TIMESTAMP WITH TIME ZONE,
        ended_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS live_comments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        live_id UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        is_question BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_live_streams_store ON live_streams(store_id);
      CREATE INDEX IF NOT EXISTS idx_live_comments_live ON live_comments(live_id);

      -- ==========================================================================
      -- ENTREGAS E RASTREAMENTO EM TEMPO REAL
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS deliveries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        courier_id UUID REFERENCES users(id) ON DELETE SET NULL,
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        pickup_address TEXT NOT NULL,
        pickup_latitude DECIMAL(10, 8) NOT NULL,
        pickup_longitude DECIMAL(11, 8) NOT NULL,
        delivery_address TEXT NOT NULL,
        delivery_latitude DECIMAL(10, 8) NOT NULL,
        delivery_longitude DECIMAL(11, 8) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'accepted', 'picking_up', 'in_transit', 'delivered', 'cancelled')),
        fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS delivery_tracking_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        heading DECIMAL(5, 2),
        speed DECIMAL(5, 2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_delivery_tracking_delivery ON delivery_tracking_logs(delivery_id);

      -- ==========================================================================
      -- AFILIADOS / MEMBROS DA EQUIPE DA LOJA
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS store_affiliates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(30) NOT NULL DEFAULT 'affiliate' CHECK (role IN ('affiliate', 'courier', 'manager')),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_store_user UNIQUE(store_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_store_affiliates_store ON store_affiliates(store_id);
      CREATE INDEX IF NOT EXISTS idx_store_affiliates_user ON store_affiliates(user_id);

      -- ==========================================================================
      -- PLANOS: SUPORTE A AFILIADOS E LIVES
      -- ==========================================================================
      ALTER TABLE seller_plans
        ADD COLUMN IF NOT EXISTS max_affiliates INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS allow_live_stream BOOLEAN DEFAULT FALSE;

      UPDATE seller_plans SET max_affiliates = 0, allow_live_stream = FALSE WHERE tier = 'normal';
      UPDATE seller_plans SET max_affiliates = 3, allow_live_stream = FALSE WHERE tier = 'black';
      UPDATE seller_plans SET max_affiliates = 999999, allow_live_stream = TRUE WHERE tier = 'premium';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE seller_plans
        DROP COLUMN IF EXISTS max_affiliates,
        DROP COLUMN IF EXISTS allow_live_stream;

      DROP TABLE IF EXISTS store_affiliates;
      DROP TABLE IF EXISTS delivery_tracking_logs;
      DROP TABLE IF EXISTS deliveries;
      DROP TABLE IF EXISTS live_comments;
      DROP TABLE IF EXISTS live_streams;
      DROP TABLE IF EXISTS campaign_products;
      DROP TABLE IF EXISTS promotional_campaigns;
      DROP TABLE IF EXISTS invoice_items;
      DROP TABLE IF EXISTS invoices;
      DROP TABLE IF EXISTS store_billing_profiles;
      DROP TABLE IF EXISTS order_items;
      DROP TABLE IF EXISTS orders;
    `);
  }
}
