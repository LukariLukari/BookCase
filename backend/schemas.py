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


class BusinessProductBase(BaseModel):
    name: str
    batch_id: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    selling_price: int = 0
    unit_cost: int = 0
    stock_quantity: int = 0
    social_link: Optional[str] = None
    supplier_info: Optional[str] = None
    customer_info: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True

class BusinessProductCreate(BusinessProductBase):
    pass

class BusinessProductUpdate(BaseModel):
    name: Optional[str] = None
    batch_id: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    selling_price: Optional[int] = None
    unit_cost: Optional[int] = None
    stock_quantity: Optional[int] = None
    social_link: Optional[str] = None
    supplier_info: Optional[str] = None
    customer_info: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class BusinessProductResponse(BusinessProductBase):
    id: str
    user_id: str
    batch_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    total_income: int = 0
    total_expense: int = 0
    total_profit: int = 0
    sold_quantity: int = 0

    class Config:
        orm_mode = True
        from_attributes = True

class BusinessTransactionBase(BaseModel):
    product_id: Optional[str] = None
    type: str
    category: str
    amount: int = 0
    quantity: int = 1
    capital_cost: int = 0
    shipping_fee: int = 0
    other_fee: int = 0
    customer_name: Optional[str] = None
    customer_contact: Optional[str] = None
    social_link: Optional[str] = None
    note: Optional[str] = None
    transaction_date: Optional[datetime] = None

class BusinessTransactionCreate(BusinessTransactionBase):
    pass

class BusinessTransactionUpdate(BaseModel):
    product_id: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[int] = None
    quantity: Optional[int] = None
    capital_cost: Optional[int] = None
    shipping_fee: Optional[int] = None
    other_fee: Optional[int] = None
    customer_name: Optional[str] = None
    customer_contact: Optional[str] = None
    social_link: Optional[str] = None
    note: Optional[str] = None
    transaction_date: Optional[datetime] = None

class BusinessTransactionResponse(BusinessTransactionBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    product_name: Optional[str] = None
    product_image_url: Optional[str] = None
    net_profit: int = 0

    class Config:
        orm_mode = True
        from_attributes = True

class BusinessSummaryResponse(BaseModel):
    total_income: int = 0
    total_expense: int = 0
    total_capital: int = 0
    total_shipping: int = 0
    total_other_fee: int = 0
    gross_profit: int = 0
    net_profit: int = 0
    active_products: int = 0
    stock_units: int = 0
    sold_units: int = 0
    recent_transactions: list[BusinessTransactionResponse] = []
    top_products: list[BusinessProductResponse] = []


class BusinessLedgerCreate(BaseModel):
    name: str
    month: str
    opening_cash: int = 0
    note: Optional[str] = None


class BusinessLedgerResponse(BusinessLedgerCreate):
    id: str
    user_id: str
    is_closed: bool = False
    order_count: int = 0
    revenue: int = 0
    profit: int = 0
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class BusinessInventoryBatchCreate(BaseModel):
    name: str


class BusinessInventoryBatchResponse(BusinessInventoryBatchCreate):
    id: str
    product_count: int = 0
    stock_quantity: int = 0
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class BusinessStockItemCreate(BaseModel):
    product_id: str
    quantity: int
    unit_cost: int = 0


class BusinessStockReceiptCreate(BaseModel):
    batch_id: Optional[str] = None
    supplier_name: Optional[str] = None
    extra_cost: int = 0
    note: Optional[str] = None
    received_at: Optional[datetime] = None
    items: list[BusinessStockItemCreate]


class BusinessStockItemResponse(BusinessStockItemCreate):
    id: str
    product_name: str


class BusinessStockReceiptResponse(BaseModel):
    id: str
    batch_id: Optional[str] = None
    batch_name: Optional[str] = None
    code: str
    supplier_name: Optional[str] = None
    extra_cost: int = 0
    note: Optional[str] = None
    received_at: datetime
    created_at: datetime
    total_cost: int = 0
    total_quantity: int = 0
    items: list[BusinessStockItemResponse] = []


class BusinessOrderItemCreate(BaseModel):
    product_id: str
    quantity: int
    unit_price: Optional[int] = None


class BusinessOrderCreate(BaseModel):
    ledger_id: str
    customer_name: str
    customer_contact: Optional[str] = None
    social_link: Optional[str] = None
    shipping_fee: int = 0
    shipping_cost: int = 0
    discount: int = 0
    other_fee: int = 0
    payment_status: str = "paid"
    note: Optional[str] = None
    ordered_at: Optional[datetime] = None
    items: list[BusinessOrderItemCreate]


class BusinessOrderItemResponse(BaseModel):
    id: str
    product_id: str
    product_name: str
    quantity: int
    unit_price: int
    unit_cost: int
    line_total: int


class BusinessOrderResponse(BaseModel):
    id: str
    ledger_id: str
    code: str
    customer_name: str
    customer_contact: Optional[str] = None
    social_link: Optional[str] = None
    shipping_fee: int = 0
    shipping_cost: int = 0
    discount: int = 0
    other_fee: int = 0
    payment_status: str
    status: str
    note: Optional[str] = None
    ordered_at: datetime
    created_at: datetime
    subtotal: int = 0
    total: int = 0
    capital_cost: int = 0
    profit: int = 0
    item_count: int = 0
    items: list[BusinessOrderItemResponse] = []


class BusinessExpenseCreate(BaseModel):
    ledger_id: str
    category: str
    amount: int
    note: Optional[str] = None
    spent_at: Optional[datetime] = None


class BusinessExpenseResponse(BusinessExpenseCreate):
    id: str
    user_id: str
    spent_at: datetime
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class BusinessReportResponse(BaseModel):
    ledger_id: str
    revenue: int = 0
    capital_cost: int = 0
    shipping_cost: int = 0
    other_order_fee: int = 0
    operating_expense: int = 0
    gross_profit: int = 0
    net_profit: int = 0
    profit: int = 0
    order_count: int = 0
    sold_units: int = 0
    average_order_value: int = 0
    stock_units: int = 0
    stock_value: int = 0
    daily: list[dict] = []
    top_products: list[dict] = []
    expenses: list[BusinessExpenseResponse] = []


class BusinessBackupRestore(BaseModel):
    payload: dict
