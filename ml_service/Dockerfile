# ml_service/Dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# We use --host 0.0.0.0 so Docker allows outside access
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]