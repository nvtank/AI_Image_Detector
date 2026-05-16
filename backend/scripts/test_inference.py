import sys
import os
import argparse
from PIL import Image

# Add backend to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.inference_service import inference_service

def main():
    parser = argparse.ArgumentParser(description="Test AI Image Detector Inference")
    parser.add_argument("--image", required=True, help="Path to the image file")
    args = parser.parse_args()
    
    if not os.path.exists(args.image):
        print(f"Error: Image {args.image} not found.")
        sys.exit(1)
        
    try:
        image = Image.open(args.image)
        
        result = inference_service.predict(image)
        
        print(f"Label: {result['label']}")
        print(f"Confidence: {result['confidence']*100:.2f}%")
        print(f"Model: {result['model_used']}")
        print(f"Processing time: {result['processing_time_ms']}ms")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
