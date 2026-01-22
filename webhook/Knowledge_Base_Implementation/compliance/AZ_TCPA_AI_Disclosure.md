# Arizona TCPA & AI Disclosure Compliance - Voice Agent Guide

> **Source:** Perplexity Deep Research  
> **Last Updated:** January 2026  
> **CRITICAL:** This document contains legally-required disclosure language

---

## Quick Reference

| Requirement | Status |
|-------------|--------|
| **AI Disclosure** | Required at call start |
| **Recording Consent** | Arizona is one-party (caller consent sufficient) |
| **TCPA Consent** | Prior express consent required for AI-initiated calls |
| **Brokerage ID** | Required per A.R.S. § 32-2153 |
| **Fair Housing** | Federal law applies to all responses |

---

## AI Disclosure Requirements

### Q: When must the agent disclose "I'm an AI"?

**A:** The AI must disclose its non-human nature **at the beginning of every call**, before any substantive conversation. FTC guidance (2024) and emerging state laws require clear, upfront disclosure that the caller is speaking with an automated system.

### Q: What is the FTC AI disclosure guidance (2024-2025)?

**A:** The FTC's February 2024 rule on "AI Impersonation" prohibits:

- AI systems from impersonating humans without disclosure
- Creating false impressions that a consumer is communicating with a person
- Using AI-generated voices that mimic real people without consent

**Requirement:** Clear disclosure at the start of any AI-initiated or AI-handled communication.

### Q: What are Arizona-specific AI disclosure requirements?

**A:** Arizona does not have a specific AI disclosure statute as of January 2026. However:

- FTC federal rules apply
- Arizona Consumer Fraud Act (A.R.S. § 44-1521) prohibits deceptive practices
- Real estate licensees must not misrepresent material facts (A.R.S. § 32-2153)

**Best Practice:** Always disclose AI status upfront to avoid any deception claims.

---

## TCPA Compliance

### Q: What are TCPA consent requirements for AI-initiated calls?

**A:** The Telephone Consumer Protection Act requires:

- **Prior express consent** for any call using an artificial or prerecorded voice
- **Prior express written consent** for telemarketing calls to cell phones
- Consent must be clear, documented, and revocable

**Risk:** TCPA violations can result in **$500-$1,500 per call** in statutory damages.

### Q: What about call recording disclosure?

**A:** Arizona is a **one-party consent state** (A.R.S. § 13-3005). This means:

- Only one party to the call needs to consent to recording
- If your AI system is recording, the AI (as a party) provides consent
- **However:** Best practice is still to disclose recording for transparency

### Q: Do I need to disclose recording to Arizona callers?

**A:** Legally, no—Arizona's one-party consent means your company's consent is sufficient. **But:**

- Many callers expect disclosure
- Out-of-state callers may be in two-party consent states
- Recording disclosure builds trust

**Recommendation:** Include recording disclosure in opening script.

### Q: What about calls to two-party consent states?

**A:** If you call states like California, Florida, or Illinois, you MUST obtain consent from the other party before recording. Include recording disclosure for all calls to be safe.

---

## Real Estate-Specific Disclosures

### Q: What must be disclosed when AI represents a licensed broker?

**A:** Per Arizona Department of Real Estate rules and A.R.S. § 32-2153:

- **Brokerage name** must be identified
- **Licensed status** of the entity must be clear
- AI cannot practice real estate without operating under a licensed broker
- Material facts about agency relationship must be disclosed

### Q: What are brokerage identification requirements?

**A:** The AI must disclose:

- Name of the employing broker
- That it is operating on behalf of a licensed real estate entity
- Contact information for the brokerage (phone or website)

### Q: How does Fair Housing apply to AI responses?

**A:** The Fair Housing Act (42 U.S.C. § 3604) prohibits discrimination in:

- Advertising or statements about property
- Steering buyers based on protected classes
- Disparate treatment in service quality

**AI Compliance:** Never reference race, color, religion, national origin, sex, familial status, or disability when describing neighborhoods, properties, or buyer suitability.

---

## Required Opening Disclosure Script

### Standard Opening (Recommended)

```
"Hello, this is the Arizona property assistant for [BROKERAGE NAME]. 
I'm an AI-powered voice agent, and this call may be recorded for 
quality purposes. You can request to speak with a human agent at 
any time. How can I help you today?"
```

### Minimum Legal Opening

```
"Hi, I'm an AI assistant for [BROKERAGE NAME]. This call may be 
recorded. How can I help you?"
```

### Components Explained

| Component | Purpose | Legal Basis |
|-----------|---------|-------------|
| "I'm an AI" | AI disclosure | FTC 2024 guidance |
| "[BROKERAGE NAME]" | Brokerage identification | A.R.S. § 32-2153 |
| "may be recorded" | Recording transparency | Best practice |
| "speak with a human" | Consumer protection | FTC, TCPA |

---

## Recording Consent Language

### Standard Disclosure

```
"This call may be recorded for quality and training purposes."
```

### With Opt-Out

```
"This call is being recorded. If you prefer not to be recorded, 
please let me know and I'll connect you with a team member."
```

### For Two-Party Consent States

```
"I'd like to record this call for quality purposes. Do I have 
your consent to proceed?"
```

---

## Handoff to Human Agent

### Trigger Phrases (When AI Should Transfer)

The AI should offer human handoff when:

- Caller requests to speak with a person
- Complex legal questions arise
- Caller expresses frustration or confusion
- Contract negotiations begin
- Sensitive fair housing topics emerge

### Handoff Script

```
"I'd be happy to connect you with a licensed agent who can 
help you further. Please hold while I transfer your call, or 
I can have someone call you back. Which would you prefer?"
```

### Escalation Documentation

Log all handoffs with:

- Timestamp
- Reason for escalation
- Caller information (if provided)
- Summary of conversation to that point

---

## System Prompt Template (Complete)

```
You are an AI-powered real estate assistant for [BROKERAGE NAME], 
a licensed Arizona real estate brokerage (License #[NUMBER]).

MANDATORY DISCLOSURES (include in every call opening):
1. "I'm an AI assistant" - Must be stated within first 10 seconds
2. "[BROKERAGE NAME]" - Identify the brokerage
3. "This call may be recorded" - Recording transparency
4. "You can speak with a human anytime" - Consumer protection

COMPLIANCE RULES:
- Never claim to be human
- Never provide legal advice
- Never discriminate based on protected classes (Fair Housing)
- Always offer human handoff when requested
- Document all calls for TCPA compliance

FAIR HOUSING COMPLIANCE:
Do NOT reference or consider:
- Race, color, national origin
- Religion
- Sex, gender identity
- Familial status (children, pregnancy)
- Disability
- Age (for housing, different from lending)

When describing neighborhoods, focus ONLY on:
- Property features
- School district (factual, not quality judgments)
- Proximity to amenities
- Public transit access
- Zoning and land use

ESCALATION TRIGGERS (transfer to human):
- Caller requests human agent
- Contract or price negotiations
- Legal questions about contracts
- Fair housing concerns
- Complaints or disputes
- Complex title or financing questions

CLOSING:
End calls with: "Thank you for calling [BROKERAGE NAME]. 
Have a great day!"
```

---

## Compliance Checklist

### Before Launch

- [ ] AI disclosure language approved by legal
- [ ] Recording disclosure included in script
- [ ] Brokerage identification in opening
- [ ] Human handoff option available
- [ ] Fair Housing training applied to AI responses
- [ ] TCPA consent documented for outbound calls
- [ ] Call logging enabled for compliance audit

### Ongoing Monitoring

- [ ] Random call review for disclosure compliance
- [ ] Fair Housing audit of AI responses
- [ ] TCPA consent verification for marketing calls
- [ ] Escalation rate tracking
- [ ] Caller complaint review

---

## Legal Citations

| Requirement | Citation |
|-------------|----------|
| AI Impersonation | FTC Rule, 16 CFR Part 461 (Feb 2024) |
| TCPA Consent | 47 U.S.C. § 227 |
| Arizona Recording | A.R.S. § 13-3005 |
| Real Estate Licensing | A.R.S. § 32-2153 |
| Fair Housing | 42 U.S.C. § 3604 |
| Arizona Consumer Fraud | A.R.S. § 44-1521 |

---

## Voice Agent Implementation

### Compliance Middleware

```python
def compliance_wrapper(call_handler):
    """Ensure all calls include required disclosures"""
    
    REQUIRED_DISCLOSURES = [
        "AI",           # AI status
        "BROKERAGE",    # Company name
        "recorded",     # Recording notice
        "human"         # Handoff option
    ]
    
    async def wrapped_handler(call):
        # Inject opening disclosure
        opening = generate_compliant_opening(call.brokerage)
        await call.speak(opening)
        
        # Log disclosure delivery
        log_compliance_event(
            call_id=call.id,
            event="DISCLOSURE_DELIVERED",
            timestamp=datetime.now()
        )
        
        # Continue with normal handling
        return await call_handler(call)
    
    return wrapped_handler

def generate_compliant_opening(brokerage: str) -> str:
    return f"""Hello, this is the Arizona property assistant for {brokerage}. 
    I'm an AI-powered voice agent, and this call may be recorded for quality 
    purposes. You can request to speak with a human agent at any time. 
    How can I help you today?"""
```

### Latency Impact

- Compliance opening: +3-5 seconds per call
- No additional latency for ongoing conversation
- **Trade-off:** Legal protection >> minor UX delay

---

*Source: Perplexity Deep Research, FTC.gov, TCPA, A.R.S. Title 32, Fair Housing Act*
