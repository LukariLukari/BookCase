from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BookBase(BaseModel):
    title: str
    author: Optional[str] = None
    genre: Optional[str] = None
    summary: Optional[str] = None
    cover_url: Optional[str] = None
    drive_file_id: Optional[str] = None
    external_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    progress: Optional[int] = 0

class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    genre: Optional[str] = None
    summary: Optional[str] = None
    cover_url: Optional[str] = None
    external_url: Optional[str] = None

class BookBulkDelete(BaseModel):
    book_ids: list[str]

class BookLinkCreate(BaseModel):
    title: str
    author: Optional[str] = "Unknown Author"
    genre: Optional[str] = None
    cover_url: Optional[str] = None
    external_url: str

class BookCreate(BookBase):
    pass

from pydantic import validator, root_validator

class BookResponse(BookBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    @root_validator(pre=False, skip_on_failure=True)
    def parse_cover_url_root(cls, values):
        cover_url = values.get('cover_url')
        book_id = values.get('id')
        if book_id and cover_url and isinstance(cover_url, str):
            # If cover_url is a heavy base64 string or local relative path, serve via lightweight endpoint
            if cover_url.startswith("data:image") or cover_url.startswith("/uploads") or cover_url.startswith("uploads"):
                values['cover_url'] = f"/api/books/cover/{book_id}"
        return values

    class Config:
        orm_mode = True
        from_attributes = True

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    otp_code: Optional[str] = None
    registration_code: str
    role: Optional[str] = "user"

class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    role: str
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class OTPRequest(BaseModel):
    email: str
    purpose: str # "register" or "reset_password"
    registration_code: Optional[str] = None

class RegistrationCodeResponse(BaseModel):
    id: str
    code: str
    is_used: bool
    used_by_username: Optional[str] = None
    created_at: datetime
    created_by: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True

class PasswordReset(BaseModel):
    email: str
    otp_code: str
    new_password: str

class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class CollectionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    book_count: int = 0

    class Config:
        orm_mode = True
        from_attributes = True

class CollectionDetailResponse(CollectionResponse):
    books: list[BookResponse] = []
