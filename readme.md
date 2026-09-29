# ChatBook 💬

Aplicación de chat en tiempo real con registro, login y mensajes privados.

## Tecnologías
- Node.js + Express
- Socket.IO (WebSockets)
- SQLite (better-sqlite3)
- JWT + bcryptjs para autenticación

## Desarrollo local

```bash
npm install
cp .env.example .env
# Edita .env con tu JWT_SECRET
node server.js