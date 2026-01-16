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
require('dotenv').config({ path: '../.env' });

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
// Cache for performance (optional, simple in-memory cache for now)
let propertyCache = {};
const CACHE_TTL = 300000; // 5 minutes
let lastCacheUpdate = 0;

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

    const callId = fullPayload?.message?.call?.id || `CALL-${Date.now()}`;
    const bookingId = `BOOKING-${Date.now()}`;

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

    const callId = fullPayload?.message?.call?.id || `CALL-${Date.now()}`;
    const textNowPhone = process.env.TEXT_NOW_PHONE_NUMBER;

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
        transferId: `TRANSFER-${Date.now()}`,
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
        const { data: searchData } = await supabase
          .from('properties')
          .select('*')
          .or(`name.ilike.%${propertyId}%,location->>city.ilike.%${propertyId}%`)
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

// Admin endpoint to add properties (manual entry or via scraper)
app.post('/api/properties', async (req, res) => {
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

// ============================================================
// PayPal Webhook Endpoint
// ============================================================

// PayPal Webhook Signature Verification
async function verifyPayPalWebhook(req) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.warn('⚠️  PAYPAL_WEBHOOK_ID not set - skipping signature verification');
    return true; // Allow in dev mode
  }

  const transmissionId = req.headers['paypal-transmission-id'];
  const transmissionTime = req.headers['paypal-transmission-time'];
  const certUrl = req.headers['paypal-cert-url'];
  const transmissionSig = req.headers['paypal-transmission-sig'];
  const authAlgo = req.headers['paypal-auth-algo'];

  if (!transmissionId || !transmissionTime || !transmissionSig) {
    console.error('Missing PayPal signature headers');
    return false;
  }

  // For production, you should verify the signature using PayPal's API
  // For now, we'll do a basic check that headers exist
  // Full verification requires calling PayPal's /v1/notifications/verify-webhook-signature
  console.log(`PayPal webhook received: ${transmissionId}`);
  return true;
}

// PayPal Webhook Handler
app.post('/api/paypal/webhook', async (req, res) => {
  try {
    console.log('PayPal Webhook received:', JSON.stringify(req.body, null, 2));

    // Verify webhook signature
    const isValid = await verifyPayPalWebhook(req);
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

  // Calculate next billing period (typically 1 month from now)
  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

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
