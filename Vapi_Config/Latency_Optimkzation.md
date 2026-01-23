# Vapi.ai Latency Optimization Guide

> **Target:** Sub-500ms end-to-end latency for voice AI agents

---

## Quick Reference: LLM Provider Selection

| Provider | TTFT | Tokens/sec | Cost | Best For |
|----------|------|------------|------|----------|
| **Claude Haiku 4.5** | ~80ms | — | $0.005/min | Production <500ms target |
| **OpenAI GPT-4o** | 200-320ms | 103 t/s | $0.22/min | Balanced speed + reliability |
| **Groq Llama 3.3 70B** | ~190ms | 276 t/s | Low | High-volume (1000+ concurrent) |
| **Cerebras Llama 3.3** | ~260ms | 2,578 t/s | Low | Long responses (200+ tokens) |
| **GPT-4o-mini** | ~540ms | 50 t/s | $0.01/min | Cost-sensitive, <1s acceptable |
| **Claude 3.5 Haiku** | ~360ms | 52.5 t/s | $0.005/min | Simple voice interactions |
| **Claude 3.5 Sonnet** | ~640ms | 50.8 t/s | Higher | Complex reasoning (accept 800ms+) |

---

## Latency Pipeline Breakdown

| Stage | Standard | Optimized | Target | Savings |
|-------|----------|-----------|--------|---------|
| Endpointing | 600ms | 200ms | 150ms | 450ms |
| ASR | 250ms | 150ms | 100ms | 150ms |
| LLM (TTFT) | 300ms | 200ms | 120ms | 180ms |
| LLM (generation) | 600ms | 150ms | 80ms | 520ms |
| TTS | 150ms | 100ms | 80ms | 70ms |
| Network | 50ms | 30ms | 20ms | 30ms |
| waitSeconds | 400ms | 100ms | 0ms | 400ms |
| **TOTAL** | **2350ms** | **930ms** | **550ms** | **1800ms** |

---

## Critical Insight: Output Tokens > Input Tokens

| Token Type | Latency Impact | Example |
|------------|----------------|---------|
| **Input (prompt)** | ~0.2ms per token | 500 extra tokens = +10ms |
| **Output (response)** | 8-12ms per token | 50 fewer tokens = -500ms |

**Action:** Set `max_tokens=50-100` for voice responses—not default 256+.

---

## Webhook Instrumentation

### Anchor Points

```
utterance_start     → First audio byte received
utterance_end       → End-of-turn detected  
response_play_start → First TTS audio plays
```

**E2E Latency = `response_play_start - utterance_start`**

### Node.js Implementation

```javascript
app.post('/vapi/webhook', (req, res) => {
  const { conversation_id, utterance_start, utterance_end, response_play_start } = req.body;
  
  console.log(JSON.stringify({
    conversation_id,
    e2e_latency_ms: response_play_start - utterance_start,
    asr_ms: utterance_end - utterance_start,
    processing_ms: response_play_start - utterance_end,
    timestamp: Date.now()
  }));
  
  res.sendStatus(200);
});
```

### Python FastAPI

```python
@app.post("/vapi/webhook")
async def capture_latency(req: Request):
    body = await req.json()
    metrics = {
        "conversation_id": body["conversation_id"],
        "e2e_latency_ms": body["response_play_start"] - body["utterance_start"],
        "received_at": int(time.time() * 1000)
    }
    print(json.dumps(metrics))
    return {"ok": True}
```

### BigQuery Percentiles

```sql
SELECT
  APPROX_QUANTILES(e2e_latency_ms, 100)[OFFSET(50)] AS p50_ms,
  APPROX_QUANTILES(e2e_latency_ms, 100)[OFFSET(95)] AS p95_ms,
  APPROX_QUANTILES(e2e_latency_ms, 100)[OFFSET(99)] AS p99_ms
FROM `project.vapi_logs.voice_calls`
WHERE DATE(_PARTITIONTIME) = CURRENT_DATE();
```

---

## Optimization by Impact

| Optimization | Effort | Savings | Priority |
|--------------|--------|---------|----------|
| Reduce `max_tokens` by 50% | High (UX) | 400-600ms | 🔴 Highest |
| LLM provider switch | High | 100-500ms | 🔴 Highest |
| Aggressive endpointing | Low | 200-400ms | 🟡 High |
| Streaming ASR + tight timeouts | Medium | 150-400ms | 🟡 High |
| Token streaming overlap | Medium | 100-300ms | 🟡 High |
| Warmed/cached TTS | Low | 100-200ms | 🟢 Medium |
| Remove waitSeconds delay | Low | 100-400ms | 🟢 Medium |
| Region pinning + TLS reuse | Low | 40-100ms | 🟢 Medium |
| Async DB/API calls | Low | 50-200ms | 🟢 Medium |
| System prompt optimization | Low | 10-15ms | ⚪ Low |

---

## ASR Configuration (AssemblyAI via Vapi)

```yaml
endOfTurnConfidenceThreshold: 0.4  # Aggressive (0.7 = conservative)
minEndOfTurnSilenceWhenConfident: 160ms
maxTurnSilence: 400ms  # Not default 1000ms
```

**Savings:** 150-300ms vs defaults

---

## Optimal LLM Configuration

```json
{
  "model": "gpt-4o",
  "temperature": 0.7,
  "max_tokens": 80,
  "top_p": 0.9,
  "frequency_penalty": 0.3,
  "presence_penalty": 0.2
}
```

**System prompt:** Keep under 500 tokens for voice agents.

---

## SLO Targets

| Metric | Target | Alert |
|--------|--------|-------|
| p50 | <500ms | >600ms |
| p95 | <800ms | >1000ms |
| p99 | <1200ms | >1500ms |

---

## Production Checklist

### LLM

- [ ] Model: Claude Haiku 4.5 OR GPT-4o
- [ ] System prompt: <500 tokens
- [ ] max_tokens: 50-100
- [ ] Prompt caching: Enabled

### ASR

- [ ] Streaming: Enabled
- [ ] End-of-turn confidence: 0.4-0.5
- [ ] Max turn silence: 300-500ms
- [ ] Fallback transcriber: Configured

### TTS

- [ ] Voice caching: Enabled
- [ ] Model: Low-latency (speech-02-turbo)
- [ ] reduceLatency flag: Enabled

### Pipeline

- [ ] waitSeconds: 0-100ms
- [ ] Region pinning: Enabled
- [ ] TLS reuse: Enabled
- [ ] Token streaming: Enabled

### Monitoring

- [ ] Webhook capture: All 3 timestamps
- [ ] SLO alerts: Configured
- [ ] Grafana/Datadog: Connected

---

## Diagnostic: Finding Your Bottleneck

```
If ASR > 400ms consistently → Provider issue or network
If processing > 1000ms    → LLM (check TTFT + output tokens)  
If spikes but components steady → Tool calls blocking pipeline
```

---

*Source: Perplexity Deep Research, January 2026*
