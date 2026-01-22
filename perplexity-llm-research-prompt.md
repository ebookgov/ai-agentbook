# Perplexity Pro Research: Top LLM Comparison 2026

> **Space Configuration & Research Prompt for Deep Thinking Mode**

---

## Part 1: Perplexity Pro Space Instructions

> Copy this into your Perplexity Space system instructions

```yaml
ROLE: Senior AI Technology Analyst & Research Specialist
DOMAIN: Large Language Models, AI Agents, Web Development, Marketing Technology
MISSION: Produce evidence-backed comparative analysis with forensic-accountant skepticism

OPERATING_STANCE:
  - Technical depth of a CTO evaluating vendor selection
  - Skepticism of a VC analyst reviewing claims vs. reality
  - Clarity of a consultant presenting to non-technical stakeholders

BEHAVIORAL_CONSTRAINTS:
  # NON-NEGOTIABLE
  - NO fabricated benchmarks, scores, or performance claims
  - EVERY numeric claim requires: (Publisher, Title, Date, URL)
  - If data is unavailable: output "[DATA GAP]" + suggest authoritative sources
  - Prioritize sources from last 6 months (January 2026 and later preferred)
  - Distinguish between: OFFICIAL benchmarks vs. COMMUNITY observations vs. YOUR analysis

SOURCE_HIERARCHY:
  TIER_1_HIGH_TRUST:
    - Official model cards and technical reports (Anthropic, OpenAI, Google DeepMind, xAI)
    - Peer-reviewed papers and arXiv preprints
    - Official API documentation and release notes
    - Recorded benchmark datasets (MMLU, HumanEval, SWE-Bench, etc.)
    
  TIER_2_MEDIUM_TRUST:
    - Engineering blogs from reputable companies
    - Hacker News discussions with technical depth
    - Reddit r/LocalLLaMA, r/MachineLearning (critical analysis only)
    - Independent AI researchers with verifiable credentials
    
  TIER_3_SKEPTICAL:
    - Company marketing materials and press releases
    - LinkedIn thought leadership
    - YouTube reviews without methodology disclosure
    
  BANNED:
    - SEO-optimized "Top 10 Best LLMs" listicles
    - Affiliate content
    - Unverified Twitter/X claims without supporting evidence

OUTPUT_REQUIREMENTS:
  - Start immediately with data—no introductory fluff
  - Every rating must cite at least 2 credible sources
  - Include "Confidence Level" (High/Medium/Low) for each assessment
  - Explicitly state when extrapolating from limited data
  - Use markdown tables for all comparisons
  - Provide category-by-category deep explanations AFTER the summary table
```

---

## Part 2: Perplexity Pro Research Prompt

> Copy this as your query in Deep Thinking mode

```markdown
# LLM Comparative Analysis: 2026 Production Readiness

## TARGET MODELS
Analyze and compare the following LLMs across multiple capability dimensions:

| Model | Provider | Release Context |
|-------|----------|-----------------|
| Google Gemini 2.0 Pro | Google DeepMind | [Verify current version] |
| Claude Opus 4.5 | Anthropic | [Verify current version] |
| Claude Sonnet 4.5 | Anthropic | [Verify current version] |
| Manus.im | Manus AI | Agentic AI platform |
| Grok 3.1 | xAI | [Verify current version] |
| GPT-4.5 / GPT-5 | OpenAI | [Verify current version] |
| Sonar | Perplexity AI | Search-augmented LLM |

**IMPORTANT:** If model version numbers I've listed are incorrect or outdated, use the CURRENT production versions available as of January 2026 and note the corrections.

---

## EVALUATION CATEGORIES (6 Total)

### Category 1: Web Design & Frontend Coding
**Weight: Critical for my use case**

Evaluate each model's ability to:
- Generate production-ready HTML/CSS/JavaScript
- Create responsive, mobile-first layouts
- Produce visually stunning landing pages (not basic/generic)
- Implement modern design patterns (glassmorphism, micro-animations, dark mode)
- Write clean, maintainable code structure
- Handle CSS frameworks (Tailwind, vanilla CSS)

**Key Questions:**
- Which model produces the most visually impressive output on first attempt?
- Which requires the least iteration to reach production quality?
- Which best understands modern design aesthetics (2025-2026 trends)?

---

### Category 2: Creative Marketing Copy
**Weight: High priority**

Evaluate each model's ability to:
- Write compelling landing page copy that converts
- Maintain brand voice consistency
- Create emotional, persuasive messaging
- Adapt tone for different audiences
- Generate headlines that capture attention
- Avoid generic, overused marketing phrases

**Key Questions:**
- Which model produces the most "human" and engaging copy?
- Which avoids the typical AI-sounding patterns?
- Which best understands conversion psychology?

---

### Category 3: AI Voice Agent Rules & Instructions
**Weight: Critical for my use case**

Evaluate each model's ability to:
- Write system prompts for voice AI agents (Vapi, Retell, etc.)
- Create natural conversation flows
- Handle edge cases and fallback logic
- Write guardrails that prevent hallucination
- Structure multi-turn dialogue management
- Understand voice-specific constraints (latency, interruptions)

**Key Questions:**
- Which model best understands the unique requirements of VOICE (not text) AI?
- Which produces prompts that result in natural-sounding conversations?
- Which handles compliance requirements (disclosure, no-negotiation rules)?

---

### Category 4: Agent Workflows & Orchestration
**Weight: High priority**

Evaluate each model's ability to:
- Design multi-agent "Squad" architectures
- Create tool-calling schemas and function definitions
- Plan error handling and fallback chains
- Optimize for latency in agent handoffs
- Structure knowledge retrieval (RAG) workflows
- Balance autonomy vs. human oversight

**Key Questions:**
- Which model best understands agentic AI patterns?
- Which produces the most robust workflow designs?
- Which considers edge cases proactively?

---

### Category 5: Complex Reasoning & Multi-Step Analysis
**Weight: Medium priority**

Evaluate each model's ability to:
- Break down complex problems systematically
- Maintain context across long reasoning chains
- Self-correct when detecting errors
- Handle ambiguous or incomplete information
- Provide nuanced analysis (not just surface-level)

**Key Questions:**
- Which model has the best "thinking" or chain-of-thought capabilities?
- Which is least likely to lose context in long conversations?
- Which provides the most actionable insights?

---

### Category 6: Code Debugging & Refactoring
**Weight: Medium priority**

Evaluate each model's ability to:
- Identify bugs in existing code
- Suggest performance optimizations
- Refactor for readability and maintainability
- Understand codebase context from partial information
- Provide accurate error explanations

**Key Questions:**
- Which model finds bugs most reliably?
- Which provides the most useful refactoring suggestions?
- Which best understands the "why" behind code issues?

---

## REQUIRED OUTPUT FORMAT

### Summary Comparison Table

| Model | Web Design (1-10) | Marketing Copy (1-10) | Voice Agent Rules (1-10) | Agent Workflows (1-10) | Reasoning (1-10) | Debugging (1-10) | Overall |
|-------|-------------------|----------------------|--------------------------|------------------------|------------------|------------------|---------|
| [Model] | X | X | X | X | X | X | X.X |

**Scoring Key:**
- 9-10: Industry-leading, best-in-class
- 7-8: Excellent, minor limitations
- 5-6: Competent, notable gaps
- 3-4: Functional but problematic
- 1-2: Not recommended for this use case

---

### Deep Explanations (Required for Each Category)

For EACH category, provide:

1. **Category: [Name]**

2. **Top Performer:** [Model Name]
   - Why: [2-3 sentences with specific evidence]
   - Source 1: [Publisher, Title, Date, URL]
   - Source 2: [Publisher, Title, Date, URL]

3. **Runner-Up:** [Model Name]
   - Why: [2-3 sentences]

4. **Notable Weaknesses:**
   - [Model X]: [Specific limitation]
   - [Model Y]: [Specific limitation]

5. **Confidence Level:** High / Medium / Low
   - Justification: [Why this confidence level]

---

### Special Focus: Manus.im Analysis

Manus.im is a newer entrant. Specifically address:
- What makes it different from other LLMs?
- Is it a standalone model or orchestration layer?
- What are its claimed strengths vs. verified capabilities?
- How does it compare for agentic use cases specifically?

---

### Final Recommendations

Based on my use case (AI voice agents for real estate, landing pages, marketing):

1. **Best Overall for My Needs:** [Model] — [Why]
2. **Best Value (Quality/Cost):** [Model] — [Why]
3. **Best for Voice Agents Specifically:** [Model] — [Why]
4. **Avoid for My Use Case:** [Model] — [Why]

---

## DATA GAP ACKNOWLEDGMENT

If you cannot find credible sources for any claim, explicitly state:
> [DATA GAP]: Unable to verify [specific claim] from authoritative sources. The following assessment is based on [community observations / limited data / extrapolation].

---

## RECENCY REQUIREMENT

Prioritize sources from:
- January 2026 (preferred)
- Q4 2025 (acceptable)
- Earlier than Q3 2025 (flag as potentially outdated)

Note any model updates or version changes that may affect assessments.
```

---

## Usage Instructions

1. **Create a new Perplexity Space** named "LLM Research Hub" or similar
2. **Paste Part 1** (Space Instructions) into the Space's system prompt
3. **Enable Deep Thinking mode** (Pro feature)
4. **Paste Part 2** (Research Prompt) as your first query
5. **Follow-up queries** can drill into specific categories

---

## Expected Output Quality

With these instructions, Perplexity Pro should deliver:

| Element | What You'll Get |
|---------|-----------------|
| **Summary Table** | 6-category comparison with 1-10 scores |
| **Source Citations** | 2+ credible sources per major claim |
| **Confidence Levels** | Transparency on assessment reliability |
| **Deep Explanations** | Category-by-category analysis |
| **Data Gap Flags** | Honest acknowledgment of limitations |
| **Actionable Recommendations** | Tailored to your specific use case |

---

> [!TIP]
> **Pro Tip:** After receiving initial results, use follow-up prompts like:
>
> - "Drill deeper into the Voice Agent category with more examples"
> - "Compare Claude Opus 4.5 vs GPT-5 specifically for landing page code quality"
> - "Show me specific prompt examples that each model would generate for a real estate AI agent"
