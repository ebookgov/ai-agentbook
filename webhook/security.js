/**
 * Security Module for EbookGov AI Webhook Server
 * Provides API key authentication and PayPal webhook signature verification
 */

const crypto = require('crypto');

// ============================================================
// Configuration
// ============================================================

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_API_BASE = PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

// Export for use in server.js
module.exports.PAYPAL_API_BASE = PAYPAL_API_BASE;

// Cache for PayPal OAuth token
let paypalTokenCache = {
  token: null,
  expiresAt: 0
};

// ============================================================
// API Key Authentication Middleware
// ============================================================

/**
 * Express middleware to require valid API key for protected routes
 * Validates the X-API-Key header against ADMIN_API_KEY environment variable
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function requireApiKey(req, res, next) {
  const adminApiKey = process.env.ADMIN_API_KEY;
  
  // If no API key is configured, log warning but allow in dev mode
  if (!adminApiKey) {
    console.warn('⚠️  ADMIN_API_KEY not configured - API endpoints are UNPROTECTED');
    console.warn('   Set ADMIN_API_KEY environment variable for production security');
    return next();
  }

  const providedKey = req.headers['x-api-key'];

  if (!providedKey) {
    console.warn(`🚫 Unauthorized access attempt to ${req.path} - No API key provided`);
    console.warn(`   IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);
    return res.status(403).json({ 
      error: 'Unauthorized: API key required',
      message: 'Include X-API-Key header with valid API key'
    });
  }

  // Use timing-safe comparison to prevent timing attacks
  const providedKeyBuffer = Buffer.from(providedKey);
  const adminKeyBuffer = Buffer.from(adminApiKey);

  if (providedKeyBuffer.length !== adminKeyBuffer.length || 
      !crypto.timingSafeEqual(providedKeyBuffer, adminKeyBuffer)) {
    console.warn(`🚫 Unauthorized access attempt to ${req.path} - Invalid API key`);
    console.warn(`   IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);
    return res.status(403).json({ 
      error: 'Unauthorized: Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  // API key is valid
  next();
}

// ============================================================
// PayPal Webhook Signature Verification
// ============================================================

/**
 * Get PayPal OAuth token (cached)
 * @returns {Promise<string|null>} OAuth access token or null on failure
 */
async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ PayPal credentials not configured (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)');
    return null;
  }

  // Check cache
  const now = Date.now();
  if (paypalTokenCache.token && paypalTokenCache.expiresAt > now) {
    return paypalTokenCache.token;
  }

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ PayPal OAuth failed: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    
    // Cache token (with 60 second buffer before expiry)
    paypalTokenCache = {
      token: data.access_token,
      expiresAt: now + (data.expires_in - 60) * 1000
    };

    console.log('✅ PayPal OAuth token obtained');
    return data.access_token;

  } catch (error) {
    console.error('❌ PayPal OAuth error:', error.message);
    return null;
  }
}

/**
 * Verify PayPal webhook signature using PayPal's verification API
 * This is the cryptographically secure way to verify webhooks
 * 
 * @param {Request} req - Express request with raw body preserved
 * @returns {Promise<boolean>} True if signature is valid, false otherwise
 */
async function verifyPayPalWebhookSignature(req) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  
  // Check if verification is configured
  if (!webhookId) {
    console.warn('⚠️  PAYPAL_WEBHOOK_ID not set - skipping signature verification');
    console.warn('   This is a SECURITY RISK in production!');
    // In development, you might want to return true
    // In production, you should return false
    return process.env.NODE_ENV !== 'production';
  }

  // Extract PayPal headers
  const transmissionId = req.headers['paypal-transmission-id'];
  const transmissionTime = req.headers['paypal-transmission-time'];
  const certUrl = req.headers['paypal-cert-url'];
  const authAlgo = req.headers['paypal-auth-algo'];
  const transmissionSig = req.headers['paypal-transmission-sig'];

  // Validate required headers exist
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.error('❌ Missing PayPal signature headers:', {
      hasTransmissionId: !!transmissionId,
      hasTransmissionTime: !!transmissionTime,
      hasCertUrl: !!certUrl,
      hasAuthAlgo: !!authAlgo,
      hasTransmissionSig: !!transmissionSig
    });
    return false;
  }

  // Get OAuth token
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) {
    console.error('❌ Cannot verify PayPal webhook: Failed to get access token');
    return false;
  }

  try {
    // Build verification request body
    const verificationBody = {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: req.body // The original webhook payload
    };

    // Call PayPal verification API
    const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(verificationBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ PayPal verification API error: ${response.status} - ${errorText}`);
      return false;
    }

    const result = await response.json();
    
    if (result.verification_status === 'SUCCESS') {
      console.log(`✅ PayPal webhook signature verified: ${transmissionId}`);
      return true;
    } else {
      console.error(`❌ PayPal webhook signature INVALID: ${result.verification_status}`);
      console.error(`   Transmission ID: ${transmissionId}`);
      return false;
    }

  } catch (error) {
    console.error('❌ PayPal signature verification error:', error.message);
    return false;
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  requireApiKey,
  verifyPayPalWebhookSignature,
  getPayPalAccessToken,
  PAYPAL_API_BASE
};
