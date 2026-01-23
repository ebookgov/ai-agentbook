-- Insert Arizona properties with water_rights, solar_lease, hoa fields
-- Run this in Supabase SQL Editor or via CLI

INSERT INTO properties (
    property_id, name, price, price_formatted, acreage, 
    location, features, highlights, financing, status,
    water_rights, solar_lease, hoa
) VALUES 
(
    'AZ-FLAG-001',
    'Mountain View Ranch',
    425000,
    '$425,000',
    35,
    '{"city": "Flagstaff", "county": "Coconino", "state": "AZ", "distance_to_city": "15 miles"}'::jsonb,
    '{"structure": "Log Cabin", "bedrooms": 2, "bathrooms": 2, "sqft": 1400}'::jsonb,
    ARRAY['San Francisco Peaks views', 'National Forest border', 'Well water', 'Solar panels'],
    '{"available": false}'::jsonb,
    'active',
    '{"type": "well", "details": "Private well drilled 2019, 12 GPM flow rate. Water quality tested annually.", "tank_size": null}'::jsonb,
    '{"provider": "SunRun", "monthly_cost": 135, "years_remaining": 12, "transferable": true, "system_size": "8.5kW"}'::jsonb,
    '{}'::jsonb
),
(
    'AZ-FLAG-002',
    'Ponderosa Homestead',
    289000,
    '$289,000',
    20,
    '{"city": "Williams", "county": "Coconino", "state": "AZ", "distance_to_city": "5 miles"}'::jsonb,
    '{"structure": "Single Family Home", "bedrooms": 3, "bathrooms": 2, "sqft": 1800}'::jsonb,
    ARRAY['30 min to Grand Canyon', 'Ponderosa pine forest', 'Detached workshop'],
    '{"available": false}'::jsonb,
    'active',
    '{"type": "municipal", "details": "Connected to Williams city water. No water hauling required.", "monthly_avg": 45}'::jsonb,
    '{}'::jsonb,
    '{"monthly_fee": 25, "covers": "Road maintenance, common area upkeep", "name": "Ponderosa Estates HOA"}'::jsonb
),
(
    'AZ-COC-001',
    'High Desert Retreat',
    175000,
    '$175,000',
    40,
    '{"city": "Parks", "county": "Coconino", "state": "AZ", "distance_to_city": "12 miles"}'::jsonb,
    '{"structure": "Raw Land", "bedrooms": 0, "bathrooms": 0, "sqft": 0}'::jsonb,
    ARRAY['Dark sky location', 'Cleared building site', 'Power at road', 'Owner financing available'],
    '{"available": true, "down_payment": 20000, "monthly": 1200, "term_years": 15, "interest_rate": 7.5}'::jsonb,
    'active',
    '{"type": "hauled", "details": "Property requires hauled water. Nearest water fill station: 8 miles in Parks. Recommend 2500+ gallon storage tank.", "provider_list": ["Parks Water Hauling", "Coconino H2O Delivery"]}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
),
(
    'AZ-NAV-001',
    'Red Rock Ranch',
    549000,
    '$549,000',
    80,
    '{"city": "Winslow", "county": "Navajo", "state": "AZ", "distance_to_city": "10 miles"}'::jsonb,
    '{"structure": "Adobe Home", "bedrooms": 3, "bathrooms": 2, "sqft": 2200}'::jsonb,
    ARRAY['Working cattle ranch', 'Route 66 access', 'Barn and corrals', 'Historic property'],
    '{"available": false}'::jsonb,
    'active',
    '{"type": "water_rights", "details": "Grandfathered water rights, 2 acre-feet annually. Domestic well on property, 8 GPM. Stock tank fed by seasonal wash.", "rights_type": "grandfathered", "acre_feet": 2}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
),
(
    'AZ-YAV-001',
    'Verde Valley Vineyard',
    225000,
    '$225,000',
    10,
    '{"city": "Camp Verde", "county": "Yavapai", "state": "AZ", "distance_to_city": "3 miles"}'::jsonb,
    '{"structure": "Cleared Building Pad", "bedrooms": 0, "bathrooms": 0, "sqft": 0}'::jsonb,
    ARRAY['Wine country', 'Vineyard neighbors', 'Irrigated land', 'Well on property'],
    '{"available": true, "down_payment": 25000, "monthly": 1500, "term_years": 10, "interest_rate": 6.9}'::jsonb,
    'active',
    '{"type": "irrigation_rights", "details": "Irrigation rights from Verde River Irrigation District. Well permit for domestic use. Perfect for vineyard or small farm.", "district": "Verde River Irrigation District"}'::jsonb,
    '{}'::jsonb,
    '{"monthly_fee": 55, "covers": "Road maintenance, community water system fees, trash collection", "name": "Verde Vista Community Association"}'::jsonb
)
ON CONFLICT (property_id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    price_formatted = EXCLUDED.price_formatted,
    acreage = EXCLUDED.acreage,
    location = EXCLUDED.location,
    features = EXCLUDED.features,
    highlights = EXCLUDED.highlights,
    financing = EXCLUDED.financing,
    status = EXCLUDED.status,
    water_rights = EXCLUDED.water_rights,
    solar_lease = EXCLUDED.solar_lease,
    hoa = EXCLUDED.hoa,
    updated_at = NOW();
