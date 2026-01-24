# Operations & Monitoring Guide

**Target SLOs:**

* **Latency P95:** <1000ms (End-to-End)
* **Success Rate:** >99%
* **Concurrency:** Zero double-bookings

---

## 1. Supabase Dashboard (Database & RAG)

Since our RAG and Booking data live in Supabase, their dashboard is your primary monitoring tool.

### A. Business Metrics

Since the current backend version syncs directly to **Google Calendar** (and not a SQL table), monitor bookings via:

1. **Google Calendar UI:** Check for events titled "Tour: [Lead Name]".
2. **Vapi Dashboard:** Filter calls by `tool: book_appointment` success.

*(Note: Phase 2 will add a `bookings` table in Supabase for SQL analytics)*

### B. System Metrics (Supabase Dashboard)

* Go to **Edge Functions** > **search-knowledge** > **Logs**.
* Filter for `error` to see any RAG failures.
* Filter for `WARN` to see if fallback logic (Vector-only) is triggering.

---

## 2. Vapi Dashboard (Voice Performance)

Vapi provides the "User Experience" metrics.

1. **Latency Tracking:**
    * Navigate to **Analytics**.
    * Look at **E2E Latency**. Ideally, this stays under 800ms.
    * If it spikes, check your `webhook/latency` endpoint logs (if configured) or Supabase logs.

2. **Call Outcomes:**
    * Filter calls by `endedReason`.
    * Watch for `silence-timed-out` (user stopped talking) vs `pipeline-error-upstream` (our backend failed).

---

## 3. Operational Alerts (Uptime)

You need to know if the backend is down *before* a customer calls.

### Setup Free Uptime Monitor

Use UptimeRobot or BetterStack (Free Tiers).

1. **Monitor Type:** HTTP(s)
2. **URL:** `https://your-app.up.railway.app/health`
    * (This endpoint checks Postgres + Redis connectivity)
3. **Interval:** 5 minutes
4. **Keyword Check:** Expect `{"status": "ok"}`

### Alert thresholds

* **Database CPU:** >80% (Scale Supabase Compute)
* **Redis Memory:** >80% (Clear stale slot locks)

---

## 4. Troubleshooting Playbook

### Scenario A: "The AI is hallucinating answers"

1. Check Supabase RAG logs: Did `search-knowledge` return results?
2. If yes, check the `confidence` score. If low (<0.5), your Knowledge Base might be missing that topic.
3. **Action:** Add a new Markdown file to `Knowledge_Base_Implementation` and re-run `embed_knowledge_base.py`.

### Scenario B: "Double Booking Occurred"

1. This should be impossible with Redis locks, but if reported:
2. Check `slot_manager.py` logs for `acquired_hold` vs `released_hold`.
3. Verify Redis TTL is not too short (currently 60s). Users taking >60s to confirm "Yes" might lose the slot.
4. **Action:** Increase `hold_ttl_seconds` in `slot_manager.py`.

### Scenario C: "Latency is huge (>3s)"

1. Check Cold Start on Supabase Edge Function.
2. **Action:** Setup a cron job to ping the endpoint every 5 mins to keep it warm.

    ```bash
    curl -X POST https://.../search-knowledge -d '{"query": "warmup"}'
    ```
