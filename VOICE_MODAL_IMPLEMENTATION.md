# Zero-Cost Deployment Guide: XTTS-v2 for Vapi.ai

This guide provides the exact code and step-by-step instructions to deploy the high-realism **XTTS-v2** model on a **Hugging Face ZeroGPU Space** and connect it as a custom Text-to-Speech (TTS) endpoint for your Vapi.ai agent.

This setup is designed to be **zero-cost** for development and testing, prioritizing voice realism and low latency.

## Prerequisites

1. **Hugging Face Account:** You must have a Hugging Face account.
2. **Hugging Face PRO:** The ZeroGPU tier is free to use but requires a **PRO account ($9/month)** for priority access and quota. This is your only recurring cost, but it's significantly cheaper than any paid TTS API.
3. **Reference Audio:** A high-quality, clean audio file (WAV or MP3, 6-20 seconds long) of the voice you want to clone. Name this file `reference_audio.wav`.

## Step 1: Create the Hugging Face Space

1. **Go to Hugging Face:** Navigate to [huggingface.co/new](https://huggingface.co/new).
2. **Configure the Space:**
    * **Space name:** Choose a unique name (e.g., `my-vapi-xtts-endpoint`).
    * **Space SDK:** Select **`Docker`**. This gives you the most control for an API endpoint.
    * **Docker Template:** Select **`FastAPI`**.
    * **Visibility:** Set to **`Public`** (required for Vapi to access it).
3. **Select Hardware:**
    * **Hardware:** Select **`ZeroGPU`**. This is the key to your zero-cost deployment.

## Step 2: Add the Required Files

Once the Space is created, navigate to the **"Files"** tab and add the following three files:

### File 1: `app.py` (The API Endpoint)

This code sets up a FastAPI server that loads the XTTS-v2 model and exposes a `/tts` endpoint that Vapi will call.

```python
import logging
import os
import asyncio
import re
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from TTS.api import TTS
import torch
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment variables
class Config:
    REFERENCE_AUDIO_FILE = os.getenv("REFERENCE_AUDIO_FILE", "reference_audio.wav")
    TTS_MODEL = os.getenv("TTS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")
    TTS_LANGUAGE = os.getenv("TTS_LANGUAGE", "en")
    MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "500"))
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))  # seconds
    MAX_REQUESTS_PER_MINUTE = int(os.getenv("MAX_REQUESTS_PER_MINUTE", "10"))

# TTS Service class for encapsulation
class TTSService:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tts: Optional[TTS] = None
        self.reference_audio_exists = False
        logger.info(f"Using device: {self.device}")

    async def initialize(self):
        """Initialize the TTS model asynchronously."""
        try:
            # Check reference audio
            if not os.path.exists(Config.REFERENCE_AUDIO_FILE):
                logger.warning(f"Reference audio '{Config.REFERENCE_AUDIO_FILE}' not found. Voice cloning will fail.")
                logger.warning("Please upload your 6-20 second WAV file and name it 'reference_audio.wav'.")
            else:
                self.reference_audio_exists = True

            # Load model in a thread to avoid blocking
            loop = asyncio.get_event_loop()
            self.tts = await loop.run_in_executor(None, self._load_model)
            logger.info("XTTS-v2 model loaded successfully.")
        except Exception as e:
            logger.error(f"Error loading TTS model: {e}")
            self.tts = None
            raise

    def _load_model(self):
        """Load the TTS model (blocking operation)."""
        return TTS(Config.TTS_MODEL).to(self.device)

    def is_ready(self) -> bool:
        return self.tts is not None and self.reference_audio_exists

    async def synthesize(self, text: str) -> bytes:
        """Synthesize speech from text."""
        if not self.is_ready():
            raise RuntimeError("TTS service is not ready")

        # Sanitize text
        text = self._sanitize_text(text)

        # Generate audio with timeout
        try:
            loop = asyncio.get_event_loop()
            wav_data = await asyncio.wait_for(
                loop.run_in_executor(None, self._generate_audio, text),
                timeout=Config.REQUEST_TIMEOUT
            )
            return wav_data
        except asyncio.TimeoutError:
            raise RuntimeError("Speech synthesis timed out")
        except Exception as e:
            logger.error(f"Synthesis error: {e}")
            raise RuntimeError(f"Speech synthesis failed: {e}")

    def _generate_audio(self, text: str) -> bytes:
        """Generate audio bytes (blocking operation)."""
        return self.tts.tts_to_bytes(
            text=text,
            speaker_wav=Config.REFERENCE_AUDIO_FILE,
            language=Config.TTS_LANGUAGE
        )

    @staticmethod
    def _sanitize_text(text: str) -> str:
        """Sanitize input text to prevent issues."""
        # Remove excessive whitespace and special characters that might cause issues
        text = re.sub(r'\s+', ' ', text.strip())
        # Limit length
        if len(text) > Config.MAX_TEXT_LENGTH:
            text = text[:Config.MAX_TEXT_LENGTH]
        return text

# Request models
class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=Config.MAX_TEXT_LENGTH)

    @validator('text')
    def validate_text(cls, v):
        if not v.strip():
            raise ValueError('Text cannot be empty')
        return v

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str
    reference_audio_exists: bool

# Rate limiting (simple in-memory)
request_counts = {}

def check_rate_limit(request: Request) -> bool:
    """Simple rate limiting based on client IP."""
    client_ip = request.client.host
    current_time = asyncio.get_event_loop().time()
    minute = int(current_time / 60)

    key = f"{client_ip}:{minute}"
    if key not in request_counts:
        request_counts[key] = 0
    request_counts[key] += 1

    # Clean old entries periodically
    if len(request_counts) > 1000:
        old_keys = [k for k in request_counts if int(k.split(':')[1]) < minute]
        for k in old_keys:
            del request_counts[k]

    return request_counts[key] <= Config.MAX_REQUESTS_PER_MINUTE

# Global TTS service instance
tts_service = TTSService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await tts_service.initialize()
    yield
    # Shutdown
    # Add cleanup if needed

app = FastAPI(
    title="XTTS-v2 TTS Service",
    description="High-realism Text-to-Speech endpoint for Vapi.ai",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if not check_rate_limit(request):
        raise HTTPException(status_code=429, detail="Too many requests")
    response = await call_next(request)
    return response

@app.post("/tts")
async def synthesize_speech(request: TTSRequest, req: Request):
    """Synthesize speech from text input."""
    if not tts_service.is_ready():
        raise HTTPException(status_code=503, detail="TTS service is not ready. Check model loading and reference audio.")

    try:
        wav_data = await tts_service.synthesize(request.text)
        return Response(content=wav_data, media_type="audio/wav")
    except RuntimeError as e:
        logger.error(f"TTS synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/", response_model=HealthResponse)
def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="ok" if tts_service.is_ready() else "error",
        model_loaded=tts_service.tts is not None,
        device=tts_service.device,
        reference_audio_exists=tts_service.reference_audio_exists
    )
```

### File 2: `requirements.txt` (Dependencies)

Create a new file named `requirements.txt` and add the following:

```
fastapi
uvicorn
python-multipart
python-dotenv
torch
torchaudio
TTS
```

### File 3: Upload `reference_audio.wav`

Upload your high-quality, 6-20 second audio file and ensure it is named **`reference_audio.wav`** in the root of your Space. This is the voice XTTS-v2 will clone.

## Step 3: Connect to Vapi.ai

1. **Wait for Deployment:** The Space will automatically start building. Monitor the **"Logs"** tab. The build is complete when you see the Uvicorn server start and the model load successfully.
2. **Get the Endpoint URL:** Once the Space is running, its public URL will be in the format: `https://[your-space-name].hf.space`.
3. **Configure Vapi.ai:**
    * Go to your Vapi.ai Dashboard.
    * Navigate to the Assistant you want to modify.
    * In the **Voice** section, select **`Custom TTS`**.
    * Set the **Custom TTS Endpoint URL** to:

        ```
        https://[your-space-name].hf.space/tts
        ```

    * **Important:** Vapi will send the text to this endpoint, and your Space will return the raw audio data, giving you the high-realism voice you need at zero hourly cost (thanks to ZeroGPU).
