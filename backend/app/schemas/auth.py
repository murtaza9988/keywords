from pydantic import BaseModel

class Token(BaseModel):
    """Token schema."""
    token: str
    token_type: str = "bearer"

class TokenResponse(BaseModel):
    """Token response schema with refresh token."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    """Token payload schema."""
    username: str = None

class LoginRequest(BaseModel):
    """Login request schema."""
    username: str
    password: str

class RefreshTokenRequest(BaseModel):
    """Refresh token request schema."""
    refresh_token: str