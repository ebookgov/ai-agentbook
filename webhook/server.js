/**
 * EbookGov AI Booking Agent - Webhook Server
 * Handles Vapi function calls for bookShowing, transferToHuman, and getPropertyDetails
 * Stores all call data in Supabase
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { requireApiKey, verifyPayPalWebhookSignature, getPayPalAccessToken, PAYPAL_API_BASE } = require('./security');
require('dotenv').config({ path: '../.env' });

// Ensure PayPal Webhook ID is configured in production
if (process.env.NODE_ENV === 'production' && !process.env.PAYPAL_WEBHOOK_ID) {
  console.warn('⚠️  PAYPAL_WEBHOOK_ID is not set in production environment. Webhook signature verification will be skipped!');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Initialize Supabase client (graceful degradation if not configured)
const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_ACCESS_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase client initialized');
} else {
  console.log('⚠️  Supabase not configured - calls will not be logged to database');
  console.log('   Missing:', !supabaseUrl ? 'SUPABASE_PROJECT_URL' : '', !supabaseKey ? 'SUPABASE_ACCESS_SECRET_KEY' : '');
}

// Property database moved to Supabase 'properties' table
// Cache for performance - Redis preferred, in-memory fallback
let propertyCache = {};
const CACHE_TTL = 300000; // 5 minutes (in-memory)
const REDIS_CACHE_TTL = 86400; // 24 hours (Redis)
let lastCacheUpdate = 0;

// Initialize Redis client (optional - graceful fallback to in-memory)
const Redis = require('redis');
let redisClient = null;
let redisConnected = false;

// Cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  totalLatency: 0,
  cacheLatency: 0
};

async function initRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    redisClient = Redis.createClient({ url: redisUrl });
    redisClient.on('error', (err) => {
      console.log('Redis connection error (using in-memory cache):', err.message);
      redisConnected = false;
    });
    redisClient.on('connect', () => {
      console.log('[OK] Redis connected');
      redisConnected = true;
    });
    await redisClient.connect();
  } catch (err) {
    console.log('[INFO] Redis not available - using in-memory cache');
    redisConnected = false;
  }
}

// Initialize Redis on startup
initRedis();

async function getProperty(propertyId) {
  // Check cache first
  const now = Date.now();
  if (propertyCache[propertyId] && (now - lastCacheUpdate < CACHE_TTL)) {
    return propertyCache[propertyId];
  }

  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('property_id', propertyId)
      .single();

    if (error || !data) {
      console.log(`Property not found in DB: ${propertyId}`);
      return null;
    }

    // Update cache
    propertyCache[propertyId] = data;
    lastCacheUpdate = now;
    return data;
  } catch (err) {
    console.error('Error fetching property:', err);
    return null;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'EbookGov AI Webhook',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/vapi/webhook/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'EbookGov AI Webhook',
    timestamp: new Date().toISOString()
  });
});

// Cache statistics endpoint (Phase 1)
app.get('/api/cache/stats', (req, res) => {
  const totalRequests = cacheStats.hits + cacheStats.misses;
  const hitRate = totalRequests > 0 ? (cacheStats.hits / totalRequests * 100) : 0;
  const avgLatency = cacheStats.misses > 0 ? (cacheStats.totalLatency / cacheStats.misses) : 0;
  const avgCacheLatency = cacheStats.hits > 0 ? (cacheStats.cacheLatency / cacheStats.hits) : 0;
  
  res.json({
    total_requests: totalRequests,
    cache_hits: cacheStats.hits,
    cache_misses: cacheStats.misses,
    hit_rate_percent: hitRate.toFixed(1),
    avg_latency_ms: avgLatency.toFixed(1),
    avg_cache_latency_ms: avgCacheLatency.toFixed(1),
    improvement_factor: avgCacheLatency > 0 ? (avgLatency / avgCacheLatency).toFixed(1) : 0,
    redis_connected: redisConnected
  });
});

// Reset cache stats
app.post('/api/cache/reset', (req, res) => {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.totalLatency = 0;
  cacheStats.cacheLatency = 0;
  res.json({ message: 'Cache stats reset' });
});

// Main webhook endpoint for Vapi function calls
app.post('/api/vapi/webhook', async (req, res) => {
  try {
    console.log('Received webhook:', JSON.stringify(req.body, null, 2));
    
    const { message } = req.body;
    
    // Handle different message types
    if (message?.type === 'function-call') {
      const functionCall = message.functionCall;
      const functionName = functionCall?.name;
      const parameters = functionCall?.parameters || {};
      
      console.log(`Function called: ${functionName}`);
      console.log('Parameters:', JSON.stringify(parameters, null, 2));

      // Route to appropriate handler
      let result;
      switch (functionName) {
        case 'bookShowing':
          result = await handleBookShowing(parameters, req.body);
          break;
        case 'transferToHuman':
          result = await handleTransferToHuman(parameters, req.body);
          break;
        case 'getPropertyDetails':
          result = await handleGetPropertyDetails(parameters);
          break;
        case 'lookupProperty':
          result = await handleLookupProperty(parameters);
          break;
        default:
          result = { success: false, message: `Unknown function: ${functionName}` };
      }

      return res.json({ results: [{ result: JSON.stringify(result) }] });
    }
    
    // Handle end-of-call reports
    if (message?.type === 'end-of-call-report') {
      await handleEndOfCallReport(req.body);
      return res.json({ success: true });
    }

    // Handle other message types
    return res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      results: [{ result: JSON.stringify({ success: false, error: error.message }) }]
    });
  }
});

// Handler: bookShowing
async function handleBookShowing(parameters, fullPayload) {
  try {
    const {
      propertyId,
      propertyName,
      callerName,
      callerPhone,
      preferredDate,
      preferredTime
    } = parameters;

    // Validate required fields
    if (!propertyId || !callerName || !callerPhone || !preferredDate) {
      return {
        success: false,
        message: 'Missing required booking information. Please provide property, name, phone, and preferred date.'
      };
    }

    const callId = fullPayload?.message?.call?.id || crypto.randomUUID();
    const bookingId = crypto.randomUUID();

    // Create/update call record in Supabase
    if (supabase) {
      const { data, error } = await supabase
        .from('demo_calls')
        .upsert({
          call_id: callId,
          caller_name: callerName,
          caller_phone: callerPhone,
          property_id: propertyId,
          property_name: propertyName || (await getProperty(propertyId))?.name || propertyId,
          preferred_date: preferredDate,
          preferred_time: preferredTime || 'Not specified',
          booking_confirmed: true,
          call_status: 'booking_confirmed',
          updated_at: new Date().toISOString()
        }, { onConflict: 'call_id' })
        .select();

      if (error) {
        console.error('Supabase error:', error);
        // Continue even if DB fails - don't break the call
      }
    }

    console.log(`Booking created: ${bookingId} for ${callerName}`);

    return {
      success: true,
      message: 'Booking confirmed successfully',
      bookingId: bookingId,
      confirmationText: `Perfect! I've got you down for ${propertyName || propertyId} on ${preferredDate}${preferredTime ? ` at ${preferredTime}` : ''}. A team member will confirm the details with you shortly at ${callerPhone}.`
    };

  } catch (error) {
    console.error('Error in bookShowing:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper: Validate phone number format (E.164 international standard)
function validatePhoneNumber(phone) {
  if (!phone) return false;

  // E.164 regex: + followed by 1-15 digits, starting with country code
  const e164Regex = /^\+[1-9]\d{1,14}$/;

  // Clean the phone number first (remove spaces, dashes, etc.)
  const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');

  return e164Regex.test(cleanPhone);
}

// Handler: transferToHuman
async function handleTransferToHuman(parameters, fullPayload) {
  try {
    const {
      callerName,
      callerPhone,
      reason,
      demoCompleted
    } = parameters;

    // Validate required fields
    if (!callerName || !callerPhone) {
      return {
        success: false,
        message: 'Caller name and phone required for transfer'
      };
    }

    const callId = fullPayload?.message?.call?.id || crypto.randomUUID();
    const textNowPhone = process.env.TEXT_NOW_PHONE_NUMBER;

    // Validate TEXT_NOW_PHONE_NUMBER format and presence
    if (!textNowPhone || !validatePhoneNumber(textNowPhone)) {
      console.error(`Invalid or missing TEXT_NOW_PHONE_NUMBER: ${textNowPhone}`);
      return {
        success: false,
        message: 'Human transfer service is currently unavailable. Please try again later or contact support.'
      };
    }

    console.log(`Transfer requested - Caller: ${callerName}, Reason: ${reason}`);

    // Update call record in Supabase
    if (supabase) {
      const { error } = await supabase
        .from('demo_calls')
        .upsert({
          call_id: callId,
          caller_name: callerName,
          caller_phone: callerPhone,
          transfer_requested: true,
          call_status: 'transfer_initiated',
          updated_at: new Date().toISOString()
        }, { onConflict: 'call_id' })
        .select();

      if (error) {
        console.error('Supabase error:', error);
      }
    }

    // If TextNow is configured, return SIP transfer
    if (textNowPhone) {
      const cleanPhone = textNowPhone.replace(/[^0-9+]/g, '');
      return {
        success: true,
        message: 'Transfer initiated',
        transferId: crypto.randomUUID(),
        // Vapi transfer destination format
        destination: {
          type: 'number',
          number: cleanPhone,
          message: `Incoming transfer from ${callerName}. Reason: ${reason || 'Interested in EbookGov service'}`
        }
      };
    }

    // Fallback if no TextNow configured
    return {
      success: true,
      message: 'Transfer request logged. Our team will call you back shortly.',
      callbackScheduled: true
    };

  } catch (error) {
    console.error('Error in transferToHuman:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Handler: getPropertyDetails
async function handleGetPropertyDetails(parameters) {
  try {
    const { propertyId } = parameters;

    if (!propertyId) {
      return {
        success: false,
        message: 'Property ID required'
      };
    }

    // Look up property in database (via helper)
    const property = await getProperty(propertyId);

    if (!property) {
      // Try fuzzy matching by name in DB if using 'like' query, but for now strict ID check or simple cache scan
      // For a robust search, we'd query Supabase with `ilike` on name/city
      // Let's do a quick fallback search if ID lookup failed
      if (supabase) {
        // Sanitize input: remove potentially dangerous characters for string interpolation
        // Allows alphanumeric, spaces, dashes (common in addresses/names)
        const safeId = propertyId.replace(/[^a-zA-Z0-9\s-]/g, '');
        
        if (!safeId) {
             return { success: false, message: 'Invalid property ID format' };
        }

        const { data: searchData } = await supabase
          .from('properties')
          .select('*')
          .or(`name.ilike.%${safeId}%,location->>city.ilike.%${safeId}%`)
          .limit(1)
          .single();
          
        if (searchData) {
           return {
            success: true,
            property: searchData,
            formattedDetails: formatPropertyDetails(searchData)
          };
        }
      }

      return {
        success: false,
        message: `Property not found: ${propertyId}. Available properties are listed in our database.`
      };
    }

    return {
      success: true,
      property: property,
      formattedDetails: formatPropertyDetails(property)
    };

  } catch (error) {
    console.error('Error in getPropertyDetails:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Handler: lookupProperty (Phase 1 caching)
// Handles Arizona-specific knowledge queries with Redis/in-memory caching
async function handleLookupProperty(parameters) {
  const requestStart = Date.now();
  
  try {
    const { address, query_type } = parameters;
    
    if (!address) {
      return { success: false, error: 'Address required' };
    }
    
    const queryType = query_type || 'general_info';
    const cacheKey = `property:${address.toLowerCase()}:${queryType}`;
    
    // Try Redis cache first
    if (redisConnected && redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          cacheStats.hits++;
          cacheStats.cacheLatency += Date.now() - requestStart;
          console.log(`[CACHE HIT] ${address} (${queryType}) - Redis`);
          const result = JSON.parse(cached);
          result.cache_hit = true;
          result.latency_ms = Date.now() - requestStart;
          return result;
        }
      } catch (err) {
        console.log('Redis get error:', err.message);
      }
    }
    
    // Try in-memory cache
    const memCacheKey = `${address.toLowerCase()}:${queryType}`;
    if (propertyCache[memCacheKey] && (Date.now() - lastCacheUpdate < CACHE_TTL)) {
      cacheStats.hits++;
      cacheStats.cacheLatency += Date.now() - requestStart;
      console.log(`[CACHE HIT] ${address} (${queryType}) - Memory`);
      return { ...propertyCache[memCacheKey], cache_hit: true, latency_ms: Date.now() - requestStart };
    }
    
    // Cache miss - fetch from database
    cacheStats.misses++;
    console.log(`[CACHE MISS] ${address} (${queryType})`);
    
    // Look up property in Supabase
    let propertyData = null;
    if (supabase) {
      const { data } = await supabase
        .from('properties')
        .select('*')
        .or(`name.ilike.%${address}%,property_id.eq.${address}`)
        .limit(1)
        .single();
      propertyData = data;
    }
    
    // Build result based on query type
    let result;
    if (queryType === 'water_rights') {
      result = {
        success: true,
        address: address,
        type: 'water_rights',
        data: propertyData?.water_rights || {
          disclosure: 'Water rights information not available for this property. Please contact the county assessor.'
        }
      };
    } else if (queryType === 'solar_lease') {
      result = {
        success: true,
        address: address,
        type: 'solar_lease',
        data: propertyData?.solar_lease || {
          disclosure: 'No solar lease information on file.'
        }
      };
    } else if (queryType === 'hoa_rules') {
      result = {
        success: true,
        address: address,
        type: 'hoa_rules',
        data: propertyData?.hoa || {
          disclosure: 'HOA information not available.'
        }
      };
    } else if (queryType === 'property_tax') {
      result = {
        success: true,
        address: address,
        type: 'property_tax',
        data: propertyData?.tax_info || {
          disclosure: 'Property tax information should be verified with the county assessor.'
        }
      };
    } else {
      result = {
        success: true,
        address: address,
        type: 'general_info',
        data: propertyData || { message: 'Property not found in database' }
      };
    }
    
    result.retrieved_at = new Date().toISOString();
    
    // Cache the result
    if (redisConnected && redisClient) {
      try {
        await redisClient.setEx(cacheKey, REDIS_CACHE_TTL, JSON.stringify(result));
      } catch (err) {
        console.log('Redis set error:', err.message);
      }
    }
    
    // Also update in-memory cache
    propertyCache[memCacheKey] = result;
    lastCacheUpdate = Date.now();
    
    cacheStats.totalLatency += Date.now() - requestStart;
    result.cache_hit = false;
    result.latency_ms = Date.now() - requestStart;
    
    return result;
    
  } catch (error) {
    console.error('Error in lookupProperty:', error);
    return { success: false, error: error.message };
  }
}

// Handle end-of-call reports for analytics
async function handleEndOfCallReport(payload) {
  try {
    const callId = payload?.message?.call?.id;
    const transcript = payload?.message?.transcript;
    const duration = payload?.message?.durationSeconds;

    if (callId && supabase) {
      await supabase
        .from('demo_calls')
        .upsert({
          call_id: callId,
          call_transcript: transcript,
          call_duration_seconds: duration,
          call_status: 'completed',
          updated_at: new Date().toISOString()
        }, { onConflict: 'call_id' });

      console.log(`Call ${callId} completed. Duration: ${duration}s`);
    }
  } catch (error) {
    console.error('Error handling end-of-call report:', error);
  }
}

// Helper: Format property details for natural speech
function formatPropertyDetails(property) {
  const features = property.features || {};
  let details = `${property.name} is a ${property.acreage || 'various'}-acre property`;

  if (features.structure && features.structure !== 'Raw land') {
    details += ` with a ${features.structure}`;
  } else if (features.structure === 'Raw land') {
    details += ` of raw land`;
  }

  if (features.bedrooms && features.bathrooms) {
    details += ` - ${features.bedrooms} bedrooms, ${features.bathrooms} bathrooms`;
  }

  if (features.sqft) {
    details += `, ${features.sqft} square feet`;
  }

  if (property.location) {
     details += `. Located in ${property.location.city}, ${property.location.state}`;
  }
  
  if (property.price_formatted) {
      details += `. Listed at ${property.price_formatted}.`;
  } else if (property.price) {
      details += `. Listed at $${property.price}.`;
  }

  if (property.highlights && property.highlights.length > 0) {
    details += ` Key features include: ${property.highlights.slice(0, 3).join(', ')}.`;
  }

  return details;
}

// Get all bookings (admin endpoint)
app.get('/api/bookings', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({
        totalBookings: 0,
        bookings: [],
        message: 'Supabase not configured'
      });
    }
    
    const { data, error } = await supabase
      .from('demo_calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      totalBookings: data?.length || 0,
      bookings: data || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to list all properties (for Dashboard)
app.get('/api/properties', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: false, message: 'Supabase not configured' });
    }
    
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, properties: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin endpoint to add properties (manual entry) - PROTECTED
app.post('/api/properties', requireApiKey, async (req, res) => {
  try {
    const { property_id, name, price, price_formatted, acreage, location, features, highlights, financing } = req.body;
    
    if (!property_id || !name) {
      return res.status(400).json({ error: 'property_id and name are required' });
    }

    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

    const { data, error } = await supabase
      .from('properties')
      .upsert({
        property_id,
        name,
        price,
        price_formatted,
        acreage,
        location,
        features,
        highlights,
        financing,
        updated_at: new Date().toISOString()
      }, { onConflict: 'property_id' })
      .select();

    if (error) throw error;

    // Invalidate cache for this property
    delete propertyCache[property_id];

    res.json({ success: true, property: data[0] });

  } catch (error) {
    console.error('Error adding property:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch endpoint for CSV Import - PROTECTED
app.post('/api/properties/batch', requireApiKey, async (req, res) => {
  try {
    if (!supabase) return res.json({ success: false, message: 'Supabase not configured' });
    
    const { properties } = req.body;
    if (!Array.isArray(properties)) {
      return res.status(400).json({ success: false, message: 'Invalid payload: properties must be an array' });
    }

    // Prepare records with IDs if missing
    const records = properties.map(p => ({
      ...p,
      property_id: p.property_id || `IMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status: p.status || 'active',
      created_at: new Date()
    }));

    const { data, error } = await supabase
      .from('properties')
      .upsert(records, { onConflict: 'property_id' })
      .select();

    if (error) throw error;

    // Clear cache
    if (typeof propertyCache !== 'undefined') propertyCache.clear();

    res.json({ success: true, count: data.length, properties: data });
  } catch (error) {
    console.error('Batch import error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// PayPal Webhook Endpoint
// ============================================================

// PayPal Webhook Signature Verification - Now using cryptographic verification from security.js
// The verifyPayPalWebhookSignature function is imported from ./security.js
// It performs full cryptographic verification via PayPal's /v1/notifications/verify-webhook-signature API

// PayPal Webhook Handler
app.post('/api/paypal/webhook', async (req, res) => {
  try {
    console.log('PayPal Webhook received:', JSON.stringify(req.body, null, 2));

    // Verify webhook signature using cryptographic verification
    const isValid = await verifyPayPalWebhookSignature(req);
    if (!isValid) {
      console.error('Invalid PayPal webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const eventType = req.body.event_type;
    const resource = req.body.resource;

    console.log(`Processing PayPal event: ${eventType}`);

    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(resource);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(resource);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(resource);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        await handlePaymentCompleted(resource);
        break;

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await handlePaymentFailed(resource);
        break;

      default:
        console.log(`Unhandled PayPal event type: ${eventType}`);
    }

    // Always respond 200 to PayPal
    res.status(200).json({ received: true });

  } catch (error) {
    console.error('PayPal webhook error:', error);
    // Still return 200 to prevent PayPal from retrying
    res.status(200).json({ received: true, error: error.message });
  }
});

// Handler: Subscription Activated
async function handleSubscriptionActivated(resource) {
  const subscriptionId = resource.id;
  const planId = resource.plan_id;
  const subscriberEmail = resource.subscriber?.email_address;
  const startTime = resource.start_time;

  console.log(`✅ Subscription activated: ${subscriptionId} for ${subscriberEmail}`);

  if (supabase) {
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        subscription_id: subscriptionId,
        user_email: subscriberEmail,
        status: 'active',
        plan_id: planId,
        start_time: startTime,
        updated_at: new Date().toISOString()
      }, { onConflict: 'subscription_id' });

    if (error) {
      console.error('Supabase error (subscription activated):', error);
    } else {
      console.log(`Subscription ${subscriptionId} saved to database`);
    }
  }
}

// Handler: Subscription Cancelled
async function handleSubscriptionCancelled(resource) {
  const subscriptionId = resource.id;

  console.log(`❌ Subscription cancelled: ${subscriptionId}`);

  if (supabase) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('subscription_id', subscriptionId);

    if (error) {
      console.error('Supabase error (subscription cancelled):', error);
    }
  }
}

// Handler: Subscription Suspended
async function handleSubscriptionSuspended(resource) {
  const subscriptionId = resource.id;

  console.log(`⏸️ Subscription suspended: ${subscriptionId}`);

  if (supabase) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'suspended',
        updated_at: new Date().toISOString()
      })
      .eq('subscription_id', subscriptionId);

    if (error) {
      console.error('Supabase error (subscription suspended):', error);
    }
  }
}

// Handler: Payment Completed (recurring payment success)
async function handlePaymentCompleted(resource) {
  const billingAgreementId = resource.billing_agreement_id;
  const amount = resource.amount?.total;
  const currency = resource.amount?.currency;

  console.log(`💰 Payment completed: ${amount} ${currency} for subscription ${billingAgreementId}`);

  // Default fallback: 1 month from payment creation time (or now)
  // Using resource.create_time is better than new Date() to avoid drift from webhook delays
  let nextBillingDate = new Date(resource.create_time || Date.now());
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  // Attempt to get authoritative next_billing_time from PayPal API
  try {
    const accessToken = await getPayPalAccessToken();
    if (accessToken && billingAgreementId) {
      const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${billingAgreementId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const subData = await response.json();
        if (subData.billing_info && subData.billing_info.next_billing_time) {
          nextBillingDate = new Date(subData.billing_info.next_billing_time);
          console.log(`✅ Retrieved accurate next billing date from PayPal: ${nextBillingDate.toISOString()}`);
        }
      } else {
        console.warn(`⚠️ Failed to fetch subscription details: ${response.status}`);
      }
    }
  } catch (err) {
    console.error('Error fetching accurate billing date (using fallback):', err.message);
  }

  if (supabase && billingAgreementId) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_end: nextBillingDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('subscription_id', billingAgreementId);

    if (error) {
      console.error('Supabase error (payment completed):', error);
    }
  }
}

// Handler: Payment Failed
async function handlePaymentFailed(resource) {
  const subscriptionId = resource.id || resource.billing_agreement_id;

  console.log(`⚠️ Payment failed for subscription: ${subscriptionId}`);

  if (supabase && subscriptionId) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('subscription_id', subscriptionId);

    if (error) {
      console.error('Supabase error (payment failed):', error);
    }
  }
}

// Health check for PayPal webhook
app.get('/api/paypal/webhook/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PayPal Webhook Handler',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║       EbookGov AI Webhook Server Running                   ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                                ║
║  Webhook URL: http://localhost:${PORT}/api/vapi/webhook        ║
║  Health Check: http://localhost:${PORT}/health                 ║
║  Bookings API: http://localhost:${PORT}/api/bookings           ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
