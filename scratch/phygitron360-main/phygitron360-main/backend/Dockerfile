FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
# gcc and libpq-dev are often required for building psycopg2 and other native extensions
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code into the 'backend' directory
# so that the python module imports (backend.modules...) work correctly
COPY . ./backend/

# Expose the port Uvicorn runs on
EXPOSE 8000

# Start the FastAPI application as a module
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
