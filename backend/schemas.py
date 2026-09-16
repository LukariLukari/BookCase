from pydantic import BaseModel
from typing import Optional, List, Dict
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
    has_file: Optional[bool] = True

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
    target_book_id: Optional[str] = None

class QuoteCreate(BaseModel):
    image_url: Optional[str] = ""
    text_content: Optional[str] = None
    page_number: Optional[int] = None

class QuoteBatchItem(BaseModel):
    text_content: Optional[str] = None
    page_number: Optional[int] = None

class QuoteBatchCreate(BaseModel):
    image_url: Optional[str] = ""
    quotes: List[QuoteBatchItem] = []

class QuoteResponse(BaseModel):
    id: str
    user_book_id: str
    image_url: str
    text_content: Optional[str] = None
    page_number: Optional[int] = None
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class GlobalQuoteResponse(BaseModel):
    id: str
    user_book_id: str
    image_url: str
    text_content: Optional[str] = None
    page_number: Optional[int] = None
    created_at: datetime
    book_title: Optional[str] = None
    book_author: Optional[str] = None
    book_cover_url: Optional[str] = None

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

class UnlinkedBookItem(BaseModel):
    id: str
    title: str
    author: Optional[str] = None
    cover_url: Optional[str] = None
    reason: Optional[str] = None

class FileCheckResponse(BaseModel):
    total_books: int
    healthy_count: int
    unlinked_count: int
    broken_count: Optional[int] = None
    unlinked_books: list[UnlinkedBookItem] = []
    broken_books: list[UnlinkedBookItem] = []


class BookReviewCreate(BaseModel):
    rating: int = 5
    reading_status: Optional[str] = "completed"
    progress_percent: Optional[int] = 100
    review_title: Optional[str] = None
    review_text: Optional[str] = None
    key_takeaway: Optional[str] = None
    favorite_quote: Optional[str] = None
    tags: Optional[str] = None

class BookReviewResponse(BaseModel):
    id: str
    user_id: str
    book_id: Optional[str] = None
    user_book_id: Optional[str] = None
    rating: int
    reading_status: str
    progress_percent: int
    review_title: Optional[str] = None
    review_text: Optional[str] = None
    key_takeaway: Optional[str] = None
    favorite_quote: Optional[str] = None
    tags: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    username: Optional[str] = None
    book_title: Optional[str] = None
    book_author: Optional[str] = None
    book_cover_url: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True

class BookRatingSummaryResponse(BaseModel):
    book_id: str
    average_rating: float = 0.0
    total_reviews: int = 0
    rating_distribution: dict = {}
    reviews: list[BookReviewResponse] = []

class KeyTakeawayItem(BaseModel):
    id: str
    book_id: Optional[str] = None
    book_title: str
    book_author: Optional[str] = None
    book_cover_url: Optional[str] = None
    rating: int
    key_takeaway: str
    favorite_quote: Optional[str] = None
    tags: Optional[str] = None
    created_at: datetime

class ActiveReadItem(BaseModel):
    id: str
    book_id: Optional[str] = None
    book_title: str
    book_author: Optional[str] = None
    book_cover_url: Optional[str] = None
    progress_percent: int
    rating: Optional[int] = None
    reading_status: str
    key_takeaway: Optional[str] = None
    updated_at: Optional[datetime] = None

class ReaderDashboardResponse(BaseModel):
    total_completed: int = 0
    currently_reading: int = 0
    want_to_read: int = 0
    total_reviews: int = 0
    average_rating: float = 0.0
    total_quotes: int = 0
    reading_streak_days: int = 1
    yearly_goal: int = 24
    yearly_goal_progress: int = 0
    genre_distribution: dict = {}
    rating_distribution: dict = {}
    key_takeaways: list[KeyTakeawayItem] = []
    current_reads: list[ActiveReadItem] = []
    recent_reviews: list[BookReviewResponse] = []
