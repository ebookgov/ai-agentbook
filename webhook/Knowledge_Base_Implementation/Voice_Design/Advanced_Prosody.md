SSML Support and Advanced Prosody Control
Vapi SSML Implementation
Vapi fully supports Speech Synthesis Markup Language (SSML), the World Wide Web Consortium standard for voice markup. This enables precise prosody control across all integrated TTS providers (ElevenLabs, PlayHT, Deepgram, Cartesia).

Essential SSML tags for real estate:

xml
<speak>
  <prosody rate="1.0" pitch="0Hz" volume="0dB">
    Base prosody control (rate: 0.5–2.0; pitch: +/- range; volume: +/- dB)
  </prosody>
  
  <break time="500ms"/>
  Strategic pause for emphasis
  
  <emphasis level="strong|moderate|reduced">
    Highlight critical phrases
  </emphasis>
  
  <say-as interpret-as="characters|digits|telephone">
    Property address: <say-as interpret-as="digits">12345</say-as>
  </say-as>
  
  <phoneme alphabet="ipa" ph="ˈprɒpəti">
    Property (precise IPA pronunciation)
  </phoneme>
  
  <sub alias="million">M</sub>
  Expand abbreviations ($2.5M = "2.5 million")
</speak>
Real estate examples:

xml
<!-- Pronunciation correction: Alameda (local property name) -->
<speak>
This beautiful home is located in <phoneme alphabet="ipa" ph="ˌæləˈmeɪdə">Alameda</phoneme>.
</speak>

<!-- Price emphasis with prosody -->
<speak>
The asking price is <prosody pitch="-5Hz" rate="slow">
<say-as interpret-as="characters">$</say-as>2.5M
</prosody>.
</speak>

<!-- Property address clarity -->
<speak>
The property is at <say-as interpret-as="digits">1234</say-as> 
<say-as interpret-as="characters">Oak</say-as> Street, 
<say-as interpret-as="digits">90210</say-as>.
</speak>
Vapi Native Emotional Modulation
Beyond SSML, Vapi's LLM integration enables context-aware emotional adaptation:

json
{
  "systemPrompt": "You are a warm, patient real estate agent. When a caller sounds frustrated (emotion: frustrated, confidence: >0.8), respond with slower speech, lower pitch, and extra empathy. Use backchannel affirmations like 'I understand' naturally."
}
The emotion detection model feeds caller sentiment directly to the LLM, enabling dynamic response adjustment without static SSML markup.
​