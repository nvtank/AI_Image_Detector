import logging
import json
import asyncio
from typing import Dict, Any, Optional
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

# Schema for structured output validation
class GeminiAnalysisSchema(BaseModel):
    predicted_label: str = Field(description="Must be 'FAKE', 'REAL', or 'UNCERTAIN'")
    confidence_score: float = Field(description="Confidence score from 0.0 to 1.0")
    confidence_level: str = Field(description="Must be 'high', 'medium', or 'low'")
    evidence_for_fake: list[str] = Field(description="Short Vietnamese evidence supporting FAKE classification")
    evidence_for_real: list[str] = Field(description="Short Vietnamese evidence supporting REAL classification")
    uncertainty_reasons: list[str] = Field(description="Short Vietnamese reasons for uncertainty")
    reasoning_summary: str = Field(description="Brief Vietnamese summary of visual reasoning (max 3 sentences)")
    recommendation: str = Field(description="Short Vietnamese recommendation")
    should_trust_result: bool = Field(description="Whether the assessment should be trusted")

class GeminiService:
    def __init__(self):
        self._client = None
        self._initialized = False

    def _init_client(self):
        if self._initialized:
            return
        
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY is not configured. Gemini analysis is disabled.")
            self._initialized = True
            return

        try:
            # Initialize the modern official google-genai Client
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
            self._initialized = True
            logger.info("Successfully initialized Gemini API client.")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini Client: {str(e)}")
            self._initialized = True

    async def analyze_image_with_gemini(
        self, 
        image_bytes: bytes, 
        local_prediction: Dict[str, Any],
        image_mime: str = "image/jpeg"
    ) -> Dict[str, Any]:
        """
        Send image and local prediction context to Gemini API.
        Enforces a strict timeout and returns a structured analysis result using the user's forensic assistant rules.
        """
        self._init_client()

        if not settings.ENABLE_GEMINI_ANALYSIS:
            logger.info("Gemini analysis is disabled in configuration.")
            return self._fallback_response("Gemini analysis is disabled in configuration.")

        if not self._client:
            logger.warning("Gemini client is uninitialized (missing API key). Falling back.")
            return self._fallback_response("Gemini client is not configured (missing API key).")

        local_label = local_prediction.get("label", "UNCERTAIN")
        local_conf = local_prediction.get("confidence", 0.0)
        local_fake_prob = local_prediction.get("fake_probability", 0.0)
        local_real_prob = local_prediction.get("real_probability", 0.0)

        prompt = f"""You are a visual forensic assistant for AI-generated image detection.

Your task is to analyze the provided image and determine whether it is more likely:
- FAKE: AI-generated or heavily AI-synthesized
- REAL: captured by a real camera or likely non-AI
- UNCERTAIN: not enough reliable visual evidence

Important rules:
1. Do NOT claim certainty.
2. Do NOT rely on whether the image looks beautiful, cinematic, or high quality.
3. Do NOT classify as FAKE only because the image is sharp, colorful, fantasy-like, or unrealistic.
4. Do NOT classify as REAL only because the image looks natural.
5. Focus on visible forensic signals such as:
   - inconsistent object geometry
   - unnatural hands, fingers, teeth, eyes, reflections
   - repeated or melted textures
   - inconsistent lighting or shadows
   - distorted text, logos, patterns, background objects
   - unnatural skin, hair, fabric, or surface texture
   - impossible perspective or depth
   - compression/screenshot artifacts that may reduce confidence
6. If the image is low quality, cropped, compressed, edited, or lacks enough details, return UNCERTAIN.
7. If evidence for FAKE and REAL is mixed, return UNCERTAIN.
8. Your output must be valid JSON only. Do not use markdown. Do not wrap the response in ```json.

Local model result:
- predicted_label: {local_label}
- confidence: {local_conf}
- fake_probability: {local_fake_prob}
- real_probability: {local_real_prob}

Use the local model result as a reference, but do not blindly agree with it. If visual evidence is weak or contradictory, choose UNCERTAIN.

Return exactly this JSON schema:

{{
  "predicted_label": "FAKE | REAL | UNCERTAIN",
  "confidence_score": 0.0,
  "confidence_level": "high | medium | low",
  "evidence_for_fake": [
    "short Vietnamese evidence 1",
    "short Vietnamese evidence 2"
  ],
  "evidence_for_real": [
    "short Vietnamese evidence 1",
    "short Vietnamese evidence 2"
  ],
  "uncertainty_reasons": [
    "short Vietnamese reason 1"
  ],
  "reasoning_summary": "Giải thích ngắn gọn bằng tiếng Việt, tối đa 3 câu.",
  "recommendation": "Khuyến nghị ngắn gọn bằng tiếng Việt.",
  "should_trust_result": true
}}

Scoring guidance:
- confidence_score >= 0.85 only when there are multiple strong visible signals.
- confidence_score 0.65 to 0.84 when there are some signals but not enough for a strong conclusion.
- confidence_score < 0.65 when the image is ambiguous.
- If confidence_score < 0.70, predicted_label should usually be UNCERTAIN.
"""

        # Map MIME type appropriately
        mime_type = "image/jpeg"
        if "png" in image_mime.lower():
            mime_type = "image/png"
        elif "webp" in image_mime.lower():
            mime_type = "image/webp"

        def _call_gemini():
            try:
                # Use generate_content with structured output configuration
                response = self._client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        prompt
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=GeminiAnalysisSchema,
                        temperature=0.2, # Lower temperature for more analytical consistency
                    )
                )
                return response.text
            except Exception as e:
                logger.error(f"Error inside Gemini SDK generate_content call: {str(e)}")
                raise e

        try:
            # Execute with a strict timeout using asyncio.wait_for and asyncio.to_thread
            logger.info(f"Sending image to Gemini API ({settings.GEMINI_MODEL})...")
            response_text = await asyncio.wait_for(
                asyncio.to_thread(_call_gemini),
                timeout=float(settings.GEMINI_TIMEOUT_SECONDS)
            )

            if not response_text:
                raise ValueError("Received empty response from Gemini API.")

            logger.info("Successfully received response from Gemini API.")
            return self._parse_gemini_json(response_text)

        except asyncio.TimeoutError:
            logger.error(f"Gemini API analysis timed out after {settings.GEMINI_TIMEOUT_SECONDS}s.")
            return self._fallback_response(f"Gemini API analysis timed out after {settings.GEMINI_TIMEOUT_SECONDS} seconds.")
        except Exception as e:
            logger.error(f"Unexpected error during Gemini API analysis: {str(e)}")
            return self._fallback_response(f"Gemini API error: {str(e)}")

    def _parse_gemini_json(self, text: str) -> Dict[str, Any]:
        """Parse Gemini text response as JSON safely, handling markdown backticks if any."""
        cleaned_text = text.strip()
        # Strip markdown if Gemini ignored the prompt requirement
        if cleaned_text.startswith("```"):
            if cleaned_text.startswith("```json"):
                cleaned_text = cleaned_text[7:]
            else:
                cleaned_text = cleaned_text[3:]
            if cleaned_text.endswith("```"):
                cleaned_text = cleaned_text[:-3]
            cleaned_text = cleaned_text.strip()

        try:
            parsed = json.loads(cleaned_text)
            # Ensure keys exist with fallback
            return {
                "predicted_label": parsed.get("predicted_label", "UNCERTAIN").upper(),
                "confidence_score": float(parsed.get("confidence_score", 0.0)),
                "confidence_level": parsed.get("confidence_level", "low").lower(),
                "evidence_for_fake": parsed.get("evidence_for_fake", []),
                "evidence_for_real": parsed.get("evidence_for_real", []),
                "uncertainty_reasons": parsed.get("uncertainty_reasons", []),
                "reasoning_summary": parsed.get("reasoning_summary", "Không có tóm tắt phân tích."),
                "recommendation": parsed.get("recommendation", "Không có khuyến nghị."),
                "should_trust_result": bool(parsed.get("should_trust_result", False)),
                "error": False
            }
        except Exception as e:
            logger.error(f"Failed to parse Gemini response as JSON. Raw response: {text}. Error: {str(e)}")
            return self._fallback_response("Failed to parse Gemini structured JSON response.")

    def _fallback_response(self, error_message: str) -> Dict[str, Any]:
        return {
            "predicted_label": "UNCERTAIN",
            "confidence_score": 0.0,
            "confidence_level": "low",
            "evidence_for_fake": [],
            "evidence_for_real": [],
            "uncertainty_reasons": ["Lỗi kết nối: " + error_message],
            "reasoning_summary": f"Không thể lấy kết quả phân tích từ Gemini: {error_message}",
            "recommendation": "Vui lòng xem kết quả dự đoán từ mô hình cục bộ hoặc thử lại sau.",
            "should_trust_result": False,
            "error": True
        }

gemini_service = GeminiService()
