import os
import json
import csv
from app.config import settings

class MetricsService:
    def __init__(self):
        # path is relative to backend/app/services/metrics_service.py -> backend/app/services -> backend/app -> backend -> project
        # Wait, os.path.dirname(__file__) = project/backend/app/services
        # dirname twice = project/backend/app
        # dirname thrice = project/backend
        # dirname four times = project
        self.experiments_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 
            "experiments"
        )
        self.summary_path = os.path.join(self.experiments_dir, "summary.json")

    def get_summary(self):
        if not os.path.exists(self.summary_path):
            return {"models": [], "best_model_recommended": None}
        try:
            with open(self.summary_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {"models": [], "best_model_recommended": None}

    def get_models_info(self):
        summary = self.get_summary()
        active_model = settings.MODEL_NAME
        
        available_models = []
        for m in summary.get("models", []):
            role = "champion" if m["model_name"] == active_model else "challenger"
            available_models.append({
                "name": m["model_name"],
                "role": role,
                "clean_f1": float(m.get("clean_f1", 0)),
                "robust_avg_f1": float(m.get("robust_avg_f1", 0))
            })
            
        # Fallback if active_model not in summary
        if not any(m["name"] == active_model for m in available_models):
            available_models.append({
                "name": active_model,
                "role": "champion",
                "clean_f1": 0.0,
                "robust_avg_f1": 0.0
            })
            
        return {
            "active_model": active_model,
            "model_version": settings.VERSION,
            "available_models": available_models
        }

    def get_detailed_metrics(self):
        summary = self.get_summary()
        models = summary.get("models", [])
        
        model_comparison = models
        robustness_results = []
        training_history_summary = []
        
        # Read Robustness Results
        robustness_dir = os.path.join(self.experiments_dir, "robustness_results")
        if os.path.exists(robustness_dir):
            for model_name in [m["model_name"] for m in models]:
                csv_path = os.path.join(robustness_dir, f"{model_name}.csv")
                if os.path.exists(csv_path):
                    try:
                        with open(csv_path, 'r', encoding='utf-8') as f:
                            reader = csv.DictReader(f)
                            robustness_results.append({
                                "model_name": model_name,
                                "data": list(reader)
                            })
                    except Exception:
                        pass

        # Read Training History
        history_dir = os.path.join(self.experiments_dir, "training_history")
        if os.path.exists(history_dir):
            for model_name in [m["model_name"] for m in models]:
                csv_path = os.path.join(history_dir, f"{model_name}.csv")
                if os.path.exists(csv_path):
                    try:
                        with open(csv_path, 'r', encoding='utf-8') as f:
                            reader = csv.DictReader(f)
                            # Limit history to avoid huge JSONs, or just send all since frontend might want charts
                            rows = list(reader)
                            training_history_summary.append({
                                "model_name": model_name,
                                "data": rows
                            })
                    except Exception:
                        pass
        
        return {
            "model_comparison": model_comparison,
            "robustness_results": robustness_results,
            "training_history_summary": training_history_summary
        }

metrics_service = MetricsService()
