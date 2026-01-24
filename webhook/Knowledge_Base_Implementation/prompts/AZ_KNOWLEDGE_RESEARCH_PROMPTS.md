# Arizona Real Estate Knowledge Base - Research Prompts

> **Purpose:** Populate vector DB with AZ-specific disclosures, regulations, and FAQs  
> **Use in:** Perplexity Pro Deep Research mode

---

## Prompt 1: Water Rights & Groundwater

```
ROLE: Arizona real estate compliance researcher
OBJECTIVE: Build comprehensive knowledge base for voice AI property disclosures

Research Arizona water rights for residential real estate:

1. ADWR (Arizona Department of Water Resources) requirements:
   - Assured vs. Adequate water supply distinction
   - Groundwater rights certificates (GWC) - what do buyers need to know?
   - Active Management Areas (Phoenix, Tucson, Pinal) vs. rural properties

2. Disclosure requirements for sellers/agents:
   - When must water adequacy be disclosed?
   - What happens if a property has NO assured water supply?

3. Common buyer questions (for FAQ cache):
   - "Does this property have water rights?"
   - "What's the difference between city water and well water?"
   - "Are there water restrictions in this area?"

FORMAT: Structure as Q&A pairs suitable for voice agent responses (2-3 sentences max per answer)
SOURCES: Prioritize ADWR.gov, Arizona REALTORS, county assessor sites
```

---

## Prompt 2: HOA Disclosures & Regulations

```
ROLE: Arizona HOA compliance researcher
OBJECTIVE: Build voice-ready knowledge base for HOA disclosure questions

Research Arizona HOA disclosure requirements:

1. SPDS (Seller's Property Disclosure Statement) HOA sections:
   - What must be disclosed about HOA fees, rules, litigation?
   - CC&Rs delivery requirements (5-day review period)

2. HOA document package contents:
   - Reserve study, meeting minutes, financial statements
   - Transfer fees, special assessments

3. Common buyer questions:
   - "What's the monthly HOA fee?"
   - "Can I see the CC&Rs before I put in an offer?"
   - "Are there any special assessments coming?"
   - "What are the rental restrictions?"

4. Red flags agents should proactively mention:
   - Underfunded reserves
   - Pending litigation
   - Rental caps

FORMAT: Q&A pairs, 2-3 sentence answers, voice-friendly language
SOURCES: ARS 33-1806, Arizona REALTORS HOA guides, Corporation Commission filings
```

---

## Prompt 3: Solar Systems & Utility Considerations

```
ROLE: Arizona solar and utility researcher
OBJECTIVE: Build knowledge base for solar/utility disclosure questions

Research Arizona solar considerations for real estate:

1. Solar ownership vs. lease implications:
   - Owned solar: What transfers to buyer?
   - Leased solar: Assumption requirements, credit checks, transfer fees
   - PPA (Power Purchase Agreement) obligations

2. Net metering status:
   - APS vs. SRP rate structures
   - Current net metering availability (grandfathered vs. new installs)

3. Common buyer questions:
   - "Is the solar owned or leased?"
   - "What are the electricity bills like?"
   - "Will I have to assume the solar lease?"
   
   - "What's the buyout amount?"

4. Disclosure requirements:
   - When must solar obligations be disclosed?
   - UCC filings on leased systems

FORMAT: Q&A pairs suitable for voice responses
SOURCES: APS.com, SRP.net, Arizona Corporation Commission, SEIA Arizona
```

---

## Prompt 4: SPUD, Septic & Rural Property Considerations

```
ROLE: Arizona rural property disclosure researcher
OBJECTIVE: Build knowledge base for rural/SPUD property questions

Research Arizona rural property requirements:

1. SPUD (Subdivision Public Report):
   - What is a SPUD and when is it required?
   - Buyer acknowledgment requirements

2. Septic systems:
   - Maricopa County septic inspection requirements
   - Disclosure obligations for septic age/condition
   - Alternative systems (aerobic, sand filter)

3. Well water:
   - Well registration requirements
   - Water quality testing recommendations
   - Shared well agreements

4. Common buyer questions:
   - "Is this on septic or sewer?"
   - "When was the septic last inspected?"
   - "Is the well shared with neighbors?"
   - "What's the water quality like?"

FORMAT: Q&A pairs, voice-friendly (2-3 sentences)
SOURCES: Maricopa County DEQ, Pinal County, ADEQ, ADWR
```

---

## Prompt 5: TCPA & AI Disclosure Compliance

```
ROLE: Real estate compliance and telecom law researcher
OBJECTIVE: Ensure voice AI agent meets all disclosure requirements

Research compliance requirements for AI voice agents in real estate:

1. AI disclosure requirements:
   - When must agent disclose "I'm an AI"?
   - State-by-state variations (focus on Arizona)
   - FTC AI disclosure guidance (2024-2025)

2. TCPA compliance:
   - Consent requirements for AI-initiated calls
   - Call recording disclosure ("This call may be recorded")
   - Arizona one-party vs. two-party consent

3. Real estate-specific disclosures:
   - When AI represents a licensed broker
   - Brokerage identification requirements
   - Fair Housing compliance in AI responses

4. Exact disclosure language:
   - Opening statement templates
   - Recording consent language
   - Handoff to human agent triggers

FORMAT: Exact verbiage suitable for system prompts, legal citations
SOURCES: FTC.gov, Arizona REALTORS, TCPA case law, ARS Title 32 (real estate licensing)
```

---

## Prompt 6: Arizona Property Tax & Assessments

```
ROLE: Arizona property tax researcher
OBJECTIVE: Build knowledge base for property tax questions

Research Arizona property tax for voice AI:

1. Tax structure:
   - Full Cash Value vs. Limited Property Value
   - Primary vs. secondary tax rates
   - Proposition 117 (5% LPV cap)

2. Common buyer questions:
   - "What are the property taxes?"
   - "Will taxes go up after I buy?"
   - "What's the difference between assessed value and market value?"

3. Special districts and assessments:
   - Improvement districts (roads, water)
   - Fire district taxes
   - CFD (Community Facilities District) bonds

4. Exemptions:
   - Primary residence exemptions
   - Senior freeze programs
   - Veteran exemptions

FORMAT: Q&A pairs for voice, include calculation examples
SOURCES: County Assessor offices (Maricopa, Pinal, Pima), AZ DOR
```

---

## Output Format for All Prompts

Structure your research as:

```json
{
  "topic": "Water Rights",
  "question": "Does this property have water rights?",
  "answer": "Based on ADWR records, this property is in an Active Management Area with assured 100-year water supply from the city. You won't need to worry about water availability.",
  "source": "ADWR.gov",
  "last_updated": "2026-01",
  "voice_ready": true
}
```

---

## Research Execution Order

1. **TCPA/Disclosure** — Legal compliance first (system prompt depends on this)
2. **Water Rights** — Highest buyer anxiety in AZ
3. **HOA** — Most common FAQ category
4. **Solar** — Growing complexity, frequent questions
5. **SPUD/Septic** — Rural market coverage
6. **Property Tax** — Standard but important

---

*For use with Perplexity Pro Deep Research mode*
