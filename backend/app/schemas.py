from pydantic import BaseModel

class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str
