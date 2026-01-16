const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_ACCESS_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const initialProperties = [
  {
    property_id: 'AZ-FLAG-001',
    name: 'Mountain View Ranch - Flagstaff',
    price: 425000,
    price_formatted: '$425,000',
    acreage: 35,
    location: { city: 'Flagstaff', county: 'Coconino', state: 'AZ', distance: '15 miles east of Flagstaff' },
    features: {
      structure: 'Log cabin',
      bedrooms: 2,
      bathrooms: 2,
      water: 'Well water',
      power: 'Solar panels + grid',
      access: 'Year-round paved road'
    },
    highlights: ['Stunning San Francisco Peaks views', 'Elk and deer habitat', 'Bordered by Coconino National Forest', 'Dark sky location']
  },
  {
    property_id: 'AZ-FLAG-002',
    name: 'Ponderosa Homestead',
    price: 289000,
    price_formatted: '$289,000',
    acreage: 20,
    location: { city: 'Williams', county: 'Coconino', state: 'AZ', distance: '25 minutes from Flagstaff' },
    features: {
      structure: 'Single family home',
      sqft: 1800,
      bedrooms: 3,
      bathrooms: 2,
      water: 'Well',
      power: 'Grid electric',
      extras: ['Detached workshop', 'Fenced pasture']
    },
    highlights: ['Ponderosa pine forest setting', 'Quiet county road', '30 minutes to Grand Canyon', 'Workshop for hobbies/business']
  },
  {
    property_id: 'AZ-COC-001',
    name: 'High Desert Retreat',
    price: 175000,
    price_formatted: '$175,000',
    acreage: 40,
    location: { city: 'Parks', county: 'Coconino', state: 'AZ', distance: '20 miles west of Flagstaff' },
    features: {
      structure: 'Raw land',
      buildingSite: 'Cleared and leveled',
      water: 'Would need well',
      power: 'At road (500ft run)',
      access: 'Maintained dirt road'
    },
    highlights: ['Dark sky certified area', 'Perfect for off-grid build', 'Owner financing available', 'No HOA or restrictions'],
    financing: { ownerFinancing: true, downPayment: '20%', interestRate: '7%', term: '10 years' }
  },
  {
    property_id: 'AZ-NAV-001',
    name: 'Red Rock Ranch',
    price: 549000,
    price_formatted: '$549,000',
    acreage: 80,
    location: { city: 'Winslow', county: 'Navajo', state: 'AZ', distance: '15 miles south of Winslow' },
    features: {
      structure: 'Adobe home',
      sqft: 2200,
      bedrooms: 3,
      bathrooms: 2,
      water: 'Well + 2 stock tanks',
      power: 'Grid electric',
      extras: ['Barn', 'Corrals', 'Equipment shed']
    },
    highlights: ['Working cattle ranch', 'Historic Route 66 access', 'Panoramic red rock views', 'Income-producing potential']
  },
  {
    property_id: 'AZ-YAV-001',
    name: 'Verde Valley Vineyard Lot',
    price: 225000,
    price_formatted: '$225,000',
    acreage: 10,
    location: { city: 'Camp Verde', county: 'Yavapai', state: 'AZ', distance: 'Central Verde Valley' },
    features: {
      structure: 'Ready to build',
      buildingSite: 'Cleared pad',
      water: 'Existing well (15 GPM)',
      power: 'Grid electric at site',
      irrigation: 'Drip system installed'
    },
    highlights: ['Arizona wine country', 'Adjacent to producing vineyard', 'Mild year-round climate', 'Near Jerome and Sedona']
  }
];

async function seedProperties() {
  console.log('🌱 Seeding properties...');
  
  for (const prop of initialProperties) {
    const { data, error } = await supabase
      .from('properties')
      .upsert(prop, { onConflict: 'property_id' })
      .select();
      
    if (error) {
      console.error(`❌ Error seeding ${prop.property_id}:`, error.message);
    } else {
      console.log(`✅ Seeded ${prop.property_id}`);
    }
  }
  
  console.log('✨ Seeding complete!');
}

seedProperties();
