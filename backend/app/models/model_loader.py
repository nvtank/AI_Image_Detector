import torch
import timm
import os
import logging
from app.config import settings

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def get_device():
    return torch.device('cuda' if torch.cuda.is_available() else 'cpu')

def load_model():
    model_name = settings.MODEL_NAME
    weights_path = settings.MODEL_WEIGHTS_PATH
    num_classes = settings.MODEL_NUM_CLASSES
    
    logger.info(f"Loading model {model_name} from {weights_path}...")
    
    if not os.path.exists(weights_path):
        logger.error(f"Model weights not found at {weights_path}")
        raise FileNotFoundError(f"Missing model weight file at {weights_path}")
        
    device = get_device()
    
    try:
        # Create model architecture
        model = timm.create_model(model_name, pretrained=False, num_classes=num_classes)
        
        # Load weights
        state_dict = torch.load(weights_path, map_location=device)
        
        # Strip 'module.' prefix if it exists
        if 'state_dict' in state_dict:
            state_dict = state_dict['state_dict']
        elif 'model_state' in state_dict:
            state_dict = state_dict['model_state']
            
        new_state_dict = {}
        for k, v in state_dict.items():
            name = k.replace('module.', '') if k.startswith('module.') else k
            new_state_dict[name] = v
            
        model.load_state_dict(new_state_dict)
        model = model.to(device)
        model.eval()
        
        logger.info(f"Model successfully loaded on {device}")
        return model, device
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise e
