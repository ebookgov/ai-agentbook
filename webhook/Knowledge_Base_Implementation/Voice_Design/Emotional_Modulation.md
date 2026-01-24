Prosody and Emotional Modulation During Objection Handling
SSML Prosody Tags for Real Estate Scenarios
Vapi's SSML support enables precise emotional modulation:

Scenario: Price Objection
xml
<speak>
I completely understand why price is a key consideration.
<break time="500ms"/>
<prosody pitch="low" rate="slow" volume="loud">
This property offers exceptional value in your target neighborhood.
</prosody>
<break time="300ms"/>
Let me walk you through the comparable sales data.
</speak>
Prosody rationale:

Lower pitch + slow rate: Conveys confidence and stability (not defensive)

Volume boost: Emphasizes value proposition without shouting

Strategic breaks: 500ms after acknowledgment demonstrates active listening; 300ms after prosody softens transition

Scenario: Location/Commute Concern
xml
<speak>
That's a really valid concern about your commute.
<break time="400ms"/>
<prosody rate="medium" pitch="medium-high">
What I've found with this location is that the main corridor traffic clears
<emphasis level="moderate">significantly</emphasis> after 10 AM.
</prosody>
<break time="200ms"/>
And <emphasis level="strong">the walkability</emphasis> to downtown shops is exceptional.
</speak>
Rationale:

Medium-high pitch: Friendliness + enthusiasm without artificiality

Moderate emphasis on "significantly": Highlights data point without overstatement

Strong emphasis on "walkability": Pivots objection into secondary benefit

Scenario: Warm Property Discovery (No Objection)
xml
<speak>
<prosody pitch="high" rate="medium" volume="soft">
I'd love to walk you through this gorgeous three-bedroom.
</prosody>
<break time="200ms"/>
It has these beautiful hardwood floors and natural light that really caught
<emphasis level="moderate">my</emphasis> attention when I first saw it.
</speak>
Rationale:

Higher pitch + soft volume: Conveys genuine enthusiasm without pressure

Self-reference ("my attention"): Humanizes agent, builds rapport

Real-time Emotion Detection in Vapi
Vapi's proprietary emotion detection model analyzes caller tone and passes emotional context to the LLM:
​

json
{
  "emotion": {
    "sentiment": "frustrated",
    "confidence": 0.92,
    "tone": "questioning_intent"
  }
}
When detected, the system dynamically adjusts:

Speech rate: Slower (0.8x) for frustrated callers

Pitch: Lower to match caller's energy (avoid mismatch)

Backchanneling: Inserts "I hear you" or "That's really important" naturally

Filler injection: Adds strategic "um" and "well" to feel less robotic
