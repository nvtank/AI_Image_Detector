from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas import UserCreate, UserLogin, AuthResponse, UserResponse
from app.services import auth_service
from app.core.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: UserCreate):
    """Register a new user account."""
    try:
        user = auth_service.create_user(
            full_name=body.full_name,
            email=body.email,
            password=body.password,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    token = auth_service.create_access_token({"sub": str(user["id"])})
    return AuthResponse(user=UserResponse(**user), access_token=token)


@router.post("/login", response_model=AuthResponse)
async def login(body: UserLogin):
    """Authenticate and receive JWT token."""
    user = auth_service.authenticate_user(body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = auth_service.create_access_token({"sub": str(user["id"])})
    return AuthResponse(user=UserResponse(**user), access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return currently authenticated user."""
    return UserResponse(**current_user)
