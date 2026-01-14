# Step-by-Step Implementation Checklist

Complete this checklist to deploy your full EbookGov AI Booking Agent demo in 30-45 minutes.

---

## Phase 1: Vapi Setup (10 minutes)

### 1.1 Create Vapi Assistant

- [ ] Go to **dashboard.vapi.ai**
- [ ] Click **"Create Assistant"**
- [ ] Name: `EbookGov-Demo-AZ`
- [ ] Description: "AI Booking Agent for Rural Arizona Properties"
- [ ] Click **Create**

### 1.2 Configure Voice

- [ ] Provider: **11labs**
- [ ] Voice ID: **21m00Tcm4TlvDq8ikWAM** (Rachel - professional female)
- [ ] Stability: **0.5**
- [ ] Similarity Boost: **0.75**

Alternative voices:
- `ErXwobaYiN019PkySvjV` (Antoni - male)
- `pNInz6obpgDQGcFmaJgB` (Adam - deep male)

### 1.3 Configure LLM Model

- [ ] **Option A - Fast & Cheap (Recommended):**
  - Provider: **Cerebras**
  - Model: **llama-3.3-70b**
  - Temperature: **0.7**
  - Max Tokens: **500**

- [ ] **Option B - Best Quality:**
  - Provider: **OpenAI**
  - Model: **gpt-4-turbo**
  - Temperature: **0.7**
  - Max Tokens: **500**

### 1.4 Configure Transcription

- [ ] Provider: **Deepgram**
- [ ] Model: **nova-2**
- [ ] Language: **en-US**

### 1.5 Set First Message

Copy and paste into **"First Message"** field:

```
Hi, this is Emma from EbookGov. I need to let you know upfront 
that I'm an AI assistant. I'm here to help you explore our rural 
Arizona properties and book showings. Are you interested in 
checking out a specific property, or would you like me to tell you 
what we have available?
```

### 1.6 Add System Prompt

- [ ] Go to **Settings** → **System Prompt**
- [ ] Copy entire prompt from **02-system-prompt-updated.md**
- [ ] Paste into Vapi System Prompt field
- [ ] Click **Save**

### 1.7 Add Functions

In Vapi Dashboard, go to **"Functions"** and add three functions:

#### Function 1: bookShowing
```json
{
  "name": "bookShowing",
  "description": "Book a property showing appointment",
  "parameters": {
    "type": "object",
    "properties": {
      "propertyId": {
        "type": "string",
        "description": "Property ID (e.g., AZ-FLAG-001)"
      },
      "propertyName": {
        "type": "string",
        "description": "Full property name"
      },
      "callerName": {
        "type": "string",
        "description": "Name of person booking"
      },
      "callerPhone": {
        "type": "string",
        "description": "Phone number for confirmation"
      },
      "preferredDate": {
        "type": "string",
        "description": "Preferred date (e.g., Friday)"
      },
      "preferredTime": {
        "type": "string",
        "description": "Preferred time (e.g., 2pm)"
      }
    },
    "required": ["propertyId", "propertyName", "callerName", "callerPhone", "preferredDate"]
  }
}
```

#### Function 2: transferToHuman
```json
{
  "name": "transferToHuman",
  "description": "Transfer call to human agent",
  "parameters": {
    "type": "object",
    "properties": {
      "callerName": {
        "type": "string",
        "description": "Name of caller"
      },
      "callerPhone": {
        "type": "string",
        "description": "Caller's phone number"
      },
      "reason": {
        "type": "string",
        "description": "Reason for transfer"
      },
      "demoCompleted": {
        "type": "boolean",
        "description": "Did they complete the demo?"
      }
    },
    "required": ["callerName", "callerPhone"]
  }
}
```

#### Function 3: getPropertyDetails
```json
{
  "name": "getPropertyDetails",
  "description": "Get detailed property information",
  "parameters": {
    "type": "object",
    "properties": {
      "propertyId": {
        "type": "string",
        "description": "Property ID to look up"
      }
    },
    "required": ["propertyId"]
  }
}
```

- [ ] Click **Save Functions**

### 1.8 Get Vapi Phone Number

- [ ] Go to **"Phone Numbers"** tab
- [ ] Click **"Buy Number"**
- [ ] Select area code: **+1-928** (Arizona)
- [ ] Buy a number (cost ~$1-2/month)
- [ ] Assign to: **EbookGov-Demo-AZ** assistant
- [ ] **COPY THIS NUMBER** - you'll need it for:
  - Demo website
  - Testing
  - Webhook configuration

**Your Vapi Number:** `+1-928-XXXXXXX` ← Save this!

### 1.9 Configure Webhook

- [ ] In Vapi Dashboard, go to **Settings** → **Webhooks**
- [ ] Webhook URL: `https://your-domain.com/api/vapi/webhook`
  - (You'll get this after deploying webhook in Phase 3)
- [ ] Enable events:
  - ✅ `function-call`
  - ✅ `end-of-call-report`
  - ✅ `transcript`
  - ✅ `hang`
- [ ] Click **Save**

**Status:** Leave as "pending" until webhook is deployed

---

## Phase 2: TextNow Setup (5 minutes)

### 2.1 Create TextNow Account

- [ ] Go to **textnow.com**
- [ ] Click **"Get Started"**
- [ ] Sign up with email
- [ ] Verify email
- [ ] You'll get assigned a free US phone number

### 2.2 Get Your TextNow Number

- [ ] Download TextNow app (iOS or Android)
- [ ] Log in with your account
- [ ] Go to **Settings** → **Account**
- [ ] Find your phone number
- [ ] **COPY THIS NUMBER** (format: +1-XXXXXXXXX)

**Your TextNow Number:** `+1-XXX-XXX-XXXX` ← Save this!

### 2.3 Install App on Phone

- [ ] Download TextNow app to your smartphone
- [ ] Log in
- [ ] Keep app installed and logged in
- [ ] Optional: Enable notifications so you see incoming transfers

### 2.4 Configure TextNow for Calls

- [ ] In app: **Settings** → **Notifications**
- [ ] Enable:
  - ✅ Call notifications
  - ✅ Incoming call alerts
- [ ] Keep app in foreground during demos (or allow background running)

---

## Phase 3: Webhook Deployment (10-15 minutes)

### 3.1 Prepare Your Server

Choose one:

**Option A: Heroku (Easiest)**
```bash
# Prerequisites: Heroku account (free tier available)
# Install Heroku CLI

heroku login
cd your-project-directory
git init
git add .
git commit -m "Initial commit"
heroku create your-app-name
heroku config:set TEXTNOW_PHONE=+1XXXXXXXXXX
heroku config:set VAPI_PHONE_NUMBER=+1928XXXXXXX
git push heroku main

# Your webhook URL will be:
# https://your-app-name.herokuapp.com/api/vapi/webhook
```

**Option B: Your Own Server**
```bash
ssh user@your-domain.com
cd /var/www
git clone your-repo
cd your-repo
npm install
npm install -g pm2
pm2 start server.js
pm2 startup
pm2 save

# Configure nginx reverse proxy to route:
# https://your-domain.com/api/vapi/webhook → localhost:3000
```

**Option C: AWS Lambda**
```bash
npm install -g serverless
serverless deploy

# Get your endpoint URL from serverless output
```

### 3.2 Create .env File

Create file: `.env`

```env
# Server
PORT=3000
NODE_ENV=production

# Your Phone Numbers
VAPI_PHONE_NUMBER=+1928XXXXXXX
TEXTNOW_PHONE=+1XXXXXXXXXX

# Webhook Security
WEBHOOK_SECRET=your_secure_random_string_here

# API Keys (if using external services)
VAPI_API_KEY=pa_your_vapi_key
```

### 3.3 Copy Webhook Code

- [ ] Copy code from **04-webhook-implementation.md**
- [ ] Save as `server.js` in your project
- [ ] Ensure Node.js and npm are installed
- [ ] Run: `npm install express axios dotenv body-parser cors`

### 3.4 Test Webhook Locally

```bash
# Start local server
npm start

# In another terminal, test with curl:
curl -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "functionCall": {
      "name": "bookShowing",
      "parameters": {
        "propertyId": "AZ-FLAG-001",
        "propertyName": "Mountain View Ranch",
        "callerName": "Test User",
        "callerPhone": "602-555-1234",
        "preferredDate": "Friday",
        "preferredTime": "2pm"
      }
    }
  }'

# You should get a success response with booking details
```

### 3.5 Deploy Webhook

- [ ] Deploy to Heroku, AWS Lambda, or your server
- [ ] Test that webhook is accessible at public URL
- [ ] Verify endpoint returns 200 status

**Your Webhook URL:** `https://your-domain.com/api/vapi/webhook` ← Save this!

### 3.6 Update Vapi Dashboard

- [ ] Go back to Vapi Dashboard
- [ ] Settings → **Webhooks**
- [ ] Enter webhook URL: `https://your-domain.com/api/vapi/webhook`
- [ ] Click **Save**

---

## Phase 4: Demo Website Setup (5 minutes)

### 4.1 Get Demo Website Code

- [ ] Copy HTML from **05-demo-website.html**

### 4.2 Update Phone Number

In the JavaScript section at bottom of HTML:

```javascript
// CHANGE THIS LINE:
const VAPI_PHONE_NUMBER = '+1928XXXXXXX'; // Your Vapi phone number
```

Replace with your actual Vapi phone number from Step 1.8

### 4.3 Deploy Website

**Option A: GitHub Pages (Free)**
```bash
git add 05-demo-website.html
git commit -m "Add demo website"
git push origin main

# Enable GitHub Pages in repo settings
# Your site: https://username.github.io/repo-name
```

**Option B: Your Domain**
```bash
# Copy to your web server
scp 05-demo-website.html user@your-domain.com:/var/www/html/demo/

# Access at: https://your-domain.com/demo/
```

**Option C: Netlify (Free)**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir .
```

### 4.4 Test Website

- [ ] Open demo website in browser
- [ ] Verify all 5 properties display correctly
- [ ] Click "Call Agent" on one property
- [ ] Your phone should initiate a call dialer

---

## Phase 5: Live Testing (10 minutes)

### 5.1 Test Incoming Call Flow

- [ ] Call your Vapi phone number
- [ ] Wait for Emma (AI agent) to answer
- [ ] Verify AI disclosure is given immediately
- [ ] Ask: "What properties do you have?"
- [ ] Emma should list the 5 properties

### 5.2 Test Booking Flow

- [ ] Say: "I want to see Mountain View Ranch"
- [ ] Provide your name when asked
- [ ] Provide a phone number when asked
- [ ] Provide a preferred date/time
- [ ] Emma should confirm booking
- [ ] **Check logs:** Webhook should have logged the booking

**Expected logs:**
- Booking ID created
- Property ID, name, caller info stored
- Confirmation returned

### 5.3 Test Transfer Flow

- [ ] Call Vapi number again
- [ ] Book another property
- [ ] Say: "Can I talk to someone about pricing?"
- [ ] Emma should say she's transferring you
- [ ] **Your TextNow phone should ring** within 2-3 seconds
- [ ] Answer the call
- [ ] You should hear the demo caller

### 5.4 Verify Booking Storage

- [ ] Check your webhook logs: `tail -f bookings.log`
- [ ] Or visit: `https://your-domain.com/api/bookings`
- [ ] Should show list of all demo bookings

### 5.5 Run Full Demo

- [ ] Call Vapi number from your cell
- [ ] Go through entire flow:
  1. Listen to AI disclosure
  2. Ask about properties
  3. Select property
  4. Provide your name and phone
  5. Schedule showing
  6. Request transfer
  7. Receive transfer on TextNow
  8. Complete conversation

---

## Phase 6: Go Live (Final Checks)

### 6.1 Pre-Launch Checklist

- [ ] Vapi phone number is publicly available (from demo website)
- [ ] System prompt is installed and tested
- [ ] Functions are correctly configured
- [ ] Webhook is deployed and responding
- [ ] TextNow account is active and app is installed
- [ ] Demo website is accessible
- [ ] All logs are being recorded (bookings.log, transfers.log)
- [ ] You can receive calls on TextNow throughout demo period

### 6.2 Set Phone Availability

- [ ] Have TextNow app open during demo period
- [ ] Or keep phone nearby and enable notifications
- [ ] Test a few more incoming transfers
- [ ] Verify audio quality is clear

### 6.3 Monitor Performance

Keep these open during demos:
- [ ] Webhook logs: `tail -f bookings.log`
- [ ] Vapi Dashboard: Monitor call metrics
- [ ] TextNow app: Monitor incoming transfers

### 6.4 Document Results

- [ ] Record total calls received
- [ ] Record bookings captured
- [ ] Record transfers completed
- [ ] Note any issues or improvements needed
- [ ] Save demo call recordings (if Vapi provides)

---

## Troubleshooting During Setup

### Problem: Vapi phone number not receiving calls
- [ ] Verify phone number is assigned to assistant
- [ ] Check Vapi dashboard shows number as active
- [ ] Try calling from different phone
- [ ] Check Vapi call logs for errors

### Problem: Webhook not receiving function calls
- [ ] Verify webhook URL in Vapi matches your deployment
- [ ] Test curl command from your server (should return 200)
- [ ] Check server logs for incoming requests
- [ ] Verify firewall allows HTTPS traffic (port 443)

### Problem: Transfer not ringing TextNow phone
- [ ] Verify TextNow app is installed and logged in
- [ ] Check TextNow phone is on same WiFi/cellular network
- [ ] Check TextNow SIP settings are enabled
- [ ] Restart TextNow app
- [ ] Test curl command with your TextNow number to verify webhook

### Problem: Bookings not being saved
- [ ] Check webhook logs for errors
- [ ] Verify `bookings.log` file exists and is writable
- [ ] Check database connection if using external DB
- [ ] Verify all required parameters are being passed from Vapi

### Problem: Emma (AI) sounds robotic or weird
- [ ] Try different 11Labs voice ID
- [ ] Adjust stability/similarity settings
- [ ] Test with different LLM (Cerebras vs GPT-4)
- [ ] Increase max tokens for longer responses

---

## Success Indicators

✅ **Setup Complete When:**
- Vapi phone answers with Emma's voice
- Emma identifies as AI in first message
- Emma answers property questions correctly
- bookShowing function stores bookings
- transferToHuman transfers call to your TextNow phone
- Demo website displays all 5 properties
- Real estate agents can book showing through AI
- You receive transfers and can complete sales conversations

---

## Post-Launch Optimization

After initial tests, optimize:

1. **Fine-tune system prompt** if Emma doesn't sound natural
2. **Adjust model temperature** if responses are too random/robotic
3. **Add more properties** to knowledge base
4. **Improve webhook logging** for better analytics
5. **Set up email notifications** when bookings occur
6. **Create admin dashboard** to view bookings in real-time

---

**Estimated Total Time: 30-45 minutes**

Proceed to **08-troubleshooting.md** if you hit any issues during setup.

---

**Version:** 1.0  
**Last Updated:** January 14, 2026
