-- Professional specialties
CREATE TABLE IF NOT EXISTS professional_specialties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- Provider specialties (store <-> specialty)
CREATE TABLE IF NOT EXISTS provider_specialties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    specialty_id INT NOT NULL REFERENCES professional_specialties(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, specialty_id)
);

-- Provider portfolios
CREATE TABLE IF NOT EXISTS provider_portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- Service quote requests
CREATE TABLE IF NOT EXISTS service_quote_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    specialty_id INT REFERENCES professional_specialties(id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    photo_url TEXT,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status VARCHAR(25) DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled')),
    proposed_price DECIMAL(12,2),
    admin_or_provider_notes TEXT,
    scheduled_date DATE,
    scheduled_time TIME,
    reject_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provider_specialties_store_id ON provider_specialties(store_id);
CREATE INDEX IF NOT EXISTS idx_provider_specialties_specialty_id ON provider_specialties(specialty_id);
CREATE INDEX IF NOT EXISTS idx_provider_portfolios_store_id ON provider_portfolios(store_id);
CREATE INDEX IF NOT EXISTS idx_service_quote_requests_customer_id ON service_quote_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_quote_requests_store_id ON service_quote_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_service_quote_requests_status ON service_quote_requests(status);
