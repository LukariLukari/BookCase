FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Hugging Face Spaces port
ENV PORT=7860
EXPOSE 7860

# Give permissions to user 1000 (Hugging Face default non-root user)
RUN useradd -m -u 1000 user || true
RUN chown -R 1000:1000 /app || true
USER 1000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
