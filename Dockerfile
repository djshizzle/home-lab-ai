FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY pyproject.toml .
RUN pip install --no-cache-dir -e "."

# App source
COPY avops/ ./avops/

# Non-root user
RUN useradd -m -u 1000 avops && chown -R avops:avops /app
USER avops

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD curl -f http://localhost:8080/api/health || exit 1

CMD ["uvicorn", "avops.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
