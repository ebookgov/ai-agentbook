-- Add disclosure columns to properties table for Arizona-specific data
-- water_rights, solar_lease, hoa

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS water_rights JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS solar_lease JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS hoa JSONB DEFAULT '{}'::jsonb;

-- Add helpful comments
COMMENT ON COLUMN properties.water_rights IS 'Water rights/hauled water disclosure details';
COMMENT ON COLUMN properties.solar_lease IS 'Solar panel lease information if applicable';
COMMENT ON COLUMN properties.hoa IS 'HOA fees, rules, and contact information';
