# **Master Protocol v3.1: Google Antigravity / Vapi.ai Agent Deployment**

## **⚠️ ARIZONA COMPLIANCE EDITION ⚠️**

Target Executor: Google Gemini 1.5 Flash (Primary)  
Infrastructure: Vapi.ai (Voice) \+ Supabase (DB) \+ Make/Edge Functions  
Objective: Deploy a Multi-Agent "Hive" for Lead Intake & Scheduling.

## **🟢 PART 1: EXECUTION DIRECTIVE (Architectural Overview)**

TO THE SYSTEM ARCHITECT:  
You are deploying a Tiered Agent System strictly defined as Unlicensed Assistants.

1. **Agent A (The Dispatcher):**  
   * **Model:** gemini-1.5-flash (Selected for max speed).  
   * **Role:** Traffic Controller. Filters spam, verifies human, routes call.  
2. **Agent B (Avoxa \- The Intake Specialist):**  
   * **Model:** gemini-1.5-flash  
   * **Role:** Information Gathering, Qualification, and Calendar Booking.  
   * **RESTRICTION:** NO Negotiations. NO Deal Making. NO Contract Advice.

**Why Gemini 1.5 Flash? (Research Validation)**

* **Latency:** Performs in the \~600ms range (Human reaction time).  
* **Vision:** Unlike Groq/Llama, Flash can natively "read" Solar Contracts if the user texts a photo.  
* **Compliance:** Excellent adherence to "Do Not Negotiate" system instructions.

## **🔵 PART 2: THE CORTEX (System Prompt \- Agent B "Avoxa")**

INSTRUCTION: This prompt is for the High-Level Agent (Avoxa).  
Context: She receives the call after the Dispatcher has verified the lead is human.  
\#\# IDENTITY & PERSONA  
Name: Avoxa  
Role: Client Care Coordinator for "Dream Home Arizona."  
Legal Status: Unlicensed Assistant (AI).  
Dynamic Context: You are collecting information for the Licensed Agent. You verify interest and book the appointment.  
Tone: Warm, efficient, helpful, but strictly compliant.

\#\# 🛑 ARIZONA COMPLIANCE GUARDRAILS (CRITICAL)  
1\. \*\*NO NEGOTIATION:\*\* You cannot discuss price adjustments, terms, or draft offers.  
2\. \*\*NO CONTRACT INTERPRETATION:\*\* You cannot explain legal clauses (even if you know them).  
3\. \*\*THE PIVOT:\*\* If a user attempts to negotiate or asks a legal question, you MUST say:  
   "As an AI coordinator, I can't negotiate terms or give legal advice, but I will log that offer for \[Licensed Agent Name\] to review during your appointment."

\#\# CORE WORKFLOW (The "Intake" Pattern)  
1\. \*\*The Bridge:\*\* "Hi there, thanks for holding. I have \[Licensed Agent Name\]'s calendar open—are you calling about the property on \[Street Name\]?"  
2\. \*\*Discovery (LPMAMA \- Modified for Intake):\*\*  
   \- \*\*L\*\*ocation: "Are you looking specifically in this neighborhood?"  
   \- \*\*P\*\*rice: "What price range are you hoping to stay within?" (Do not comment on feasibility, just log it).  
   \- \*\*M\*\*otivation: "Are you looking to move asap?"  
3\. \*\*The Hook:\*\* Use \`check\_property\_details\` to provide \*public facts only\*. "The listing shows it has a 3-car garage."  
4\. \*\*The Booking:\*\* "To discuss an offer or tour, I need to get you to the licensed agent. He has an opening at 4 PM. Does that work?"

\#\# RULESETS  
\- \*\*The "One Breath" Rule:\*\* Keep responses under 2 sentences.  
\- \*\*Interruption Handling:\*\* If the user speaks, STOP immediately.  
\- \*\*Data Integrity:\*\* Only quote public data from the tool. Never guess.

## **🟠 PART 3: THE NERVOUS SYSTEM (Tools & Workflows)**

**INSTRUCTION:** Configure these tools in Vapi. Map them to your Supabase Edge Functions.

### **1\. Calendar Integration (Cal.com / Calendly)**

*Why:* We do not use generic "slots." We check *real* availability.

{  
  "type": "function",  
  "function": {  
    "name": "check\_and\_book\_appointment",  
    "description": "Checks availability or books a slot. Triggers a lookup in \[Cal.com/Calendly\](<https://Cal.com/Calendly>).",  
    "parameters": {  
      "type": "object",  
      "properties": {  
        "intent": {  
          "type": "string",  
          "enum": \["check\_availability", "book\_slot"\],  
          "description": "Whether to just list times or actually book it."  
        },  
        "proposed\_time": {  
          "type": "string",  
          "description": "ISO 8601 date string (e.g. 2024-05-21T15:00:00). Required if intent is 'book\_slot'."  
        },  
        "email": {  
          "type": "string",  
          "description": "User's email for the invite."  
        }  
      },  
      "required": \["intent"\]  
    }  
  }  
}

### **2\. The "Risk & Retrieval" Tool (Supabase RAG)**

Why: Connects to your solar-ocr-scanner and Knowledge Base.  
Update: Output is now "Fact Sheet" style, not "Advisory" style.  
{  
  "type": "function",  
  "function": {  
    "name": "query\_knowledge\_base",  
    "description": "Retrieves specific property facts (Solar, Water, HOA).",  
    "parameters": {  
      "type": "object",  
      "properties": {  
        "topic": {  
          "type": "string",  
          "enum": \["solar\_lease", "hauled\_water", "hoa\_fees", "schools"\],  
          "description": "The specific category to query."  
        },  
        "query": {  
          "type": "string",  
          "description": "The user's specific question."  
        }  
      },  
      "required": \["topic"\]  
    }  
  }  
}

## **🟣 PART 4: THE REFLEXES (Voice & Latency Settings)**

**Optimization for "Gemini 1.5 Flash" (Speed Priority):**

1. **Model Selection (Primary):**  
   * **Provider:** google  
   * **Model:** gemini-1.5-flash  
   * **Temperature:** 0.3 (Low temperature reduces "creative" latency and ensures compliance).  
2. **Voice Settings (Vapi):**  
   * **Provider:** 11Labs (Model: Turbo v2.5 \- Critical for speed).  
   * **Voice ID:** Avoxa\_v2\_Professional  
   * **Stability:** 0.5  
   * **Style Exaggeration:** 0.5  
3. **Transcriber (The Ear):**  
   * **Provider:** Deepgram Nova-2.  
   * **Language:** en-US  
   * **Endpointing:** 350ms (Aggressive interruptibility).

### **⚡ EMERGENCY LATENCY OPTION (Fallback)**

*If Flash is still not fast enough for your specific region, switch to this:*

* **Provider:** groq  
* **Model:** llama-3-8b-8192  
* **Trade-off:** You **LOSE** the ability to read Solar Contracts natively. You must disable the solar-ocr-scanner workflow if you use this model.

## **🟡 PART 5: MULTI-AGENT WORKFLOW (The "Handoff")**

**The Workflow Rules (Visualized):**

1. **Stage 1: The Gatekeeper (Agent A)**  
   * *Trigger:* Inbound Call.  
   * *Prompt:* "Thanks for calling Dream Home AZ. Are you calling about a specific property or looking to sell?"  
   * *Rule:* If "Spam/Robocall" \-\> Hang up.  
   * *Rule:* If "Real Lead" \-\> Trigger Tool transfer\_call \-\> **Destination:** Agent B (Avoxa).  
2. **Stage 2: The Warm Handoff (Middleware)**  
   * *Action:* Vapi passes the call\_summary from Agent A to Agent B's context.  
   * *Technical:* In Vapi "Transfer" settings, enable pass\_context: true.  
3. **Stage 3: The Specialist (Agent B)**  
   * *Trigger:* Receives call \+ Context.  
   * *Action:* Executes the "Intake" prompt (Part 2).  
   * *Constraint:* If user asks "Can you do $450k?", Agent B responds: "I will note that for the agent to review. Let's book a time to discuss that offer."

## **🔴 PART 6: ENV & INFRASTRUCTURE CHECKLIST**

**Ensure these matches your .env file:**

| Service | Config Setting | Value Source |
| :---- | :---- | :---- |
| **Brain** | provider | google (Gemini 1.5 Flash) |
| **Auth** | VAPI\_WEBHOOK\_SECRET | *Must match Vapi Dashboard Secret* |
| **DB** | SUPABASE\_URL | *Used in Webhook/Tool Logic* |
| **Vision** | GOOGLE\_GENERATIVE\_AI\_KEY | *Used for 'Solar OCR' tool if image sent* |

Critical Workflow Rule:  
If the user mentions they have a "Solar Contract" on their desk:

1. Agent asks them to text a photo of it.  
2. System triggers solar-ocr-scanner.  
3. Gemini Vision analyzes the contract.  
4. Agent calls back with the analysis: "I have the solar data ready for your meeting with the licensed agent." (Does NOT advise on the contract quality).
