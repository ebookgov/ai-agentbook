# EbookGov AI Voice Agent 🤖📞

> **24/7 AI appointment booking agent for Arizona rural real estate**

Live Demo: **+1 (928) 723-0429** | [Try it now](tel:+19287230429)

---

## 🎯 What Is This?

An enterprise-grade AI voice agent (powered by Vapi.ai) that books property showings for real estate agents in rural Arizona. The agent handles:

- ✅ Property inquiries across 5 demo listings
- ✅ Natural conversation with human-like responses
- ✅ Appointment scheduling (no calendar validation)
- ✅ Seamless human transfer when requested
- ✅ FCC TCPA compliant AI disclosure

**Use Case:** Demonstrates AI booking capabilities to real estate professionals considering EbookGov's service.

---

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Caller    │─────▶│  Vapi Squad  │─────▶│  Webhook    │
│ (Phone/Web) │      │  (4 Agents)  │      │  Server     │
└─────────────┘      └──────────────┘      └─────────────┘
                            │                      │
                            │                      ▼
                            │              ┌──────────────┐
                            └─────────────▶│  Supabase    │
                                           │  (Database)  │
                                           └──────────────┘
```

### Tech Stack

| Component | Technology |
|-----------|------------|
| **Voice Platform** | Vapi.ai (Squad architecture with 4 specialized assistants) |
| **LLM Provider** | Cerebras (llama-3.3-70b) - ultra-low latency |
| **Backend** | Node.js + Express (webhook server) |
| **Database** | Supabase (PostgreSQL) |
| **Voice Provider** | 11Labs (Rachel voice) + Deepgram (transcription) |
| **Deployment** | Render.com (webhook), Vapi cloud (voice) |
| **Payments** | PayPal Subscriptions API |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Vapi.ai account ([vapi.ai](https://vapi.ai))
- Supabase project ([supabase.com](https://supabase.com))
- PayPal Developer account (for subscriptions)

### 1. Clone & Install

```bash
git clone https://github.com/ebookgov/ai-agentbook.git
cd ai-agentbook
npm install
cd webhook && npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required variables:

- `VAPI_API_KEY` - From Vapi.ai dashboard
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `PAYPAL_CLIENT_ID` - PayPal app credentials
- `PAYPAL_CLIENT_SECRET` - PayPal app secret

### 3. Set Up Database

```bash
# Run Supabase migrations
cd supabase
supabase db push
```

### 4. Deploy Squad

```bash
cd vapi
node create-squad-v2.js
# Copy the squad ID to squad-id.txt
```

### 5. Run Webhook Server

```bash
cd webhook
npm run dev
# Server starts on http://localhost:3000
```

### 6. Test the Agent

Call the demo line: **+1 (928) 723-0429**

Or use the Vapi dashboard test button.

---

## 📚 Documentation

| Guide | Description |
|-------|-------------|
| [Setup Overview](Demo/00-setup-overview.md) | Complete setup walkthrough |
| [System Prompt](Demo/02-system-prompt-updated.md) | AI behavior configuration |
| [Webhook Implementation](Demo/04-webhook-implementation.md) | Backend logic explained |
| [Implementation Checklist](Demo/07-implementation-checklist.md) | Deployment steps |
| [Developer Handoff](Demo/DEVELOPER_HANDOFF.md) | Quick reference for devs |

---

## 🎤 The AI Squad

**4 specialized assistants working together:**

| Assistant | Role | Triggers |
|-----------|------|----------|
| **Emma-Greeter** | Initial contact, AI disclosure, qualification | First message |
| **Emma-PropertySpecialist** | Answers property questions, provides details | Property interest |
| **Emma-BookingSpecialist** | Collects info, books showing, pitches service | "Book a showing" |
| **Emma-TransferSpecialist** | Transfers to human agent | "Speak to human" |

Each assistant hands off seamlessly to the next based on conversation flow.

---

## 🏡 Demo Properties

5 Arizona rural properties in the knowledge base:

| ID | Property | Price | Acreage |
|----|----------|-------|---------|
| AZ-FLAG-001 | Mountain View Ranch | $425,000 | 35 acres |
| AZ-FLAG-002 | Ponderosa Homestead | $289,000 | 20 acres |
| AZ-COC-001 | High Desert Retreat | $175,000 | 40 acres |
| AZ-NAV-001 | Red Rock Ranch | $549,000 | 80 acres |
| AZ-YAV-001 | Verde Valley Vineyard | $225,000 | 10 acres |

Full details in [demo-properties.md](web-pages/demo-properties.md)

---

## 🔧 Project Structure

```
ebookgov-ai-book/
├── vapi/                  # Vapi.ai configuration
│   ├── squad-config.json  # Squad definition (4 assistants)
│   └── create-squad-v2.js # Deployment script
│
├── webhook/               # Backend server
│   ├── server.js          # Express webhook handler
│   ├── security.js        # Auth & validation
│   └── Knowledge_Base_Implementation/ # Research docs
│
├── supabase/              # Database
│   ├── migrations/        # Schema migrations
│   └── functions/         # Edge functions
│
├── web-pages/             # Landing page content
│   ├── demo-properties.md
│   └── subscription-pricing.md
│
├── prompts/               # AI research & optimization
│   ├── PERPLEXITY_SPACE_AI_VOICE_KNOWLEDGE.md
│   └── GEMINI_GEM_VOICE_AI_CONFIG_GENERATOR.md
│
└── Demo/                  # Setup guides & documentation
```

---

## 📞 API Endpoints

### Webhook Server

```
POST /webhook/vapi
- Handles Vapi function calls (bookShowing, transferToHuman, getPropertyDetails)
- Validates requests, logs to Supabase

POST /webhook/paypal
- Processes PayPal subscription events
- Updates Supabase subscriptions table
```

---

## 🎨 Subscription Plans

| Plan | Price | Calls/Month | Target |
|------|-------|-------------|--------|
| **Starter** | $99/mo | 0-50 | Solo agents |
| **Growth** | $199/mo | 51-200 | Small teams |

PayPal subscription links in [subscription-pricing.md](web-pages/subscription-pricing.md)

---

## 🧪 Testing

Test scenarios in the artifacts directory:

- [AI Voice Squad Test Results](../brain/*.md) - 25 challenging questions
- Water rights questions (stumpers!)
- Edge cases like "February 30th" bookings

---

## 🚢 Deployment

### Webhook Server (Render.com)

```bash
# Deploy via Git push
git push render main

# Or use the deploy script
./deploy_function.ps1
```

### Vapi Squad

Already deployed to Vapi cloud. Squad ID: `0ef00dc9-1cd8-4bbc-8f27-df728a10f3be`

---

## 🤝 Contributing

This is a private project for EbookGov's internal use. For questions or issues:

- **Email:** <ebookgovern@gmail.com>
- **Vapi Dashboard:** [dashboard.vapi.ai](https://dashboard.vapi.ai)

---

## 📜 License

MIT License - See [LICENSE](LICENSE)

---

## 🔗 Links

- **Live Demo:** +1 (928) 723-0429
- **Webhook:** <https://ai-agentbook.onrender.com>
- **Supabase:** byllwcxvbxybaawrilec.supabase.co
- **GitHub:** github.com/ebookgov/ai-agentbook

---

Built with ❤️ in Flagstaff, AZ for Arizona real estate agents
