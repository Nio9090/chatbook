# ⚠️ IMPORTANTE: better-sqlite3 v13 requiere Node 22+
FROM node:22-slim

WORKDIR /app

# Herramientas para compilar better-sqlite3 desde código fuente si hace falta
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copiar package.json y package-lock.json para aprovechar la caché de Docker
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev

# Copiar el resto del código
COPY . .

# Variables de entorno por defecto (se sobreescriben con fly.toml)
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]