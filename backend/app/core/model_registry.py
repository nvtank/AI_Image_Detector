from app.models.model_loader import load_model

class ModelRegistry:
    _instance = None
    
    def __init__(self):
        self.model = None
        self.device = None
        
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
        
    def load(self):
        if self.model is None:
            self.model, self.device = load_model()
            
    def get_model(self):
        if self.model is None:
            self.load()
        return self.model, self.device

# Global instance
model_registry = ModelRegistry.get_instance()
