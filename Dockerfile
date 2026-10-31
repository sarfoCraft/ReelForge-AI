FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# FFmpeg also installs ffprobe, both are required by ReelForge AI.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Render Free has temporary storage; use a paid persistent disk for retained uploads/exports.
ENV DATA_DIR=/var/data
RUN mkdir -p /var/data/uploads /var/data/exports \
    && chown -R node:node /app /var/data

USER node
EXPOSE 3000
CMD ["npm", "start"]
