"""Auth request/response schemas."""
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str | None = None
    phone: str | None = None
    locale: str = "ru"


class RegisterExecutorRequest(BaseModel):
    invite_code: str
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str | None = None
    phone: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class ConfirmEmailRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6, description="6-значный код из письма")
