# Explainability (Grad-CAM)

Understanding why a Deep Learning model makes a particular prediction is crucial, especially in high-stakes environments like detecting AI-generated images. To enhance trust and transparency, this project incorporates **Grad-CAM** (Gradient-weighted Class Activation Mapping).

## What is Grad-CAM?
Grad-CAM is a technique that produces a visual explanation for decisions made by Convolutional Neural Networks (CNNs). It uses the gradients of any target concept (in our case, 'FAKE' or 'REAL') flowing into the final convolutional layer to produce a coarse localization map highlighting the important regions in the image for predicting the concept.

## How it works in this project
When you call the `POST /explain` API:
1. The backend performs a standard prediction.
2. It then traces the gradients back to the final convolutional layer of the active model (e.g., `conv_head` in EfficientNetV2).
3. A heatmap is generated where red/hot regions indicate areas the model paid the most attention to when making its decision, and blue/cold regions indicate ignored areas.
4. This heatmap is overlaid on the original image and returned as a base64 encoded string.

## Limitations of Grad-CAM
- **Coarse Resolution**: The heatmap resolution is tied to the spatial dimension of the final convolutional layer (often 7x7 or 14x14 before upsampling). It cannot perfectly highlight pixel-level artifacts.
- **Correlation vs Causation**: Grad-CAM shows where the model looked, but not necessarily exactly *what* it saw (e.g., it might highlight a face, but not specify if it was looking at a distorted eye or an unnatural skin texture).
- **Architecture Dependency**: Grad-CAM requires identifying the correct target convolutional layer. If the architecture changes drastically (e.g., Vision Transformers), different interpretability techniques like Attention Rollout might be needed.
