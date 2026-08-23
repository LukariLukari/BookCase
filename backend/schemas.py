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

class BookReorderRequest(BaseModel):
    book_ids: list[str]

class BookLinkCreate(BaseModel):
    title: str
    author: Optional[str] = "Unknown Author"
    genre: Optional[str] = None
    cover_url: Optional[str] = None
    external_url: str

class BookCreate(BookBase):
    pass

from pydantic import validator, root_validator, model_validator

class BookResponse(BookBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    @model_validator(mode='after')
    def parse_cover_url_root(self):
        if self.id and self.cover_url and isinstance(self.cover_url, str):
            if self.cover_url.startswith("data:image") or self.cover_url.startswith("/uploads") or self.cover_url.startswith("uploads"):
                self.cover_url = f"/api/books/cover/{self.id}"
        return self

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

class ExternalSearchItem(BaseModel):
    id: str
    title: str
    author: Optional[str] = None
    extension: Optional[str] = None
    size: Optional[str] = None
    language: Optional[str] = None

class ExternalImportRequest(BaseModel):
    id: str
    title: str
    author: Optional[str] = None

class QuoteCreate(BaseModel):
    image_url: str
    text_content: Optional[str] = None

class QuoteResponse(BaseModel):
    id: str
    user_book_id: str
    image_url: str
    text_content: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class UserBookCreate(BaseModel):
    book_id: Optional[str] = None
    custom_title: Optional[str] = None
    custom_author: Optional[str] = None
    custom_cover_url: Optional[str] = None

class UserBookResponse(BaseModel):
    id: str
    user_id: str
    book_id: Optional[str] = None
    custom_title: Optional[str] = None
    custom_author: Optional[str] = None
    custom_cover_url: Optional[str] = None
    added_at: datetime
    book: Optional[BookResponse] = None

    class Config:
        orm_mode = True
        from_attributes = True
