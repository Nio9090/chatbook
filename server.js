require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./db');
const authRoutes = require('./routes/auth');
const { JWT_SECRET, authenticateToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);

// Lista de todos los usuarios (excepto yo)
app.get('/api/users', authenticateToken, (req, res) => {
  const users = db
    .prepare('SELECT id, username FROM users WHERE id != ? ORDER BY username COLLATE NOCASE')
    .all(req.user.id);
  res.json({ users });
});

// ---- Socket.IO ----
io.use((socket, next) => {
  const cookies = socket.handshake.headers.cookie;
  if (!cookies) return next(new Error('No autenticado'));

  const token = cookies.split('; ').find(c => c.startsWith('token='))?.split('=')[1];
  if (!token) return next(new Error('No autenticado'));

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload;
    next();
  } catch {
    next(new Error('Token inválido'));
  }
});

// userId -> número de sockets activos (puede estar abierto en varios dispositivos)
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const myId = socket.user.id;

  // Cada usuario tiene su propia "sala" para recibir mensajes
  socket.join(`user:${myId}`);

  // Marcar en línea
  onlineUsers.set(myId, (onlineUsers.get(myId) || 0) + 1);
  io.emit('online users', Array.from(onlineUsers.keys()));

  // Cargar conversación con otro usuario
  socket.on('load conversation', (otherId) => {
    const other = Number(otherId);
    if (!Number.isInteger(other)) return;

    const messages = db.prepare(`
      SELECT id, sender_id, recipient_id, content, created_at
      FROM messages
      WHERE (sender_id = ? AND recipient_id = ?)
         OR (sender_id = ? AND recipient_id = ?)
      ORDER BY id ASC
      LIMIT 500
    `).all(myId, other, other, myId);

    socket.emit('conversation history', { withUser: other, messages });
  });

  // Enviar mensaje privado
  socket.on('private message', ({ to, content }) => {
    const recipientId = Number(to);
    if (!Number.isInteger(recipientId)) return;

    const trimmed = String(content || '').trim();
    if (!trimmed || trimmed.length > 500) return;

    const recipient = db.prepare('SELECT id, username FROM users WHERE id = ?').get(recipientId);
    if (!recipient) return;

    const result = db
      .prepare('INSERT INTO messages (sender_id, recipient_id, content) VALUES (?, ?, ?)')
      .run(myId, recipientId, trimmed);

    const msg = {
      id: result.lastInsertRowid,
      sender_id: myId,
      recipient_id: recipientId,
      sender_username: socket.user.username,
      content: trimmed,
      created_at: new Date().toISOString()
    };

    // Enviar al receptor y al emisor (para reflejarlo en su propia ventana)
    io.to(`user:${recipientId}`).emit('private message', msg);
    io.to(`user:${myId}`).emit('private message', msg);
  });

  // Indicador de "está escribiendo" solo al destinatario
  socket.on('typing', ({ to, isTyping }) => {
    const recipientId = Number(to);
    if (!Number.isInteger(recipientId)) return;
    io.to(`user:${recipientId}`).emit('typing', {
      from: myId,
      fromUsername: socket.user.username,
      isTyping: !!isTyping
    });
  });

  socket.on('disconnect', () => {
    const count = (onlineUsers.get(myId) || 1) - 1;
    if (count <= 0) onlineUsers.delete(myId);
    else onlineUsers.set(myId, count);
    io.emit('online users', Array.from(onlineUsers.keys()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});