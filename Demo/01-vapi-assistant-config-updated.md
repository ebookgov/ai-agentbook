# Vapi Assistant Configuration - Complete Setup

## Quick Reference: What to Configure in Vapi Dashboard

Copy each section into the corresponding Vapi field.

---

## Section 1: Basic Info

```
Name: EbookGov-Demo-AZ
Description: AI Booking Agent for Rural Arizona Properties Demo
Type: Outbound/Inbound
```

---

## Section 2: Voice Configuration

In Vapi Dashboard → **Settings** → **Voice**

```json
{
  "provider": "11labs",
  "voiceId": "21m00Tcm4TlvDq8ikWAM",
  "stability": 0.5,
  "similarityBoost": 0.75
}
```

**Alternative Voices:**
- `ErXwobaYiN019PkySvjV` - Antoni (professional male)
- `pNInz6obpgDQGcFmaJgB` - Adam (deep trustworthy male)

---

## Section 3: LLM Model Configuration

### Option A: FAST & CHEAP (Recommended for Demo)

```json
{
  "provider": "cerebras",
  "model": "llama-3.3-70b",
  "temperature": 0.7,
  "maxTokens": 500
}
```

**Pros:** Fast responses (0.5-1s), cheap (~$0.001/1k tokens)  
**Cons:** Slightly less conversational

### Option B: BEST QUALITY (More Natural)

```json
{
  "provider": "openai",
  "model": "gpt-4-turbo",
  "temperature": 0.7,
  "maxTokens": 500
}
```

**Pros:** Most natural responses  
**Cons:** Slower (1-3s), more expensive (~$0.01/1k tokens)

---

## Section 4: Transcription Configuration

In Vapi Dashboard → **Settings** → **Transcriber**

```json
{
  "provider": "deepgram",
  "model": "nova-2",
  "language": "en-US",
  "encoding": "linear16",
  "sampleRateHertz": 16000
}
```

---

## Section 5: First Message

In Vapi Dashboard → **Settings** → **First Message**

```
Hi, this is Emma from EbookGov. I need to let you know upfront 
that I'm an AI assistant. I'm here to help you explore our rural 
Arizona properties and book showings. Are you interested in 
checking out a specific property, or would you like me to tell you 
what we have available?
```

**Notes:**
- This is played immediately when caller picks up
- Must include AI disclosure (FCC TCPA requirement)
- Should be 15-20 seconds at normal speaking pace
- Use professional, warm tone

---

## Section 6: System Prompt

In Vapi Dashboard → **Settings** → **System Prompt**

Copy and paste the **ENTIRE** prompt from `02-system-prompt-updated.md`

**Do NOT:**
- Cut it short
- Summarize it
- Remove sections
- Edit it significantly

**Key sections the prompt includes:**
- ✅ FCC TCPA AI disclosure requirements
- ✅ Mandatory human transfer request handling
- ✅ 5 property knowledge base
- ✅ Conversation flow guidelines
- ✅ Function calling instructions
- ✅ Prohibited behaviors

---

## Section 7: Function Definitions

In Vapi Dashboard → **Functions** tab, add these three functions.

### Function 1: bookShowing

```json
{
  "name": "bookShowing",
  "description": "Book a property showing appointment for a caller",
  "parameters": {
    "type": "object",
    "properties": {
      "propertyId": {
        "type": "string",
        "description": "The property ID (e.g., AZ-FLAG-001)"
      },
      "propertyName": {
        "type": "string",
        "description": "Full property name for confirmation"
      },
      "callerName": {
        "type": "string",
        "description": "Name of person requesting the showing"
      },
      "callerPhone": {
        "type": "string",
        "description": "Phone number for confirmation SMS/call"
      },
      "preferredDate": {
        "type": "string",
        "description": "Preferred date (e.g., Friday, tomorrow, etc.)"
      },
      "preferredTime": {
        "type": "string",
        "description": "Preferred time (e.g., 2pm, afternoon, morning)"
      }
    },
    "required": ["propertyId", "propertyName", "callerName", "callerPhone", "preferredDate"]
  }
}
```

### Function 2: transferToHuman

```json
{
  "name": "transferToHuman",
  "description": "Transfer the call to a human agent (on caller request or strong interest)",
  "parameters": {
    "type": "object",
    "properties": {
      "callerName": {
        "type": "string",
        "description": "Name of the caller being transferred"
      },
      "callerPhone": {
        "type": "string",
        "description": "Phone number of caller for callback"
      },
      "reason": {
        "type": "string",
        "description": "Reason for transfer (e.g., 'Wants to discuss pricing')"
      },
      "demoCompleted": {
        "type": "boolean",
        "description": "Boolean - did they complete a booking demo?"
      }
    },
    "required": ["callerName", "callerPhone"]
  }
}
```

### Function 3: getPropertyDetails

```json
{
  "name": "getPropertyDetails",
  "description": "Retrieve detailed information about a specific property",
  "parameters": {
    "type": "object",
    "properties": {
      "propertyId": {
        "type": "string",
        "description": "The property ID to look up (e.g., AZ-FLAG-001)"
      }
    },
    "required": ["propertyId"]
  }
}
```

---

## Section 8: Webhook Configuration

In Vapi Dashboard → **Settings** → **Webhooks**

**Webhook URL:**
```
https://your-domain.com/api/vapi/webhook
```

Replace `your-domain.com` with your actual deployment domain.

**Events to enable:**
- ✅ `function-call` (when AI calls a function)
- ✅ `end-of-call-report` (call summary)
- ✅ `transcript` (full conversation text)
- ✅ `hang` (call ended)

**Webhook Request Format (FYI):**
```json
{
  "callId": "unique-call-id",
  "functionCall": {
    "id": "function-call-id",
    "name": "bookShowing",
    "parameters": {
      "propertyId": "AZ-FLAG-001",
      "propertyName": "Mountain View Ranch",
      "callerName": "John Smith",
      "callerPhone": "+1-602-555-1234",
      "preferredDate": "Friday",
      "preferredTime": "2pm"
    }
  }
}
```

**Expected Response Format:**
```json
{
  "success": true,
  "message": "Booking confirmed",
  "bookingId": "BOOKING-1234567890",
  "confirmationText": "Your showing for [property] on [date] at [time] has been confirmed."
}
```

---

## Section 9: Phone Number Configuration

In Vapi Dashboard → **Phone Numbers** tab

**Steps:**
1. Click **"Buy Number"**
2. Select area code: **+1-928** (Arizona)
3. Complete purchase
4. Assign to: **EbookGov-Demo-AZ** assistant

**Your number format:** `+1-928-XXXX-XXX`

**Save this number!** You'll need it for:
- Demo website (callButton links)
- Testing
- Sharing with real estate agents

---

## Section 10: Advanced Settings

In Vapi Dashboard → **Advanced Settings**

```json
{
  "silenceTimeoutSeconds": 30,
  "maxDurationSeconds": 600,
  "backgroundSound": "off",
  "backchannelingEnabled": true,
  "responseDelaySeconds": 0,
  "llmRequestDelaySeconds": 0,
  "interruptionsEnabled": true,
  "endCallFunctionEnabled": true,
  "recordingEnabled": true,
  "transcriptionEnabled": true
}
```

**Settings Explained:**
- `silenceTimeoutSeconds: 30` - End call after 30 seconds of silence
- `maxDurationSeconds: 600` - Max 10 minutes per call
- `backgroundSound: off` - Don't add background ambience
- `backchannelingEnabled: true` - Allow AI to make filler sounds (mm-hmm)
- `responseDelaySeconds: 0` - No delay before response (lowest latency)
- `llmRequestDelaySeconds: 0` - No delay before LLM request (lowest latency)
- `interruptionsEnabled: true` - Caller can interrupt AI mid-sentence
- `endCallFunctionEnabled: true` - Allow function to end call
- `recordingEnabled: true` - Record all calls for compliance/review
- `transcriptionEnabled: true` - Get transcripts of calls

---

## Complete Assistant Configuration JSON

Once fully configured, your Vapi assistant should export as:

```json
{
  "id": "assistant-id-here",
  "name": "EbookGov-Demo-AZ",
  "description": "AI Booking Agent for Rural Arizona Properties Demo",
  "voice": {
    "provider": "11labs",
    "voiceId": "21m00Tcm4TlvDq8ikWAM",
    "stability": 0.5,
    "similarityBoost": 0.75
  },
  "model": {
    "provider": "cerebras",
    "model": "llama-3.3-70b",
    "temperature": 0.7,
    "maxTokens": 500
  },
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "en-US"
  },
  "firstMessage": "Hi, this is Emma from EbookGov. I need to let you know upfront that I'm an AI assistant...",
  "systemPrompt": "[Full system prompt from 02-system-prompt-updated.md]",
  "functions": [
    {
      "name": "bookShowing",
      "description": "Book a property showing appointment...",
      "parameters": {...}
    },
    {
      "name": "transferToHuman",
      "description": "Transfer call to human agent...",
      "parameters": {...}
    },
    {
      "name": "getPropertyDetails",
      "description": "Get detailed property info...",
      "parameters": {...}
    }
  ],
  "webhookUrl": "https://your-domain.com/api/vapi/webhook",
  "phoneNumber": "+1-928-XXXXXXX",
  "settings": {
    "silenceTimeoutSeconds": 30,
    "maxDurationSeconds": 600,
    "recordingEnabled": true,
    "transcriptionEnabled": true
  }
}
```

---

## Copy-Paste Checklist

Before going live, verify each field is set:

- [ ] **Name:** `EbookGov-Demo-AZ`
- [ ] **Voice Provider:** `11labs`
- [ ] **Voice ID:** `21m00Tcm4TlvDq8ikWAM`
- [ ] **Model Provider:** `cerebras` (or `openai`)
- [ ] **Model:** `llama-3.3-70b` (or `gpt-4-turbo`)
- [ ] **Temperature:** `0.7`
- [ ] **Max Tokens:** `500`
- [ ] **Transcriber:** `deepgram`
- [ ] **First Message:** [exact text provided]
- [ ] **System Prompt:** [complete prompt from document]
- [ ] **Function 1:** `bookShowing` (JSON valid)
- [ ] **Function 2:** `transferToHuman` (JSON valid)
- [ ] **Function 3:** `getPropertyDetails` (JSON valid)
- [ ] **Webhook URL:** `https://your-domain.com/api/vapi/webhook`
- [ ] **Phone Number:** Assigned and active
- [ ] **Silence Timeout:** `30` seconds
- [ ] **Max Duration:** `600` seconds (10 min)

---

## Testing Configuration

Once all settings are in Vapi:

```bash
# Test incoming call
dial your Vapi phone number

# Verify Emma answers with AI disclosure
# Listen: "Hi, this is Emma from EbookGov. I need to let you know upfront that I'm an AI assistant..."

# If yes → Configuration is correct
# If no → Check system prompt and first message
```

---

## Common Configuration Mistakes

❌ **Don't Do:**
- Copy prompt from email (formatting breaks)
- Edit system prompt (remove key sections)
- Use wrong voice ID (copy exact)
- Leave webhook URL as placeholder
- Forget to assign phone number
- Use HTTP instead of HTTPS for webhook

✅ **Do:**
- Copy exact text from markdown files
- Keep all prompt sections intact
- Test each setting as you go
- Save phone number in Notes
- Use HTTPS for webhook
- Verify JSON syntax for functions

---

## Support Resources

- **Vapi Docs:** https://docs.vapi.ai/getting-started
- **11Labs Voices:** https://elevenlabs.io/voice-lab
- **Cerebras API:** https://api.cerebras.ai
- **Deepgram Models:** https://developers.deepgram.com/docs/models-and-tiers

---

**Version:** 2.0 (Updated for TextNow Transfer)  
**Last Updated:** January 14, 2026

After completing this configuration, proceed to **07-implementation-checklist.md** for deployment steps.
