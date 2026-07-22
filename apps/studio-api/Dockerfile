FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt constraints.txt ./
RUN pip install --no-cache-dir -r requirements.txt -c constraints.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "studio_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
