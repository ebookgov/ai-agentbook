# EbookGov AI Booking Agent - Developer Handoff

**Completion Date:** January 14, 2026  
**Status:** ✅ Production Ready  
**Demo Phone:** +1 (928) 723-0429

---

## System Overview

This is a voice AI booking agent for rural Arizona real estate, built on **Vapi.ai** with a multi-assistant "Squad" architecture for reduced latency and cost.

### Architecture Flow

```
Caller → Vapi Phone → Emma-Greeter → Emma-PropertySpecialist → Emma-BookingSpecialist
                                   ↘                        ↗
                                     Emma-TransferSpecialist → TextNow Transfer
```

---

## Quick Reference

| Component | Value |
|-----------|-------|
| **Phone** | +1 (928) 723-0429 |
| **Webhook** | <https://ai-agentbook.onrender.com/api/vapi/webhook> |
| **Squad ID** | 0ef00dc9-1cd8-4bbc-8f27-df728a10f3be |
| **Supabase** | byllwcxvbxybaawrilec |
| **GitHub** | ebookgov/ai-agentbook |

---

## Vapi Squad (4 Specialists)

| Assistant | Purpose | Functions |
|-----------|---------|-----------|
| **Emma-Greeter** | AI disclosure, qualification | Handoffs only |
| **Emma-PropertySpecialist** | Property info | `getPropertyDetails` |
| **Emma-BookingSpecialist** | Collect booking data | `bookShowing` |
| **Emma-TransferSpecialist** | Human transfer | `transferToHuman` |

---

## Key Files

```
ebookgov-ai-book/
├── vapi/
│   ├── squad-config.json      # Squad definition
│   ├── create-squad-v2.js     # Deployment script
│   └── assistant-config.json  # Legacy config
├── webhook/
│   ├── server.js              # Express webhook server
│   └── package.json           # Dependencies
├── supabase/
│   └── migrations/            # Database migrations
├── render.yaml                # Render deploy config
└── .env                       # Environment variables (not in repo)
```

---

## Environment Variables Required

```bash
SUPABASE_PROJECT_URL=https://byllwcxvbxybaawrilec.supabase.co
SUPABASE_ACCESS_SECRET_KEY=sb_secret_...
VAPI_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----
VAPI_PHONE_NUMBER=+19287230429
TEXT_NOW_PHONE_NUMBER=+1982985415
```

---

## Common Commands

```bash
# Update Squad (after config changes)
node vapi/create-squad-v2.js

# Test webhook health
curl https://ai-agentbook.onrender.com/health

# Deploy (auto via GitHub push)
git push origin main
```

---

## Scaling Roadmap

### Next Steps

1. Upgrade Render to paid tier ($7/mo) - avoids cold starts
2. Add error monitoring (Sentry)
3. Integrate Cal.com for real calendar booking
4. Add SMS follow-up after booking

### Future Features

- Multiple phone numbers per agent
- CRM integration (HubSpot, Salesforce)
- Agent onboarding portal
- Subscription billing (Lemon Squeezy)

---

## Known Limitations

| Issue | Mitigation |
|-------|------------|
| Render cold starts (30-50s) | Upgrade to paid or add warmup cron |
| No calendar validation | Integrate Cal.com |
| Single phone number | Purchase additional Vapi numbers |

---

## Dashboards

- **Vapi:** <https://dashboard.vapi.ai>
- **Supabase:** <https://supabase.com/dashboard/project/byllwcxvbxybaawrilec>
- **Render:** <https://dashboard.render.com>
- **GitHub:** <https://github.com/ebookgov/ai-agentbook>
