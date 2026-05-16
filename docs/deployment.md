# Deployment Guide

This document outlines how to deploy the AI Image Detector Backend using Docker. Dockerization ensures that the application runs identically on any environment (like an AWS EC2 instance, DigitalOcean Droplet, or your local machine) without dependency conflicts.

## Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed.
- [Docker Compose](https://docs.docker.com/compose/install/) installed (usually comes with Docker Desktop).

## Method 1: Using Docker Compose (Recommended)

Docker Compose is the easiest way to run the application because it automatically handles port mapping, volume mounting (for persisting your SQLite database), and container management.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Build and start the container in detached mode:
   ```bash
   docker compose up -d
   ```
   *(Note: For older Docker versions, the command is `docker-compose up -d`)*

3. Verify the container is running:
   ```bash
   docker ps
   ```

4. To stop the container:
   ```bash
   docker compose down
   ```

## Method 2: Manual Docker Build & Run

If you prefer to run raw Docker commands without Compose:

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Build the Docker image:
   ```bash
   docker build -t ai-detector-backend .
   ```

3. Run the Docker container:
   ```bash
   docker run -d -p 8000:8000 --name ai_backend ai-detector-backend
   ```
   *(Optional: To persist data manually, add `-v $(pwd)/data:/app/data`)*

## Accessing the API
Once deployed, the API will be available at:
- Base URL: `http://localhost:8000` (or your Server's IP address)
- API Docs (Swagger UI): `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`
