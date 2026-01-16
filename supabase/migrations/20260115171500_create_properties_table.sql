-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id TEXT UNIQUE NOT NULL, -- Corresponds to 'AZ-FLAG-001' etc.
    name TEXT NOT NULL,
    price NUMERIC,
    price_formatted TEXT,
    acreage NUMERIC,
    location JSONB DEFAULT '{}'::jsonb, -- Store city, county, state, distance
    features JSONB DEFAULT '{}'::jsonb, -- Store structure, bedrooms, bathrooms etc.
    highlights TEXT[] DEFAULT '{}',
    financing JSONB, -- Optional financing info
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow read access to everyone (public API usage)
CREATE POLICY "Enable read access for all users" ON properties
    FOR SELECT USING (true);

-- Allow write access only to service role (authenticated backend)
CREATE POLICY "Enable write access for service role only" ON properties
    FOR ALL USING (auth.role() = 'service_role');
