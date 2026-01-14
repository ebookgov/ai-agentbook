# TextNow Free Call Transfer Integration Guide

## What is TextNow?

TextNow is a free VoIP service that gives you a US phone number without a contract. Critical for your demo: **TextNow supports SIP REFER**, which means your Vapi AI agent can transfer calls to your TextNow number at zero additional cost.

**Cost:** FREE (no charges for receiving transferred calls)

---

## Step 1: Create TextNow Account

1. Go to **textnow.com**
2. Click **"Get Started"** or **"Download App"**
3. Sign up with email (free account)
4. You'll be assigned a free US phone number (e.g., +1-555-XXX-XXXX)
5. Download TextNow app on your phone (iOS/Android)

**Important:** Choose an Arizona area code (+1-602, +1-480, +1-928, etc.) to match your demo property location.

---

## Step 2: Get Your TextNow Phone Number

After signing up:

1. Open TextNow app
2. Go to **Settings** → **Account**
3. Find your assigned phone number
4. This is the number Vapi will transfer calls to
5. Format: `+1XXXXXXXXXX` (e.g., +1-602-555-1234)

**Keep this number handy!** You'll need it for webhook configuration.

---

## Step 3: Configure TextNow for SIP

TextNow supports SIP receiving, which is how Vapi will route calls:

1. In TextNow app: **Settings** → **VoIP/SIP Settings**
2. Enable **"SIP Protocol"** (if available)
3. Note your SIP server: `voip.textnow.com`
4. Your SIP address will be: `sip:+1XXXXXXXXXX@voip.textnow.com`

**Note:** TextNow automatically handles SIP registration. You don't need to manually configure it in most cases.

---

## Step 4: Configure Webhook for TextNow Transfer

In your webhook server (04-webhook-implementation.md), update the `transferToHuman` function:

```javascript
async function handleTransferToHuman(parameters, res) {
  const { callerName, callerPhone, reason } = parameters;

  // Get TextNow phone from environment
  const textNowPhone = process.env.TEXTNOW_PHONE; // e.g., +1-602-555-1234

  // Return SIP transfer instruction to Vapi
  return res.json({
    success: true,
    message: 'Transferring to human agent',
    transferId: `TRANSFER-${Date.now()}`,
    transferMethod: 'sip',
    // SIP REFER format for TextNow
    transferTarget: `sip:${textNowPhone.replace(/[^0-9]/g, '')}@voip.textnow.com`,
    ringTimeout: 30,
    maxCallDuration: 600
  });
}
```

---

## Step 5: Add TextNow Number to Environment Variables

In your `.env` file:

```env
# TextNow Configuration
TEXTNOW_PHONE=+1602XXXXXXX
TEXTNOW_SIP_SERVER=voip.textnow.com
```

Replace `+1602XXXXXXX` with your actual TextNow phone number.

---

## Step 6: Test Transfer Flow

### Test Scenario 1: Local Testing

```bash
# Start your webhook server
npm start

# In another terminal, simulate Vapi function call
curl -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "functionCall": {
      "name": "transferToHuman",
      "parameters": {
        "callerName": "John Smith",
        "callerPhone": "+1-602-555-1234",
        "reason": "Interested in EbookGov service"
      }
    }
  }'

# Response should show SIP transfer target
```

### Test Scenario 2: Live Demo Call

1. **Call your Vapi number** (from demo website)
2. **Say:** "Transfer me to a human" or "Let's talk with your team"
3. **Emma (AI) responds:** "Let me transfer you now..."
4. **Your phone (TextNow) rings** within 2-3 seconds
5. **Answer the call** - you're now speaking with the demo caller
6. **Close the sale!**

---

## How It Works: Technical Flow

```
┌─────────────────────────────────────┐
│ 1. Caller dials Vapi number         │
│    (real estate agent)              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Vapi answers with Emma (AI)      │
│    Agent talks to Emma              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Agent books property + says       │
│    "Transfer me to discuss pricing" │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. Emma calls transferToHuman()     │
│    function via webhook             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. Webhook responds with SIP        │
│    REFER to TextNow number          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 6. Vapi sends SIP REFER to TextNow  │
│    voip.textnow.com infrastructure  │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│ 7. YOUR PHONE (TextNow app)  │
│    rings with incoming call  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ 8. YOU answer                │
│    Connected to prospect     │
└──────────────────────────────┘
```

**Total Transfer Time:** 2-3 seconds  
**Cost:** FREE (TextNow handles the transfer)

---

## TextNow Settings for Optimal Transfer

### Enable Notifications

1. **TextNow App** → **Settings** → **Notifications**
2. Enable:
   - ✅ Call notifications
   - ✅ Incoming call alerts
   - ✅ Pop-up notifications

This way, you'll see every incoming transfer immediately.

### Keep App Active

- TextNow must be running in the background
- For best results: keep app open during demo period
- If app closes, most recent transfer still comes through (via SMS alert)

### WiFi Calling (Backup)

If SIP transfer doesn't work (rare):

1. Go to **Settings** → **Network**
2. Enable **"WiFi Calling"**
3. TextNow will fall back to WiFi VoIP if needed

---

## Troubleshooting TextNow Transfer

### Issue: Transfer doesn't ring your phone

**Checklist:**
- [ ] TextNow app is installed and logged in
- [ ] App is in foreground or background (not fully closed)
- [ ] Your phone has internet connection (WiFi or data)
- [ ] TextNow phone number is correctly entered in `.env`
- [ ] Webhook server is running and accessible
- [ ] Check webhook logs: was `transferToHuman` called?

**Test Fix:**
```javascript
// Add logging to webhook
async function handleTransferToHuman(parameters, res) {
  console.log(`TRANSFER ATTEMPT: Phone=${process.env.TEXTNOW_PHONE}`);
  console.log(`Caller: ${parameters.callerName}`);
  console.log(`SIP Target: sip:${process.env.TEXTNOW_PHONE}@voip.textnow.com`);
  
  // rest of function...
}
```

### Issue: Transfer rings but audio is silent

- [ ] Check TextNow app volume (not muted)
- [ ] Check phone volume (not silent mode)
- [ ] Try closing and reopening TextNow app
- [ ] Check phone internet connection (4G/LTE or WiFi)

### Issue: Transfer takes more than 5 seconds

- [ ] Check server response time (should be <100ms)
- [ ] Verify WebSocket is established between Vapi and your server
- [ ] Check TextNow app responsiveness
- [ ] Restart TextNow app and try again

### Issue: Multiple calls transferring at once

TextNow free version handles 1 active call at a time. If you want to:
- Demo to multiple agents simultaneously → Use free Vapi phone number instead (caller just calls you directly)
- Demo to single agent only → TextNow free tier is perfect

---

## Advanced: Multiple TextNow Numbers

If you want multiple team members to receive transfers:

1. **Create separate TextNow accounts** for each team member
2. **In webhook, route calls to different numbers based on parameter:**

```javascript
async function handleTransferToHuman(parameters, res) {
  let transferPhone = process.env.TEXTNOW_PHONE; // default
  
  // Route based on reason or time of day
  if (parameters.reason.includes('urgent')) {
    transferPhone = process.env.TEXTNOW_PHONE_SALES; // sales team
  } else if (parameters.reason.includes('support')) {
    transferPhone = process.env.TEXTNOW_PHONE_SUPPORT; // support team
  }

  return res.json({
    success: true,
    transferMethod: 'sip',
    transferTarget: `sip:${transferPhone}@voip.textnow.com`
  });
}
```

---

## Alternative: Direct Transfer (No TextNow)

If you prefer, Vapi can also transfer directly to your personal number:

```javascript
// Transfer to any SIP-compatible service
const myPhoneNumber = '+16025551234'; // your personal number (SIP-enabled)
const transferTarget = `sip:${myPhoneNumber}@sip.provider.com`;
```

However, this requires a paid SIP service. **TextNow is free and simpler.**

---

## Security Notes

**Your TextNow number will appear on caller ID:**
- Callers see your TextNow number, not Vapi's
- This creates trust: they're calling "the real agent"
- No additional security risk

**Do NOT share webhook URL publicly:**
- Keep webhook URL secret (it's in your `.env`)
- Use HTTPS only (never HTTP)
- Add simple token validation if needed

---

## Cost Comparison

| Service | Monthly Cost | Transfer Support | Setup Time |
|---------|--------------|------------------|------------|
| **TextNow** (Recommended) | FREE | Free SIP REFER | 5 minutes |
| Twilio | $10-20 | Paid | 15 minutes |
| Traditional VoIP | $20-50 | Included | 30+ minutes |
| Vonage/Nexmo | $15-30 | Included | 20 minutes |

**Winner:** TextNow (free + simple)

---

## Next Steps

1. ✅ Sign up for TextNow account
2. ✅ Get your TextNow number
3. ✅ Add number to `.env` file
4. ✅ Deploy webhook server (04-webhook-implementation.md)
5. ✅ Test with demo call
6. ✅ Go live with real estate agent demos

---

**Version:** 1.0  
**Last Updated:** January 14, 2026

When ready, proceed to **05-demo-website.html** to create the property listing page that generates calls.
