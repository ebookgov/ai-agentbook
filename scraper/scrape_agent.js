const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3000/api/properties';
const SELECTORS = require('./selectors.json');

async function scrapeProperties(url, type = 'mock') {
  console.log(`🚀 Starting scraper for: ${url} (Type: ${type})`);
  
  const browser = await puppeteer.launch({ 
    headless: "new"
  });
  const page = await browser.newPage();

  try {
    // Handle local file paths for testing
    if (url.startsWith('file://') || url.includes('.html')) {
        await page.goto(url, { waitUntil: 'networkidle0' });
    } else {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    // Get selectors for this site type
    const s = SELECTORS[type] || SELECTORS.generic;

    // Extract Data
    const listings = await page.evaluate((sel) => {
      const cards = document.querySelectorAll(sel.listingCard);
      const data = [];

      cards.forEach(card => {
        try {
          const getProps = (selector) => {
            const el = card.querySelector(selector);
            return el ? el.innerText.trim() : null;
          }
          const getSrc = (selector) => {
            const el = card.querySelector(selector);
            return el ? el.src : null;
          }

          const priceStr = getProps(sel.price);
          // Parse Price: Remove '$', ','
          const price = priceStr ? Number(priceStr.replace(/[^0-9.]/g, '')) : 0;

          const address = getProps(sel.address) || 'Unknown Location';
          // Simple parsing for now. In prod, use an address parser lib.
          const addressParts = address.split(',').map(p => p.trim());
          const city = addressParts.length > 1 ? addressParts[addressParts.length - 2] : 'Unknown';
          const state = addressParts.length > 1 ? addressParts[addressParts.length - 1].split(' ')[0] : 'AZ';

          const specs = getProps(sel.specs) || '';
          
          // Heuristic extraction for specs string like "3 bds | 2 ba | 2,400 sqft"
          const bedsMatch = specs.match(/(\d+)\s*bd/i);
          const bathsMatch = specs.match(/(\d+)\s*ba/i);
          const sqftMatch = specs.match(/([\d,]+)\s*sqft/i);

          data.push({
            name: `${addressParts[0] || 'Property'}`, // Use street address as name if no title
            price: price,
            price_formatted: priceStr,
            location: {
              city: city,
              state: state,
              address: address
            },
            features: {
              bedrooms: bedsMatch ? Number(bedsMatch[1]) : 0,
              bathrooms: bathsMatch ? Number(bathsMatch[1]) : 0,
              sqft: sqftMatch ? Number(sqftMatch[1].replace(/,/g, '')) : 0,
              structure: 'Single Family'
            },
            highlights: [specs], // Store raw specs as a highlight
            image_url: getSrc(sel.image)
          });
        } catch (e) {
          console.error("Error parsing card:", e);
        }
      });
      return data;
    }, s);

    console.log(`✅ Found ${listings.length} listings.`);

    // Send to API
    for (const listing of listings) {
        if (!listing.price || listing.price === 0) continue; // Skip bad data

        const payload = {
            ...listing,
            property_id: `SCRAPED-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };

        try {
            await axios.post(API_URL, payload);
            console.log(`   Processed: ${listing.name} - ${listing.price_formatted}`);
        } catch (err) {
            console.error(`   ❌ Failed to sync ${listing.name}:`, err.message);
        }
    }

  } catch (error) {
    console.error('Scraping failed:', error);
  } finally {
    await browser.close();
  }
}

// Runtime Argument Handling
const targetUrl = process.argv[2];
const targetType = process.argv[3] || 'mock';

if (!targetUrl) {
    console.log("Usage: node scrape_agent.js <url_or_file> <type>");
    console.log("Example: node scrape_agent.js file://" + path.resolve(__dirname, 'mock_profile.html') + " mock");
} else {
    scrapeProperties(targetUrl, targetType);
}
