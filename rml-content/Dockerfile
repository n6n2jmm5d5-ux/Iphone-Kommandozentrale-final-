FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY rml-content/ ./
ENV NODE_ENV=production RML_DATA_DIR=/data RML_PORT=4177 RML_BIND=0.0.0.0
VOLUME /data
EXPOSE 4177
CMD ["node","server.mjs"]
