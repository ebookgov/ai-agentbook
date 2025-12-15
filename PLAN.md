# Engineering Plan: "Direct-Access" AI Agency 1-Day Build
> **Role:** Senior Solutions Architect
> **Objective:** Convert Operational Blueprint into a strictly prioritized Engineering Plan.

## 1. 🏗️ System Architecture

```mermaid
graph TD
    subgraph "External Voice Networks"
        User((User Call)) -->|Inbound Audio| VoiceProv[Voice Provider\n(Retell AI / Vapi)]
        VoiceProv -->|Function Calls / Webhooks| CloudRun[Google Cloud Run\n(API Gateway)]
    end

    subgraph "Cloud Infrastructure (GCP)"
        CloudRun -->|Route: /triage| Triage[Product B: Triage Logic\n(Python/FastAPI)]
        CloudRun -->|Route: /listing/*| VisualISA[Product A: Visual ISA\n(Next.js 14)]
        
        Triage -->|Check Temp| WeatherAPI[OpenWeatherMap API]
        Triage -->|Dispatch SMS| Twilio[Twilio SMS API]
        
        VisualISA -->|Map Data| GoogleMaps[Google Maps API]
    end

    subgraph "Client Devices"
        VisualISA -->|Render Dynamic Brochure| MobileBrowser[User Mobile Browser]
        Twilio -->|Emergency Alert| OwnerPhone[Owner Cell Phone]
    end
    
    classDef primary fill:#0F172A,stroke:#D4AF37,stroke-width:2px,color:#fff;
    classDef secondary fill:#fff,stroke:#0F172A,stroke-width:1px,color:#0F172A;
    
    class CloudRun,Triage,VisualISA primary;
    class VoiceProv,WeatherAPI,Twilio,GoogleMaps secondary;
```

## 2. 🗓️ Phased Execution Checklist

### Phase 1: Scaffolding & Infrastructure
**Goal:** Establish a reliable, containerized foundation on Google Cloud Run.
- [ ] **Setup GCP Project & CLI**
    - Enable Artifact Registry, Cloud Run API.
    - Output: `gcloud` project initialized.
- [ ] **Dockerization (Multi-Stage)**
    - **Frontend:** Next.js standalone build (optimize image size).
    - **Backend:** Python 3.11-slim + Uvicorn.
    - Output: `Dockerfile.frontend`, `Dockerfile.backend`.
- [ ] **Local Orchestration**
    - Create `docker-compose.yml` to run both services + Redis (opt).
    - Output: `docker-compose up` runs both apps on localhost:3000 & 8080.

### Phase 2: Product A - The "Visual ISA" (Frontend Focus)
**Goal:** "Vibe Code" the Luxury Listing app to WOW the user immediately.
- [ ] **Initialize Next.js 14 (App Router)**
    - Install Tailwind CSS, Shadcn/UI, Lucide React.
    - key: `npx create-next-app`
- [ ] **Implement 'Luxury' Design System**
    - Fonts: Playfair Display (Headers), Inter (Body).
    - Colors: #0F172A (Charcoal), #D4AF37 (Gold).
    - Output: `globals.css` configured.
- [ ] **Build Generative UI Components**
    - **Mortgage Calculator:** Interactive RSC with slider.
    - **Listing Map:** Google Maps integration with custom dark styles.
- [ ] **Dynamic Routing**
    - Route: `/listing/[id]`
    - Data: Mock data in `lib/data.ts` (Price ranges, Images).
    - Output: Functional "Brochure" page accessible via URL.

### Phase 3: Product B - The "Emergency Dispatcher" (Logic Focus)
**Goal:** Protect the client's sleep with strict Triage Logic.
- [ ] **Initialize Python FastAPI**
    - Structure: `app/main.py`, `app/models.py`.
    - Dependencies: `pydantic`, `httpx` (for APIs).
- [ ] **Implement Triage Engine (/triage)**
    - **Route:** `POST /triage`
    - Input: Call Transcript.
    - Output: JSON Classification (`EMERGENCY`, `URGENT`, `ROUTINE`).
- [ ] **Integrate Context APIs**
    - **OpenWeatherMap:** Check local temp if "No Heat" or "No AC".
    - Logic: If "No Heat" AND Temp < 45°F => `EMERGENCY`.
- [ ] **Pydantic Validation**
    - Enforce Strict Output Schema for Vapi/Retell consumption.
    - Output: Tested API endpoint returning correct flags.

### Phase 4: Voice Integration (The "Glue")
**Goal:** Connect Voice AI to the logic and frontend.
- [ ] **Voice Provider Functions**
    - Define JSON Schemas for Retell AI / Vapi function calling.
    - Output: `functions_schema.json`.
- [ ] **Webhook Endpoints**
    - Create endpoints to trigger SMS dispatch via Twilio.
    - Payload: "Here is the listing: [Link]" or "Emergency Alert: [Issue]".
- [ ] **Compliance & Opt-In**
    - **TCPA Check:** Verify "Opt-In" variable is present in call state.
    - **Fail-Safe:** If status is ambiguous, default to SMS (do not call owner).
    - Output: End-to-end call simulation flow.

## 3. 🛡️ Risk & Mitigation

| Risk Area | Potential Failure Point | Architectural Mitigation |
| :--- | :--- | :--- |
| **Latency** | Voice API response > 1000ms causes dead air. | **Warm Instances:** Set Cloud Run min-instances to 1.<br>**Region:** Deploy close to Voice Provider (us-central1). |
| **Hallucination** | AI promises services not offered (e.g., "We do roofing"). | **System Prompt Guardrails:** Explicit negative constraints.<br>**Temperature:** Set LLM temp to 0.2 for deterministic logic. |
| **False Emergencies** | Routine calls waking owner at 2 AM. | **Double-Check Logic:** Require TWO confirmations (Keyword + Context/Weather) before `EMERGENCY` status. |
| **Dependency Fail** | OpenWeatherMap API down. | **Circuit Breaker:** Default to "URGENT" (SMS) if external context checks fail. |
