FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && groupadd --gid 10001 studio \
    && useradd --uid 10001 --gid studio --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin studio \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt constraints.txt ./
RUN pip install --no-cache-dir -r requirements.txt -c constraints.txt
COPY . .
EXPOSE 8000
USER 10001:10001
ENTRYPOINT ["python", "-m", "studio_api.container_entrypoint"]
CMD ["uvicorn", "studio_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
