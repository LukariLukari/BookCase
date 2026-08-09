#!/bin/bash
echo "Khởi động Virtual Bookshelf..."

# Start Backend in background
echo "1. Đang khởi động Backend (FastAPI)..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py &
BACKEND_PID=$!

# Start Frontend
echo "2. Đang khởi động Frontend (Next.js)..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "======================================"
echo "Hệ thống đang chạy!"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:8000"
echo "Nhấn Ctrl+C để dừng cả hai."
echo "======================================"

# Handle termination
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait
