# AI Image Detector Backend

This is the FastAPI backend for the AI Image Detector project. It will provide endpoints to run inference on images to detect if they are AI-generated.

## Project Structure

- `app/main.py`: The FastAPI application instance and CORS configuration.
- `app/routes/`: API endpoints (`health`, `predict`, `models`, `metrics`).
- `app/config.py`: Environment variable loading using Pydantic Settings.
- `app/schemas.py`: Pydantic validation schemas.
- `app/services/`: Core logic and model inference (to be implemented).
- `app/core/`: Application-wide core components (e.g., exceptions, logging).

## Setup & Run

1. **Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Variables:**
   Copy `.env.example` to `.env` and customize as needed.
   ```bash
   cp .env.example .env
   ```

4. **Run the server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## Endpoints

- `GET /health`: Health check endpoint.
- `POST /api/v1/predict`: Upload image for detection. Example:
  ```bash
  curl -X POST http://localhost:8000/api/v1/predict \
    -F "file=@../demo/fake.jpg"
  ```
- `POST /api/v1/predict-url`: Predict from image URL. Example:
  ```bash
  curl -X POST http://localhost:8000/api/v1/predict-url \
    -H "Content-Type: application/json" \
    -d '{"image_url": "https://example.com/image.jpg"}'
  ```
- `GET /docs`: Auto-generated Swagger documentation.
