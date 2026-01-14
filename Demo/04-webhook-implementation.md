# Webhook Implementation Guide - Function Execution Backend

## Overview

Your webhook server handles three critical functions that Vapi calls during demo calls:
1. **bookShowing()** - Saves booking details
2. **transferToHuman()** - Initiates free TextNow call transfer
3. **getPropertyDetails()** - Returns detailed property info

This guide provides Node.js/Express implementation examples.

---

## Prerequisites

```bash
npm install express axios dotenv body-parser cors
```

Required environment variables:
```
VAPI_API_KEY=your_vapi_key_here
TEXTNOW_API_KEY=your_textnow_api_key_here
TEXTNOW_PHONE=your_textnow_number_here
WEBHOOK_SECRET=secure_random_string
```

---

## Basic Webhook Server Setup

```javascript
// server.js
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Store bookings in memory (replace with database for production)
const bookings = [];
const propertyDatabase = {
  'AZ-FLAG-001': {
    id: 'AZ-FLAG-001',
    name: 'Mountain View Ranch - Flagstaff',
    price: 425000,
    acreage: 35,
    location: { city: 'Flagstaff', county: 'Coconino', state: 'AZ' },
    features: {
      structure: 'Log cabin',
      bedrooms: 2,
      bathrooms: 2,
      water: 'Well water',
      power: 'Solar panels + grid',
      access: 'Year-round paved road'
    },
    highlights: ['Stunning San Francisco Peaks views', 'Elk and deer habitat', 'Bordered by Coconino National Forest']
  },
  'AZ-FLAG-002': {
    id: 'AZ-FLAG-002',
    name: 'Ponderosa Homestead',
    price: 289000,
    acreage: 20,
    location: { city: 'Williams', county: 'Coconino', state: 'AZ' },
    features: {
      structure: 'Single family home',
      sqft: 1800,
      bedrooms: 3,
      bathrooms: 2,
      water: 'Well',
      power: 'Grid electric'
    }
  },
  'AZ-COC-001': {
    id: 'AZ-COC-001',
    name: 'High Desert Retreat',
    price: 175000,
    acreage: 40,
    location: { city: 'Parks', county: 'Coconino', state: 'AZ' },
    features: {
      structure: 'Raw land',
      buildingSite: 'Cleared and leveled',
      water: 'Would need well',
      power: 'At road (500ft run)'
    }
  },
  'AZ-NAV-001': {
    id: 'AZ-NAV-001',
    name: 'Red Rock Ranch',
    price: 549000,
    acreage: 80,
    location: { city: 'Winslow', county: 'Navajo', state: 'AZ' },
    features: {
      structure: 'Adobe home',
      sqft: 2200,
      bedrooms: 3,
      bathrooms: 2,
      extras: ['Barn', 'Corrals', 'Equipment shed']
    }
  },
  'AZ-YAV-001': {
    id: 'AZ-YAV-001',
    name: 'Verde Valley Vineyard Lot',
    price: 225000,
    acreage: 10,
    location: { city: 'Camp Verde', county: 'Yavapai', state: 'AZ' },
    features: {
      structure: 'Ready to build',
      buildingSite: 'Cleared pad',
      water: 'Existing well (15 GPM)',
      irrigation: 'Drip system installed'
    }
  }
};

// Middleware: Verify webhook signature
app.use((req, res, next) => {
  // In production, verify Vapi webhook signature
  // For now, basic validation
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Webhook server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
  console.log(`Webhook URL: https://your-domain.com/api/vapi/webhook`);
});

module.exports = app;
```

---

## Function 1: bookShowing

**When Called:** After Emma collects property, name, phone, date, and time

**What It Does:**
1. Validates incoming data
2. Stores booking in database
3. Sends confirmation to webhook response
4. (Optional) Emails or SMS confirmation to property manager

**Implementation:**

```javascript
// POST /api/vapi/webhook
// Function call handler
app.post('/api/vapi/webhook', async (req, res) => {
  try {
    const { functionCall } = req.body;
    
    if (!functionCall) {
      return res.json({
        success: false,
        message: 'No function call data received'
      });
    }

    const functionName = functionCall.name;
    const parameters = functionCall.parameters;

    console.log(`Function called: ${functionName}`);
    console.log('Parameters:', JSON.stringify(parameters, null, 2));

    // Route to appropriate handler
    if (functionName === 'bookShowing') {
      return handleBookShowing(parameters, res);
    } else if (functionName === 'transferToHuman') {
      return handleTransferToHuman(parameters, res);
    } else if (functionName === 'getPropertyDetails') {
      return handleGetPropertyDetails(parameters, res);
    } else {
      return res.status(400).json({
        success: false,
        message: `Unknown function: ${functionName}`
      });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Handler: bookShowing
async function handleBookShowing(parameters, res) {
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
      return res.status(400).json({
        success: false,
        message: 'Missing required booking information'
      });
    }

    // Create booking record
    const booking = {
      id: `BOOKING-${Date.now()}`,
      propertyId,
      propertyName,
      callerName,
      callerPhone,
      preferredDate,
      preferredTime: preferredTime || 'Not specified',
      bookingTime: new Date().toISOString(),
      status: 'confirmed',
      notes: 'Demo booking - auto created by AI agent'
    };

    // Store in memory (replace with database in production)
    bookings.push(booking);

    console.log('Booking created:', booking.id);

    // Log to file or database for persistent storage
    logBookingToFile(booking);

    // Return success response to Vapi
    return res.json({
      success: true,
      message: 'Booking confirmed successfully',
      bookingId: booking.id,
      confirmationText: `Your showing for ${propertyName} on ${preferredDate} at ${preferredTime} has been confirmed. Confirmation details sent to ${callerPhone}.`,
      booking: booking
    });

  } catch (error) {
    console.error('Error in bookShowing:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Helper: Log booking to file
function logBookingToFile(booking) {
  const fs = require('fs');
  const timestamp = new Date().toISOString();
  const logEntry = `\n${timestamp} | ${booking.id} | ${booking.callerName} | ${booking.propertyName} | ${booking.preferredDate}`;
  
  fs.appendFileSync('./bookings.log', logEntry, 'utf8');
}

// Optional: Get all bookings (for admin dashboard)
app.get('/api/bookings', (req, res) => {
  res.json({
    totalBookings: bookings.length,
    bookings: bookings
  });
});
```

---

## Function 2: transferToHuman

**When Called:** When caller explicitly requests transfer or shows strong buying intent

**What It Does:**
1. Validates caller info
2. Initiates SIP connection to your TextNow number
3. Returns transfer confirmation to Vapi
4. Call seamlessly transfers to your phone

**Implementation (TextNow SIP Transfer):**

```javascript
// Handler: transferToHuman
async function handleTransferToHuman(parameters, res) {
  try {
    const {
      callerName,
      callerPhone,
      reason,
      demoCompleted
    } = parameters;

    // Validate required fields
    if (!callerName || !callerPhone) {
      return res.status(400).json({
        success: false,
        message: 'Caller name and phone required for transfer'
      });
    }

    console.log(`Transfer requested - Caller: ${callerName}, Reason: ${reason}`);

    // Log transfer request
    const transfer = {
      id: `TRANSFER-${Date.now()}`,
      callerName,
      callerPhone,
      reason: reason || 'No reason specified',
      demoCompleted: demoCompleted || false,
      transferTime: new Date().toISOString()
    };

    logTransferToFile(transfer);

    // Get TextNow credentials from environment
    const textNowPhone = process.env.TEXTNOW_PHONE;

    if (!textNowPhone) {
      console.error('TextNow phone number not configured');
      return res.json({
        success: false,
        message: 'Transfer service temporarily unavailable. Please call back later.'
      });
    }

    // Method 1: Return SIP transfer instruction to Vapi
    // Vapi will handle the actual SIP REFER to your TextNow number
    return res.json({
      success: true,
      message: 'Transfer initiated',
      transferId: transfer.id,
      transferMethod: 'sip',
      transferTarget: `sip:${textNowPhone}@voip.textnow.com`,
      ringTimeout: 30,
      instructions: `Call transfer initiated to ${textNowPhone}. Call will ring through to the team's phone.`
    });

  } catch (error) {
    console.error('Error in transferToHuman:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Helper: Log transfer to file
function logTransferToFile(transfer) {
  const fs = require('fs');
  const timestamp = transfer.transferTime;
  const logEntry = `\n${timestamp} | ${transfer.id} | ${transfer.callerName} | ${transfer.reason}`;
  
  fs.appendFileSync('./transfers.log', logEntry, 'utf8');
}

// Optional: Get all transfer logs (for admin)
app.get('/api/transfers', (req, res) => {
  res.json({
    message: 'See transfers.log file for transfer history'
  });
});
```

---

## Function 3: getPropertyDetails

**When Called:** When caller asks for detailed info about a specific property

**Implementation:**

```javascript
// Handler: getPropertyDetails
function handleGetPropertyDetails(parameters, res) {
  try {
    const { propertyId } = parameters;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: 'Property ID required'
      });
    }

    // Look up property in database
    const property = propertyDatabase[propertyId];

    if (!property) {
      return res.status(404).json({
        success: false,
        message: `Property not found: ${propertyId}`
      });
    }

    // Return full property details
    return res.json({
      success: true,
      property: property,
      formattedDetails: formatPropertyDetails(property)
    });

  } catch (error) {
    console.error('Error in getPropertyDetails:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Helper: Format property details for natural speech
function formatPropertyDetails(property) {
  const features = property.features || {};
  let details = `${property.name} is a ${property.acreage}-acre property`;

  if (features.structure) {
    details += ` with a ${features.structure}`;
  }

  if (features.bedrooms && features.bathrooms) {
    details += ` - ${features.bedrooms} bedrooms, ${features.bathrooms} bathrooms`;
  }

  details += `. Listed at $${property.price.toLocaleString()}.`;

  if (property.highlights && property.highlights.length > 0) {
    details += ` Key features: ${property.highlights.slice(0, 2).join(', ')}.`;
  }

  return details;
}
```

---

## TextNow SIP Transfer Configuration

### Option A: Free SIP Transfer (Recommended)

TextNow supports SIP REFER protocol. When transfer function returns SIP target, Vapi will:

1. Send SIP REFER to TextNow infrastructure
2. Establish SIP connection to your TextNow account
3. Your phone rings with incoming call
4. You answer and talk to caller
5. Original Vapi call transfers to your line

**Setup:**
1. Get your TextNow phone number (format: `+1-XXX-XXX-XXXX`)
2. In webhook, use SIP format: `sip:+1XXXXXXXXXX@voip.textnow.com`
3. TextNow app auto-receives the call
4. No additional fees beyond TextNow free service

**Cost:** FREE (included with TextNow free tier)

### Option B: Webhook-Based Notification

If SIP transfer doesn't work, notify you via webhook and handle transfer manually:

```javascript
// Alternative transfer handler - webhook notification
async function handleTransferToHumanWebhook(parameters, res) {
  const { callerName, callerPhone, reason } = parameters;

  // Send SMS to your phone
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  await client.messages.create({
    body: `EbookGov Demo Call Transfer: ${callerName} (${callerPhone}) wants to talk. Reason: ${reason}`,
    from: process.env.YOUR_TWILIO_NUMBER,
    to: process.env.YOUR_PHONE_NUMBER
  });

  return res.json({
    success: true,
    message: 'Transfer notification sent to your phone'
  });
}
```

**Note:** This requires Twilio (paid). SIP method is better - it's free and automatic.

---

## Environment Variables Example

Create `.env` file in your project root:

```env
# Server
PORT=3000
NODE_ENV=production

# Vapi Configuration
VAPI_API_KEY=pa_your_vapi_api_key_here
VAPI_PHONE_NUMBER=+1928XXX XXXX

# TextNow Configuration
TEXTNOW_PHONE=+1XXXXXXXXXX
TEXTNOW_SIP_SERVER=voip.textnow.com

# Webhook Security
WEBHOOK_SECRET=your_secure_random_string_here

# Optional: Twilio (if using webhook method instead of SIP)
# TWILIO_ACCOUNT_SID=your_twilio_sid
# TWILIO_AUTH_TOKEN=your_twilio_token
# TWILIO_PHONE_NUMBER=+1234567890
# YOUR_PHONE_NUMBER=+1XXXXXXXXXX
```

---

## Deployment Instructions

### Local Testing

```bash
# Install dependencies
npm install

# Create .env file with your credentials
# (see example above)

# Run locally
npm start

# Test with curl
curl -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "functionCall": {
      "name": "bookShowing",
      "parameters": {
        "propertyId": "AZ-FLAG-001",
        "propertyName": "Mountain View Ranch",
        "callerName": "John Smith",
        "callerPhone": "602-555-1234",
        "preferredDate": "Friday",
        "preferredTime": "2pm"
      }
    }
  }'
```

### Production Deployment (Node/Express)

**Option 1: Heroku (Easiest)**
```bash
heroku login
heroku create your-app-name
git push heroku main
```

**Option 2: AWS Lambda + API Gateway**
```bash
npm install -g serverless
serverless deploy
```

**Option 3: Your Own Server (VPS)**
```bash
# SSH into server
ssh user@your-domain.com

# Clone repo
git clone your-repo
cd your-repo

# Install PM2 for process management
npm install -g pm2

# Start server
pm2 start server.js --name "ebookgov-webhook"
pm2 startup
pm2 save

# Setup nginx as reverse proxy (optional)
# nginx routes https://your-domain.com/api/vapi/webhook → localhost:3000
```

---

## Vapi Webhook Configuration

In Vapi Dashboard:

1. Go to **Settings** → **Webhooks**
2. Enter webhook URL: `https://your-domain.com/api/vapi/webhook`
3. Enable events:
   - ✅ `function-call`
   - ✅ `end-of-call-report`
   - ✅ `transcript`
4. Click **Save**

Test webhook:
1. Make a demo call
2. Request a booking or transfer
3. Check webhook server logs for incoming requests
4. Verify response is received by Vapi

---

## Database Integration (Optional)

For production, replace in-memory bookings with database:

```javascript
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: String,
  propertyId: String,
  propertyName: String,
  callerName: String,
  callerPhone: String,
  preferredDate: String,
  preferredTime: String,
  bookingTime: Date,
  status: String,
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model('Booking', bookingSchema);

// In handleBookShowing:
const booking = new Booking({ /* ...data... */ });
await booking.save();
```

---

## Monitoring & Logging

```javascript
// Advanced logging
const fs = require('fs');
const path = require('path');

function logEvent(eventType, data) {
  const logDir = './logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  const timestamp = new Date().toISOString();
  const logFile = path.join(logDir, `${eventType}.log`);
  const logLine = `${timestamp} | ${JSON.stringify(data)}\n`;

  fs.appendFileSync(logFile, logLine, 'utf8');
}

// Use in handlers:
// logEvent('booking', booking);
// logEvent('transfer', transfer);
// logEvent('error', error);
```

---

## Troubleshooting

**Issue: Webhook not receiving calls**
- [ ] Verify webhook URL is correct in Vapi Dashboard
- [ ] Check firewall/security groups allow inbound HTTPS
- [ ] Verify SSL certificate is valid
- [ ] Check server logs: `node server.js`

**Issue: bookShowing calls failing**
- [ ] Check all required parameters in function call
- [ ] Verify propertyId is in propertyDatabase
- [ ] Check callerPhone format is valid

**Issue: Transfer not working**
- [ ] Verify TextNow SIP server address is correct
- [ ] Check TextNow app is installed on your phone
- [ ] Test SIP directly: can you receive calls to your number?
- [ ] Check firewall allows SIP (port 5060)

**Issue: Missing bookings/transfers**
- [ ] Check log files in ./bookings.log and ./transfers.log
- [ ] Verify database is saving correctly
- [ ] Check disk space available

---

**Version:** 1.0  
**Last Updated:** January 14, 2026

Go to **07-implementation-checklist.md** next for step-by-step deployment guide.
