import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class HybridDecisionService:
    def combine_local_and_gemini(
        self,
        local_result: Dict[str, Any],
        gemini_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Combine local machine learning model prediction and Gemini Multimodal analysis
        into a unified, robust hybrid decision with expert recommendations using the user's guidelines.
        """
        local_label = local_result.get("label", local_result.get("predicted_label", "UNCERTAIN")).upper()
        local_conf = local_result.get("confidence", 0.0)
        
        gemini_label = gemini_result.get("predicted_label", "UNCERTAIN").upper()
        gemini_conf = gemini_result.get("confidence_score", 0.0)
        gemini_error = gemini_result.get("error", False)

        # Fallback if Gemini failed or was bypassed
        if gemini_error:
            if local_conf >= 0.65:
                return {
                    "final_decision": local_label,
                    "agreement_status": "gemini_unavailable",
                    "recommendation": "Model tự train tự tin đưa ra dự đoán độc lập (Gemini tắt hoặc lỗi)."
                }
            else:
                return {
                    "final_decision": "UNCERTAIN",
                    "agreement_status": "gemini_unavailable",
                    "recommendation": "Model tự train không đủ tự tin và không có đánh giá từ Gemini. Kết quả không chắc chắn."
                }

        # Rule 1: Local confidence < 0.65
        if local_conf < 0.65:
            return {
                "final_decision": "UNCERTAIN",
                "agreement_status": "local_low_confidence",
                "recommendation": "Model tự train chưa đủ chắc chắn, nên kiểm tra thêm."
            }

        # Rule 2: Gemini label is UNCERTAIN or Gemini confidence score < 0.65
        if gemini_label == "UNCERTAIN" or gemini_conf < 0.65:
            return {
                "final_decision": "UNCERTAIN",
                "agreement_status": "gemini_uncertain",
                "recommendation": "Gemini không đủ bằng chứng để xác nhận kết quả."
            }

        # Rule 3: Both agree
        if local_label == gemini_label:
            return {
                "final_decision": local_label,
                "agreement_status": "agree",
                "recommendation": "Model tự train và Gemini đồng thuận, kết quả có độ tin cậy cao hơn."
            }

        # Rule 4: Disagreement
        return {
            "final_decision": "UNCERTAIN",
            "agreement_status": "disagree",
            "recommendation": "Hai hệ thống không đồng thuận, nên xem kết quả là tham khảo."
        }

hybrid_decision_service = HybridDecisionService()
