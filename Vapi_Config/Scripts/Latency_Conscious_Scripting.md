Latency-Conscious Scripting Principles
Voice AI objection handling adds unique latency constraints. Production systems cannot afford to send the entire response to the LLM for inference on every objection—the response time would exceed 1-2 seconds, breaking conversational naturalness.

The solution is tiered response generation:

Pre-computed responses for top 5-8 objections (zero latency, served from cache)

LLM-generated refinements only for novel objections

Streaming responses that begin playback while synthesis continues

Example prompt structure for pre-computed objection handling:

text
IF customer_objection == "just_browsing":
  response = "Totally get it—most people start there. A quick
  conversation helps you know what's realistic in your price
  range and timeline."
  
  NEXT_ACTION = ask_timeline()
  
ELSE IF customer_objection == "need_to_talk_spouse":
  response = "Smart move. Happy to schedule a call when they're
  available, or I can send over a summary."
  
  NEXT_ACTION = offer_callback_or_summary()
This eliminates LLM inference for 70-85% of objection scenarios, keeping responses under 200ms and preserving conversational flow.
​

Multi-Turn Objection Recovery
Sophisticated systems implement objection tracking across multiple turns. If a prospect objects twice to the same concern ("I'm not pre-approved" → offered financing info → still hesitant about qualification), the AI escalates to softer positioning (educational content, no commitment) rather than continuing to push scheduling.
​

Real estate firms using Synthflow report configuring 10-15 objection scenarios with conditional branching:

First objection: Counter with value proposition

Second objection (same): Offer educational alternative (market report, neighborhood guide)

Third objection (same): Soft pivot to callback timing ("When might you feel ready to explore options?")

Latency-Conscious Scripting and System Architecture
The 300-Millisecond Threshold
Voice AI conversational quality depends on sub-300ms round-trip latency—the time from when a user stops speaking to when the AI begins responding. Above this threshold, conversations feel robotic and unnatural; below it, interactions feel responsive and human-like. This is not subjective—measurable engagement metrics (interruption frequency, conversation abandonment, sentiment) degrade sharply above 500ms latency.

Latency Budget Breakdown (Sub-300ms Target):

Pipeline Stage Typical Duration Optimization Strategy
Audio capture & encoding 10-50ms Handled by device (fixed)
Network upload 20-100ms WebSocket persistent connection (vs HTTP handshake)
Speech-to-Text (ASR) 100-300ms Streaming ASR (incremental processing)
Language Model Inference 200-2000ms Parallel orchestration + early token streaming
Text-to-Speech Synthesis 100-400ms Streaming TTS (begin playback on first tokens)
Network download 20-100ms Regional co-location + QUIC protocol
Audio playback 0-50ms Streaming begins immediately
The key insight: Total latency is not the sum of stages—it's the overlap. Modern systems stream audio from ASR → LLM → TTS concurrently, starting each stage before the previous one completes.
​

Streaming Architecture for Real-Time Conversations
Production voice AI systems achieve sub-300ms through parallel streaming:

text
User speaks:     [=======audio stream======]
                        ↓ (streams to ASR)
ASR outputs:            [partial transcript] → [more tokens]
                                    ↓ (streams to LLM)
LLM generates:                 [token1][token2][token3]...
                                    ↓ (streams to TTS)
TTS synthesizes:                 [audio][audio][audio]...
                        ↓ (streams back to user)
User hears:     [quick response, zero latency perception]
Each stage begins before the previous completes, collapsing the end-to-end gap from 1200-2000ms (sequential) to 300-400ms (parallel).

LLM Model Selection for Latency
The single largest latency variable is language model inference time—specifically time-to-first-token (TTFT).

Model TTFT Voice Use Real Estate Notes
GPT-4 700-1000ms Not recommended for real-time voice Too slow; causes perception of delay
GPT-4o 500-700ms Marginal; tight latency budget Works with streaming ASR offset
Gemini Flash 1.5 <350ms Recommended Fast + capable enough for real estate
Claude 3.5 Sonnet 600-800ms Not ideal for voice Better for async analysis
For real estate appointment booking, Gemini Flash 1.5 or equivalent fast models are non-negotiable. Responses in a booking conversation ("I have availability Tuesday at 3pm or Wednesday at 10am") benefit more from speed than from maximum reasoning capability.

Real Estate-Specific Latency Techniques
Real estate voice AI adds domain-specific optimizations:

1. Pre-Computed Response Caching (Zero latency)
Cache 50-100 most common responses:

"Thank you for calling [Company]"

"What brings you in today—buying, selling, or investing?"

"I have availability on [date] at [time]"

All objection counter-arguments (see Section 2)

When user provides expected input, return cached response immediately while streaming alternative generation in background.

1. Property Database Lookups (Parallel)
While ASR/LLM process: "I'm looking for homes near [school]"

Simultaneously query property database for schools

Have top 3 matching properties ready by time user finishes speaking

Response: "Great! I found 5 homes near [school]. The top match is [address], $[price], [beds/baths]..."

1. Calendar Availability Pre-Computation
Upon entering BOOKING state:

Fetch next 7 days of agent availability (don't wait until user says "when")

Generate top 3 available times immediately

When user asks about availability, respond in <200ms with pre-computed slots

1. Streaming Confirmation Details
Rather than batch all confirmation info:

"Let me confirm... [pause for TTS first word]

Your showing is Tuesday [streaming begins]

At 3pm [next syllables arrive]

For the Midtown loft [synthesis continues in parallel]"

This creates perception of immediate response despite generating full confirmation string.

Network Architecture for Low-Latency Voice
Infrastructure decisions are as important as algorithmic optimization:

1. WebSocket over WebRTC:

WebSocket: Persistent connection, minimal overhead, ideal for real estate volume

WebRTC: Peer-to-peer, ultra-low latency, but complexity overhead

Most production real estate systems use WebSocket because the 50-100ms latency savings don't justify operational complexity when already optimized to <300ms total.

1. Regional Points of Presence (POPs):
Host services near customer density:

Real estate in San Francisco/Bay Area → West Coast POP (San Jose, California)

East Coast operations → New York or Virginia datacenter

Multi-region routing with latency-aware failover

Example: A call from San Francisco routed through Virginia datacenters adds 100-150ms network latency alone—enough to exceed total budget.

1. QUIC Protocol over TCP:
QUIC eliminates TCP handshake (3-way) overhead:

TCP: SYN → SYN-ACK → ACK (~40-60ms per connection)

QUIC: Integrated into first data packet (0ms connection overhead)

At scale (thousands of concurrent calls), QUIC reduces infrastructure latency by 5-8%.
