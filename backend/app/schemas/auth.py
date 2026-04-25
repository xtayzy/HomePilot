"""Auth request/response schemas."""
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {"email": "client@example.com", "password": "MyPassword123"},
        }
    )

    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "newuser@example.com",
                "password": "SecurePass8",
                "name": "Айгерим",
                "phone": "+77001234567",
                "locale": "ru",
            }
        }
    )

    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str | None = None
    phone: str | None = None
    locale: str = "ru"


class RegisterExecutorRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "invite_code": "EXECUTOR-INVITE-2026",
                "email": "executor@example.com",
                "password": "SecurePass8",
                "name": "Марат",
                "phone": "+77009876543",
            }
        }
    )

    invite_code: str
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str | None = None
    phone: str | None = None


class RefreshRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {"refresh_token": "<refresh_token_из_ответа_login>"},
        }
    )

    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"example": {"email": "client@example.com"}},
    )

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {"token": "<токен_из_ссылки_или_ответа>", "new_password": "NewSecurePass8"},
        }
    )

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
    model_config = ConfigDict(
        json_schema_extra={"example": {"code": "482916"}},
    )

    code: str = Field(..., min_length=6, max_length=6, description="6-значный код из письма")


class GoogleSignInRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {"id_token": "<credential.id_token_из_Google_OAuth>"},
        }
    )

    id_token: str = Field(..., min_length=20, description="JWT id_token из Google Identity Services")
