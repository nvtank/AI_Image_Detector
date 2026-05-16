import torch
import torch.nn.functional as F
import numpy as np
import cv2
import base64
from PIL import Image
import time
from app.services.inference_service import inference_service
from app.services.preprocessing import preprocess_image

class GradCAM:
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        
        # Hook handlers
        self.target_layer.register_forward_hook(self.save_activation)
        self.target_layer.register_full_backward_hook(self.save_gradient)

    def save_activation(self, module, input, output):
        self.activations = output

    def save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0]

    def __call__(self, input_tensor, target_category=None):
        self.model.eval()
        self.model.zero_grad()
        
        output = self.model(input_tensor)
        
        if target_category is None:
            target_category = np.argmax(output.cpu().data.numpy())
            
        target = output[0, target_category]
        target.backward(retain_graph=True)
        
        gradients = self.gradients.cpu().data.numpy()[0]
        activations = self.activations.cpu().data.numpy()[0]
        
        weights = np.mean(gradients, axis=(1, 2))
        
        cam = np.zeros(activations.shape[1:], dtype=np.float32)
        for i, w in enumerate(weights):
            cam += w * activations[i]
            
        cam = np.maximum(cam, 0)
        cam = cv2.resize(cam, (input_tensor.shape[3], input_tensor.shape[2]))
        cam = cam - np.min(cam)
        cam = cam / (np.max(cam) + 1e-7)
        return cam, int(target_category)

class GradCAMService:
    def _get_target_layer(self, model):
        # Allow configuring target layer based on architecture
        # EfficientNetV2 in timm
        if hasattr(model, 'conv_head'):
            return model.conv_head
        # ResNet
        elif hasattr(model, 'layer4'):
            return model.layer4[-1].conv3
        # ConvNeXt
        elif hasattr(model, 'stages'):
            return model.stages[-1].blocks[-1].conv_dw
        
        # Fallback to the last children
        children = list(model.children())
        for child in reversed(children):
            if isinstance(child, (torch.nn.Conv2d, torch.nn.Sequential)):
                return child
        
        raise ValueError("Could not automatically determine target layer for Grad-CAM. Please configure manually.")

    def explain(self, image: Image.Image):
        start_time = time.time()
        
        # Get model
        model = inference_service.model
        device = inference_service.device
        
        # Get target layer
        target_layer = self._get_target_layer(model)
        
        # Setup GradCAM
        grad_cam = GradCAM(model, target_layer)
        
        # Preprocess
        input_tensor = preprocess_image(image).unsqueeze(0).to(device)
        input_tensor.requires_grad = True
        
        # Run GradCAM
        cam, target_category = grad_cam(input_tensor)
        
        # Determine label and confidence (same as predict)
        output = model(input_tensor)
        probabilities = torch.nn.functional.softmax(output[0], dim=0)
        fake_prob = probabilities[0].item()
        real_prob = probabilities[1].item()
        
        label = "FAKE" if fake_prob > 0.5 else "REAL"
        confidence = max(fake_prob, real_prob)
        
        # Overlay heatmap
        # Resize image to 224x224 (same as input_tensor)
        img_resized = np.array(image.resize((224, 224)))
        if len(img_resized.shape) == 2:
            img_resized = cv2.cvtColor(img_resized, cv2.COLOR_GRAY2RGB)
        elif img_resized.shape[2] == 4:
            img_resized = cv2.cvtColor(img_resized, cv2.COLOR_RGBA2RGB)
            
        img_resized = img_resized[:, :, ::-1] # RGB to BGR
        img_resized = np.float32(img_resized) / 255
        
        heatmap = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
        heatmap = np.float32(heatmap) / 255
        
        overlay = heatmap + img_resized
        overlay = overlay / np.max(overlay)
        overlay = np.uint8(255 * overlay)
        
        # Convert to base64
        _, buffer = cv2.imencode('.jpg', overlay)
        heatmap_base64 = base64.b64encode(buffer).decode('utf-8')
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        return {
            "label": label,
            "confidence": confidence,
            "heatmap_base64": heatmap_base64,
            "processing_time_ms": processing_time_ms
        }

gradcam_service = GradCAMService()
