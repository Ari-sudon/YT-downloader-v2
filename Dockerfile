FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg curl unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deno.land/install.sh | sh
ENV PATH="/root/.deno/bin:${PATH}"
WORKDIR /app
COPY . .
RUN chmod +x yt-dlp
EXPOSE 8000
CMD ["python3", "server.py"]
