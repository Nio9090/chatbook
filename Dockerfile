# Usa una imagen oficial y ligera de Node.js
FROM node:20-slim

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Instala las herramientas necesarias para compilar dependencias nativas como better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copia los archivos de dependencias
COPY package*.json ./

# Instala solo las dependencias de producción
RUN npm ci --only=production

# Copia el resto del código de tu aplicación
COPY . .

# Expone el puerto en el que corre tu app (debe coincidir con el de tu server.js)
EXPOSE 3000

# Comando para iniciar tu aplicación
CMD ["node", "server.js"]