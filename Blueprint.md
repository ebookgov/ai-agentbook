# Operational Blueprint: The "Direct-Access" AI Agency
1. Executive Summary
This project is a "1-Day Build" of a high-margin AI Agency targeting Real Estate and Home Services. Core Thesis: Decision-makers in these industries (Realtors, Contractors) publish direct cell phone numbers. We remove B2B sales friction by targeting them with "Inbound Intelligence" products that solve their immediate "Speed-to-Lead" and "Sleep Deprivation" pain points.

Critical Constraint: Due to TCPA 2025 regulations, NO COLD CALLING AI. These products are "Inbound Receptionists" sold to clients to handle their incoming leads.

2. Product A: The Real Estate "Visual ISA"
Target Audience: Luxury Real Estate Agents. Value Prop: "An AI that answers your phone, vets the buyer, and texts them a custom interactive brochure before you even hang up."

2.1 Technical Specifications
Voice Engine: Retell AI (Optimized for human-like latency).

Frontend: Next.js 14 (App Router) + Tailwind CSS + Shadcn/UI.

Infrastructure: Google Cloud Run (Stateless, auto-scaling).

2.2 Feature Set (The "Visual Hook")
The AI must trigger a Generative UI Brochure sent via SMS during the call.

Dynamic Listing Page: /listing/[id] rendered via React Server Components (RSC).

Mortgage Calculator: Real-time amortization slider (Principal, Rate, Down Payment).

Local Context: Google Maps API integration showing nearby schools/coffee shops.

Aesthetic: "Architectural Digest" vibe. Minimalist, serif fonts, full-bleed imagery.

2.3 User Flow
Inbound Call: Buyer calls Agent's Twilio number.

AI Answer: "Hi, this is Alex, the executive assistant..."

Qualification: AI checks budget/timeline.

Trigger: AI sends SMS: "I just texted you the interactive brochure."

Conversion: User opens link; AI pushes for a viewing appointment.

3. Product B: The HVAC "Emergency Dispatcher"
Target Audience: Independent HVAC/Plumbing Contractors. Value Prop: "Sleep Insurance. The AI filters 2 AM noise vs. money-making emergencies."

3.1 Technical Specifications
Voice Engine: Vapi (Optimized for complex function calling).

Logic Engine: Python 3.11 + FastAPI + Pydantic.

Infrastructure: Google Cloud Run.

3.2 Triage Logic (The "Brain")
The system must classify calls into three buckets:

🔴 EMERGENCY (Wake Up):

Keywords: "Sparking", "Gas", "Flooding", "No heat (Temp < 45°F)".

Action: Trigger Twilio Voice call to Owner's personal cell.

🟡 URGENT (Next Morning):

Keywords: "No AC", "No Hot Water".

Action: Send SMS summary to Owner; schedule for 8 AM.

🟢 ROUTINE (Monday):

Keywords: "Maintenance", "Quote", "Filter change".

Action: Schedule via Calendly/CRM API.

4. Regulatory Compliance (TCPA 2025)
Strict Adherence Required.

Inbound Only: The system is designed for inbound call handling. Do not build outbound auto-dialers.

Disclosure: The AI must identify itself as an "AI Assistant" if asked or required by state law.

Opt-In: All web forms generated for this project must include a TCPA compliant checkbox: "I agree to receive automated texts/calls from [Company]..."

5. Deployment Architecture
Repo Structure: Monorepo or separate services (/visual-isa-web, /hvac-triage-api).

Authentication: Unauthenticated public access for Demo links; API Key protection for Admin routes.

Environment Variables:

RETELL_API_KEY

VAPI_PRIVATE_KEY

OPENAI_API_KEY (Gemini 3 Pro fallback)

TWILIO_ACCOUNT_SID

GOOGLE_MAPS_API_KEY

How to proceed:
Create the file: Copy the code block above and save it as Blueprint.md in your project's root folder.

Run the Planning Prompt: Now that you have both @Rules.md (from the previous step) and @Blueprint.md, paste the Master Architect Planning Prompt I gave you into the Antigravity agent window.