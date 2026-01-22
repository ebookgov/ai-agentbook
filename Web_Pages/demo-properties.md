# Manus Handoff: Avoxa AI Landing Page & Demo Website

## Project Overview

Build a **high-converting landing page** for Avoxa AI Appointment Booking - an AI receptionist service for Arizona real estate agents. The site must showcase demo properties and allow visitors to **click-to-call** the AI agent directly.

---

## Live Demo Phone Number

```
+1 (928) 723-0429
```

**Click-to-call format:** `tel:+19287230429`

---

## Brand Identity

| Element | Value |
|---------|-------|
| **Product Name** | Avoxa AI Appointment Booking |
| **Tagline** | Enterprise-grade AI receptionist for small Arizona real estate agencies |
| **Target Market** | Small real estate agencies in Flagstaff/Arizona |
| **Tone** | Professional, local, trustworthy, personal |
| **Owner Persona** | "Built by a one-man Flagstaff native serving small-town agents like you" |

---

## Pricing (PayPal Subscription Links)

| Plan | Price | Calls/Month | Subscribe Link |
|------|-------|-------------|----------------|
| **Starter** | $99/mo | 0-50 | `https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-62D43206TX584261TNFUQBJY` |
| **Growth** | $199/mo | 51-200 | `https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-0PH92736U6909683KNFUQBJY` |

**Promo Messaging:** "🔥 LAUNCH PROMO – First 3 Agencies Only. 50% OFF. Lifetime lock-in."

---

## Demo Properties (Display on Landing Page)

These properties should be displayed as cards. When a user clicks "Call About This Property", it triggers a call to the AI agent.

### Property 1: Mountain View Ranch - Flagstaff

- **ID:** AZ-FLAG-001
- **Price:** $425,000
- **Acreage:** 35 acres
- **Structure:** Log cabin (2 bed, 2 bath)
- **Location:** 15 miles east of Flagstaff
- **Highlights:** San Francisco Peaks views, Elk habitat, Dark sky location

### Property 2: Ponderosa Homestead

- **ID:** AZ-FLAG-002
- **Price:** $289,000
- **Acreage:** 20 acres
- **Structure:** Single family home (3 bed, 2 bath, 1800 sqft)
- **Location:** Williams, 25 min from Flagstaff
- **Highlights:** Ponderosa pine forest, 30 min to Grand Canyon

### Property 3: High Desert Retreat

- **ID:** AZ-COC-001
- **Price:** $175,000
- **Acreage:** 40 acres
- **Structure:** Raw land (cleared building site)
- **Location:** Parks, 20 miles west of Flagstaff
- **Highlights:** Dark sky certified, Owner financing available, No HOA

### Property 4: Red Rock Ranch

- **ID:** AZ-NAV-001
- **Price:** $549,000
- **Acreage:** 80 acres
- **Structure:** Adobe home (3 bed, 2 bath, 2200 sqft)
- **Location:** 15 miles south of Winslow
- **Highlights:** Working cattle ranch, Historic Route 66 access

### Property 5: Verde Valley Vineyard Lot

- **ID:** AZ-YAV-001
- **Price:** $225,000
- **Acreage:** 10 acres
- **Structure:** Ready to build (cleared pad, well installed)
- **Location:** Camp Verde, Central Verde Valley
- **Highlights:** Arizona wine country, Near Jerome and Sedona

---

## Page Structure

### Hero Section

- Headline: "Never Miss a Lead Again"
- Subheadline: "AI receptionist that books showings while you're showing homes"
- CTA Button: "Try the Demo – Call Now" → `tel:+19287230429`
- Trust badge: "Arizona AI Policy 2025 Compliant | Fair Housing Tested"

### Social Proof Section

- "+23 transactions for one agent vs. prior year"
- "5 Arizona agents, zero churn"
- "AI now indistinguishable from real receptionists"

### Demo Properties Section

- Grid of 5 property cards (use data above)
- Each card has "Call About This Property" button → `tel:+19287230429`
- Add property ID as a data attribute for tracking

### Features Section

- Dedicated AZ phone (480/602 area code)
- AI qualifies with LPMAMA methodology
- Instant Google Calendar bookings
- Caller confirmations + compliance logs
- AZ-native: Water rights, solar leases, title alerts auto-disclosed

### Pricing Section

- Display Starter ($99/mo) and Growth ($199/mo) cards
- "🔥 50% OFF - First 3 Agencies Only"
- PayPal Subscribe buttons

### How It Works

1. Claim promo spot
2. Pay via PayPal (instant invoice)
3. Connect Google Calendar (30 sec)
4. Get phone number (1 hour)
5. Book appointments immediately

### Footer

- "Built in Flagstaff, AZ for small AZ agencies"
- Contact email: <ebookgovern@gmail.com>
- "No contracts. Cancel anytime."

---

## Technical Requirements

### Stack Recommendation

- **Framework:** Next.js or Astro (static site preferred for speed)
- **Styling:** Tailwind CSS
- **Hosting:** Vercel or Netlify
- **Analytics:** Google Analytics 4

### Click-to-Call Implementation

```html
<a href="tel:+19287230429" class="cta-button">
  Call Our AI Agent
</a>
```

### PayPal Button Integration

```html
<!-- Starter Plan -->
<a href="https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-62D43206TX584261TNFUQBJY" 
   class="paypal-button">
  Subscribe - $99/mo
</a>

<!-- Growth Plan -->
<a href="https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-0PH92736U6909683KNFUQBJY" 
   class="paypal-button">
  Subscribe - $199/mo
</a>
```

---

## Design Guidelines

### Colors (Suggested Arizona Theme)

- Primary: Desert sunset orange (#E85D04)
- Secondary: Sage green (#606C38)
- Accent: Sky blue (#0077B6)
- Background: Warm white (#FEFAE0)
- Text: Dark brown (#3D2914)

### Typography

- Headlines: Bold, modern sans-serif (Inter, Outfit)
- Body: Clean, readable (Inter, Roboto)

### Imagery

- Arizona landscapes (Flagstaff, red rocks, ponderosa pines)
- Real estate lifestyle shots
- Phone/AI assistant illustrations

---

## Existing Infrastructure

| Service | URL/Details |
|---------|-------------|
| **Webhook Server** | `https://ai-agentbook.onrender.com` |
| **Vapi Phone** | +1 (928) 723-0429 |
| **Supabase Project** | `byllwcxvbxybaawrilec.supabase.co` |
| **GitHub Repo** | `github.com/ebookgov/ai-agentbook` |

---

## Success Metrics

1. **Demo calls initiated** (track click events on tel: links)
2. **PayPal subscription conversions**
3. **Time on page**
4. **Scroll depth to pricing section**

---

## Contact

For questions about the AI agent, webhook integration, or backend:

- Email: <ebookgovern@gmail.com>
- Vapi Dashboard access available upon request
