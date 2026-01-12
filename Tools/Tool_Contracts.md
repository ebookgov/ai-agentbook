# Avoxa Vapi Tool Contracts (JSON Schemas)

These schemas define the input and output structures for the tools the Avoxa AI assistant will use.

## 1. searchListingsAZ

**Description**: Searches for real-time ARIZONA property listings via RentCast.
**Enforcement**: Must strictly filter by `state=AZ`.

### Schema (Input)

```json
{
  "type": "function",
  "name": "searchListingsAZ",
  "parameters": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "The city in Arizona to search (e.g., Chandler, Gilbert)." },
      "minPrice": { "type": "number", "description": "Minimum price in USD." },
      "maxPrice": { "type": "number", "description": "Maximum price in USD." },
      "bedrooms": { "type": "number", "description": "Minimum number of bedrooms." }
    },
    "required": ["city"]
  }
}
```

---

## 2. bookAppointmentCal

**Description**: Books an appointment in Cal.com using the brokerage's round-robin team link.

### Schema (Input)

```json
{
  "type": "function",
  "name": "bookAppointmentCal",
  "parameters": {
    "type": "object",
    "properties": {
      "brokerageId": { "type": "string", "description": "Internal UUID for the brokerage." },
      "customerName": { "type": "string" },
      "customerPhone": { "type": "string" },
      "preferredTime": { "type": "string", "description": "ISO 8601 timestamp or natural language time." }
    },
    "required": ["brokerageId", "customerName", "customerPhone"]
  }
}
```

---

## 3. logCallAndDecisions

**Description**: Stores the call transcript and qualification decisions in Supabase for compliance.

### Schema (Input)

```json
{
  "type": "function",
  "name": "logCallAndDecisions",
  "parameters": {
    "type": "object",
    "properties": {
      "vapiCallId": { "type": "string" },
      "transcript": { "type": "string" },
      "qualificationScore": { "type": "number", "description": "0-100 score based on LPMAMA." },
      "decisions": { "type": "array", "items": { "type": "string" }, "description": "List of key decisions made during the call." }
    },
    "required": ["vapiCallId", "transcript"]
  }
}
```

---

## 4. flagForLegalReview

**Description**: Triggered if a risk flag is detected (discrimination, legal advice request, etc.).

### Schema (Input)

```json
{
  "type": "function",
  "name": "flagForLegalReview",
  "parameters": {
    "type": "object",
    "properties": {
      "vapiCallId": { "type": "string" },
      "reason": { "type": "string", "enum": ["discrimination", "legal_advice_requested", "complaint", "complex_issue"] },
      "snippet": { "type": "string", "description": "The specific part of the transcript that triggered the flag." }
    },
    "required": ["vapiCallId", "reason", "snippet"]
  }
}
```
