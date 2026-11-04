import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 3 — Catálogo modular, carrinho, alugueres, serviços, imobiliário,
 * prestações e chamadas in-app (VoIP/WebRTC).
 *
 * Migração totalmente ADITIVA: não remove nem altera colunas existentes,
 * para não quebrar as fases 1 e 2.
 */
export class AddPhase3CatalogCartRentalsServicesInstallmentsCalls1700000000004
  implements MigrationInterface
{
  name = 'AddPhase3CatalogCartRentalsServicesInstallmentsCalls1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- ==========================================================================
      -- 1. PRODUTOS: TIPO, ALUGUER, CONDIÇÃO E REBOQUE
      -- ==========================================================================
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS product_type VARCHAR(30) NOT NULL DEFAULT 'physical'
          CHECK (product_type IN ('physical', 'rental', 'food', 'service')),
        ADD COLUMN IF NOT EXISTS rental_period_type VARCHAR(20)
          CHECK (rental_period_type IN ('hourly', 'daily', 'monthly')),
        ADD COLUMN IF NOT EXISTS security_deposit DECIMAL(12,2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS condition_type VARCHAR(20)
          CHECK (condition_type IN ('new', 'used', 'refurbished')),
        ADD COLUMN IF NOT EXISTS requires_towing BOOLEAN DEFAULT FALSE;

      CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);

      -- ==========================================================================
      -- 2. VARIAÇÕES DE PRODUTOS (Tamanhos/Cores/Adicionais)
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS product_variants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        additional_price DECIMAL(12,2) DEFAULT 0.00,
        stock_quantity INT NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);

      -- ==========================================================================
      -- 3. ALUGUERES
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS rentals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        start_date TIMESTAMP WITH TIME ZONE NOT NULL,
        end_date TIMESTAMP WITH TIME ZONE NOT NULL,
        rental_price DECIMAL(12,2) NOT NULL,
        security_deposit DECIMAL(12,2) DEFAULT 0.00,
        total_amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'active', 'returned', 'overdue', 'damaged', 'cancelled')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_rentals_customer ON rentals(customer_id);
      CREATE INDEX IF NOT EXISTS idx_rentals_store ON rentals(store_id);
      CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
      CREATE INDEX IF NOT EXISTS idx_rentals_product_dates ON rentals(product_id, start_date, end_date);

      -- ==========================================================================
      -- 4. CARRINHO DE COMPRAS
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS carts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cart_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
        quantity INT NOT NULL DEFAULT 1,
        special_instructions TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

      -- ==========================================================================
      -- 5. ITENS DO PEDIDO: VARIANTE E INSTRUÇÕES ESPECIAIS
      -- ==========================================================================
      ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS special_instructions TEXT;

      -- ==========================================================================
      -- 6. SERVIÇOS: DETALHES, HORÁRIOS E AGENDAMENTOS
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS service_details (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE UNIQUE,
        pricing_type VARCHAR(20) NOT NULL
          CHECK (pricing_type IN ('fixed', 'per_hour', 'per_sqm', 'quote_required')),
        estimated_duration_minutes INT DEFAULT 60,
        requires_site_visit BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS service_bookings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
        scheduled_date DATE NOT NULL,
        scheduled_time TIME NOT NULL,
        service_address TEXT NOT NULL,
        service_latitude DECIMAL(10, 8),
        service_longitude DECIMAL(11, 8),
        status VARCHAR(30) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
        total_amount DECIMAL(12,2) NOT NULL,
        notes_from_customer TEXT,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_service_bookings_customer ON service_bookings(customer_id);
      CREATE INDEX IF NOT EXISTS idx_service_bookings_store ON service_bookings(store_id);
      CREATE INDEX IF NOT EXISTS idx_service_bookings_date ON service_bookings(scheduled_date);
      CREATE INDEX IF NOT EXISTS idx_service_bookings_status ON service_bookings(status);

      CREATE TABLE IF NOT EXISTS store_service_schedules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_available BOOLEAN DEFAULT TRUE,
        CONSTRAINT unique_store_day UNIQUE (store_id, day_of_week)
      );

      -- ==========================================================================
      -- 7. DETALHES DE IMÓVEIS
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS real_estate_details (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE UNIQUE,
        property_type VARCHAR(30) NOT NULL
          CHECK (property_type IN ('house', 'apartment', 'land', 'commercial')),
        transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('sale', 'rent')),
        bedrooms INT DEFAULT 0,
        bathrooms INT DEFAULT 0,
        area_sqm DECIMAL(10,2),
        location_address TEXT NOT NULL,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8)
      );

      CREATE INDEX IF NOT EXISTS idx_real_estate_product ON real_estate_details(product_id);
      CREATE INDEX IF NOT EXISTS idx_real_estate_filters
        ON real_estate_details(transaction_type, property_type);

      -- ==========================================================================
      -- 8. PAGAMENTOS POR PRESTAÇÃO (PARCELAS)
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS installments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        installment_number INT NOT NULL,
        total_installments INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        due_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
        paid_at TIMESTAMP WITH TIME ZONE,
        payment_method VARCHAR(50),
        payment_proof_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_installments_customer ON installments(customer_id);
      CREATE INDEX IF NOT EXISTS idx_installments_store ON installments(store_id);
      CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
      CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);

      -- ==========================================================================
      -- 9. REGISTO DE CHAMADAS IN-APP (VoIP / WebRTC)
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS call_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        caller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'initiated'
          CHECK (status IN ('initiated', 'ringing', 'answered', 'missed', 'rejected', 'ended')),
        duration_seconds INT DEFAULT 0,
        started_at TIMESTAMP WITH TIME ZONE,
        ended_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_id);
      CREATE INDEX IF NOT EXISTS idx_call_logs_receiver ON call_logs(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_call_logs_order ON call_logs(order_id);
      CREATE INDEX IF NOT EXISTS idx_call_logs_delivery ON call_logs(delivery_id);
      CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS call_logs;
      DROP TABLE IF EXISTS installments;
      DROP TABLE IF EXISTS real_estate_details;
      DROP TABLE IF EXISTS store_service_schedules;
      DROP TABLE IF EXISTS service_bookings;
      DROP TABLE IF EXISTS service_details;
      DROP TABLE IF EXISTS cart_items;
      DROP TABLE IF EXISTS carts;
      DROP TABLE IF EXISTS rentals;
      DROP TABLE IF EXISTS product_variants;

      ALTER TABLE order_items
        DROP COLUMN IF EXISTS variant_id,
        DROP COLUMN IF EXISTS special_instructions;

      ALTER TABLE products
        DROP COLUMN IF EXISTS product_type,
        DROP COLUMN IF EXISTS rental_period_type,
        DROP COLUMN IF EXISTS security_deposit,
        DROP COLUMN IF EXISTS condition_type,
        DROP COLUMN IF EXISTS requires_towing;
    `);
  }
}
