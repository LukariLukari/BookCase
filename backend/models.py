from sqlalchemy import Column, String, Integer, DateTime, Text, Index
from sqlalchemy.sql import func
import uuid
from database import Base
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, LargeBinary
from sqlalchemy.orm import relationship

def generate_uuid():
    return str(uuid.uuid4())

class BookFile(Base):
    """
    Lưu trữ file sách vĩnh viễn trong cơ sở dữ liệu (PostgreSQL/SQLite)
    để chống mất file khi Render restart hoặc redeploy (do ổ đĩa của Render là tạm thời).
    """
    __tablename__ = "book_files"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    file_key = Column(String, unique=True, index=True) # e.g. "local_bc78f54f...epub"
    book_id = Column(String, ForeignKey("books.id", ondelete="CASCADE"), nullable=True, index=True)
    filename = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    file_data = Column(LargeBinary, nullable=False)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Book(Base):
    __tablename__ = "books"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    title = Column(String, index=True)
    author = Column(String, index=True, nullable=True)
    genre = Column(String, index=True, nullable=True)
    summary = Column(String, nullable=True)
    cover_url = Column(String, nullable=True)
    drive_file_id = Column(String, nullable=True)
    external_url = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    progress = Column(Integer, default=0)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    collections = relationship("CollectionBook", back_populates="book", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String)
    role = Column(String, default="user") # "admin" or "user"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class OTP(Base):
    __tablename__ = "otps"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    email = Column(String, index=True)
    otp_code = Column(String)
    purpose = Column(String) # "register" or "reset_password"
    expires_at = Column(DateTime(timezone=True))
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Collection(Base):
    __tablename__ = "collections"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    books = relationship("CollectionBook", back_populates="collection", cascade="all, delete-orphan")

class CollectionBook(Base):
    __tablename__ = "collection_books"

    collection_id = Column(String, ForeignKey("collections.id"), primary_key=True)
    book_id = Column(String, ForeignKey("books.id"), primary_key=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    collection = relationship("Collection", back_populates="books")
    book = relationship("Book", back_populates="collections")


class RegistrationCode(Base):
    __tablename__ = "registration_codes"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    code = Column(String, unique=True, index=True)
    is_used = Column(Boolean, default=False)
    used_by_username = Column(String, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

class UserBook(Base):
    __tablename__ = "user_books"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    book_id = Column(String, ForeignKey("books.id"), nullable=True, index=True)
    # Fields for custom books added by user that are not in global DB
    custom_title = Column(String, nullable=True)
    custom_author = Column(String, nullable=True)
    custom_cover_url = Column(String, nullable=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    book = relationship("Book")
    quotes = relationship("Quote", back_populates="user_book", cascade="all, delete-orphan")

class Quote(Base):
    __tablename__ = "quotes"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_book_id = Column(String, ForeignKey("user_books.id"), index=True)
    image_url = Column(String, nullable=True)  # Can store Base64, ImgBB URL, or None
    text_content = Column(String, nullable=True) # Optional text
    page_number = Column(Integer, nullable=True) # Optional page number
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user_book = relationship("UserBook", back_populates="quotes")


class BookReview(Base):
    __tablename__ = "book_reviews"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    book_id = Column(String, ForeignKey("books.id"), nullable=True, index=True)
    user_book_id = Column(String, ForeignKey("user_books.id"), nullable=True, index=True)
    
    rating = Column(Integer, nullable=False, default=5) # 1 to 5 stars
    reading_status = Column(String, default="completed") # "want_to_read", "reading", "completed", "on_hold"
    progress_percent = Column(Integer, default=100) # 0 to 100
    
    review_title = Column(String, nullable=True)
    review_text = Column(String, nullable=True)
    key_takeaway = Column(String, nullable=True) # Bài học cốt lõi / Insight đắt giá
    favorite_quote = Column(String, nullable=True) # Câu trích dẫn tâm đắc
    tags = Column(String, nullable=True) # Nhãn chủ đề: "Tư duy, Kỷ luật, Tài chính"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User")
    book = relationship("Book")
    user_book = relationship("UserBook")


class BusinessInventoryBatch(Base):
    __tablename__ = "business_inventory_batches"
    __table_args__ = (Index("ix_business_inventory_batches_user_created", "user_id", "created_at"),)

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    products = relationship("BusinessProduct", back_populates="batch")
    receipts = relationship("BusinessStockReceipt", back_populates="batch")


class BusinessProduct(Base):
    __tablename__ = "business_products"
    __table_args__ = (Index("ix_business_products_user_active", "user_id", "is_active"),)

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    batch_id = Column(String, ForeignKey("business_inventory_batches.id", ondelete="SET NULL"), index=True, nullable=True)
    name = Column(String, index=True, nullable=False)
    sku = Column(String, nullable=True, index=True)
    category = Column(String, nullable=True, index=True)
    image_url = Column(Text, nullable=True)
    selling_price = Column(Integer, default=0)
    unit_cost = Column(Integer, default=0)
    stock_quantity = Column(Integer, default=0)
    social_link = Column(String, nullable=True)
    supplier_info = Column(Text, nullable=True)
    customer_info = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User")
    batch = relationship("BusinessInventoryBatch", back_populates="products")
    transactions = relationship("BusinessTransaction", back_populates="product", cascade="all, delete-orphan")


class BusinessTransaction(Base):
    __tablename__ = "business_transactions"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    product_id = Column(String, ForeignKey("business_products.id", ondelete="SET NULL"), nullable=True, index=True)
    type = Column(String, index=True, nullable=False)  # "income" or "expense"
    category = Column(String, index=True, nullable=False)
    amount = Column(Integer, default=0)
    quantity = Column(Integer, default=1)
    capital_cost = Column(Integer, default=0)
    shipping_fee = Column(Integer, default=0)
    other_fee = Column(Integer, default=0)
    customer_name = Column(String, nullable=True)
    customer_contact = Column(String, nullable=True)
    social_link = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    transaction_date = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User")
    product = relationship("BusinessProduct", back_populates="transactions")


class BusinessLedger(Base):
    __tablename__ = "business_ledgers"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    name = Column(String, nullable=False)
    month = Column(String, index=True, nullable=False)  # YYYY-MM
    opening_cash = Column(Integer, default=0)
    note = Column(Text, nullable=True)
    is_closed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    orders = relationship("BusinessOrder", back_populates="ledger", cascade="all, delete-orphan")
    expenses = relationship("BusinessExpense", back_populates="ledger", cascade="all, delete-orphan")


class BusinessStockReceipt(Base):
    __tablename__ = "business_stock_receipts"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    batch_id = Column(String, ForeignKey("business_inventory_batches.id", ondelete="SET NULL"), index=True, nullable=True)
    code = Column(String, index=True, nullable=False)
    supplier_name = Column(String, nullable=True)
    extra_cost = Column(Integer, default=0)
    note = Column(Text, nullable=True)
    received_at = Column(DateTime(timezone=True), index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("BusinessStockReceiptItem", back_populates="receipt", cascade="all, delete-orphan")
    batch = relationship("BusinessInventoryBatch", back_populates="receipts")


class BusinessStockReceiptItem(Base):
    __tablename__ = "business_stock_receipt_items"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    receipt_id = Column(String, ForeignKey("business_stock_receipts.id", ondelete="CASCADE"), index=True, nullable=False)
    product_id = Column(String, ForeignKey("business_products.id"), index=True, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Integer, default=0)

    receipt = relationship("BusinessStockReceipt", back_populates="items")
    product = relationship("BusinessProduct")


class BusinessOrder(Base):
    __tablename__ = "business_orders"
    __table_args__ = (Index("ix_business_orders_user_ledger_date", "user_id", "ledger_id", "ordered_at"),)

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    ledger_id = Column(String, ForeignKey("business_ledgers.id", ondelete="CASCADE"), index=True, nullable=False)
    code = Column(String, index=True, nullable=False)
    customer_name = Column(String, index=True, nullable=False)
    customer_contact = Column(String, nullable=True)
    social_link = Column(String, nullable=True)
    shipping_fee = Column(Integer, default=0)  # Tiền ship thu của khách
    shipping_cost = Column(Integer, default=0)  # Tiền thực trả đơn vị vận chuyển
    discount = Column(Integer, default=0)
    other_fee = Column(Integer, default=0)
    payment_status = Column(String, default="paid", index=True)
    status = Column(String, default="confirmed", index=True)
    note = Column(Text, nullable=True)
    ordered_at = Column(DateTime(timezone=True), index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    ledger = relationship("BusinessLedger", back_populates="orders")
    items = relationship("BusinessOrderItem", back_populates="order", cascade="all, delete-orphan")


class BusinessOrderItem(Base):
    __tablename__ = "business_order_items"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    order_id = Column(String, ForeignKey("business_orders.id", ondelete="CASCADE"), index=True, nullable=False)
    product_id = Column(String, ForeignKey("business_products.id"), index=True, nullable=False)
    product_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Integer, default=0)
    unit_cost = Column(Integer, default=0)

    order = relationship("BusinessOrder", back_populates="items")
    product = relationship("BusinessProduct")


class BusinessExpense(Base):
    __tablename__ = "business_expenses"
    __table_args__ = (Index("ix_business_expenses_user_ledger_date", "user_id", "ledger_id", "spent_at"),)

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    ledger_id = Column(String, ForeignKey("business_ledgers.id", ondelete="CASCADE"), index=True, nullable=False)
    category = Column(String, index=True, nullable=False)
    amount = Column(Integer, default=0)
    note = Column(Text, nullable=True)
    spent_at = Column(DateTime(timezone=True), index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ledger = relationship("BusinessLedger", back_populates="expenses")
