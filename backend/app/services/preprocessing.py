from torchvision import transforms
from PIL import Image
from app.config import settings
import torch

def get_transforms():
    """
    Get the standard ImageNet normalization and resizing transforms.
    """
    return transforms.Compose([
        transforms.Resize((settings.INPUT_SIZE, settings.INPUT_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                             std=[0.229, 0.224, 0.225])
    ])

def preprocess_image(image: Image.Image) -> torch.Tensor:
    """
    Preprocess PIL Image to tensor batch.
    """
    # Ensure RGB
    if image.mode != 'RGB':
        image = image.convert('RGB')
        
    transform = get_transforms()
    tensor = transform(image)
    
    # Add batch dimension [1, C, H, W]
    tensor_batch = tensor.unsqueeze(0)
    
    return tensor_batch
