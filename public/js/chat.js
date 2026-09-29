const socket = io();

const chatApp       = document.getElementById('chat-app');
const userListEl    = document.getElementById('user-list');
const userSearch    = document.getElementById('user-search');
const currentUserEl = document.getElementById('current-user');
const logoutBtn     = document.getElementById('logout-btn');
const backBtn       = document.getElementById('back-btn');
const chatTitle     = document.getElementById('chat-title');
const chatStatus    = document.getElementById('chat-status');
const messagesEl    = document.getElementById('messages');
const emptyState    = document.getElementById('empty-state');
const typingEl      = document.getElementById('typing-indicator');
const form          = document.getElementById('message-form');
const input         = document.getElementById('message-input');
const sendBtn       = form.querySelector('button[type="submit"]');

let currentUser = null;
let allUsers = [];
let selectedUserId = null;
let onlineUsers = new Set();
let typingTimeout;

// ---------- Utilidades ----------
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ---------- Carga inicial ----------
Promise.all([
  fetch('/api/auth/me', { credentials: 'same-origin' }).then(r => {
    if (!r.ok) throw new Error('no auth');
    return r.json();
  }),
  fetch('/api/users', { credentials: 'same-origin' }).then(r => {
    if (!r.ok) throw new Error('no users');
    return r.json();
  })
])
  .then(([meData, usersData]) => {
    currentUser = meData.user;
    currentUserEl.textContent = '@' + currentUser.username;
    allUsers = usersData.users;
    renderUserList();
  })
  .catch(() => {
    window.location.href = '/';
  });

// ---------- Lista de usuarios ----------
function renderUserList() {
  const filter = userSearch.value.trim().toLowerCase();
  userListEl.innerHTML = '';

  const filtered = allUsers.filter(u =>
    u.username.toLowerCase().includes(filter)
  );

  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'user-empty';
    li.textContent = filter ? 'Sin resultados' : 'Aún no hay otros usuarios';
    userListEl.appendChild(li);
    return;
  }

  filtered.forEach(u => {
    const isOnline = onlineUsers.has(u.id);
    const li = document.createElement('li');
    li.className = 'user-item' + (u.id === selectedUserId ? ' active' : '');
    li.dataset.userId = u.id;
    li.innerHTML = `
      <div class="avatar">
        ${escapeHtml(u.username.charAt(0).toUpperCase())}
        <span class="dot ${isOnline ? 'online' : ''}"></span>
      </div>
      <div class="user-info">
        <div class="user-name">${escapeHtml(u.username)}</div>
        <div class="user-status">${isOnline ? 'En línea' : 'Desconectado'}</div>
      </div>
    `;
    li.addEventListener('click', () => selectUser(u.id));
    userListEl.appendChild(li);
  });
}

userSearch.addEventListener('input', renderUserList);

// ---------- Selección de usuario ----------
function selectUser(userId) {
  selectedUserId = userId;
  const u = allUsers.find(x => x.id === userId);
  if (!u) return;

  chatTitle.textContent = u.username;
  updateChatStatus();

  messagesEl.innerHTML = '';
  typingEl.textContent = '';
  emptyState.style.display = 'none';
  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();

  socket.emit('load conversation', userId);

  renderUserList();
  chatApp.classList.add('chat-open');
}

function updateChatStatus() {
  if (!selectedUserId) {
    chatStatus.textContent = '';
    return;
  }
  chatStatus.textContent = onlineUsers.has(selectedUserId) ? '🟢 En línea' : '⚪ Desconectado';
}

backBtn.addEventListener('click', () => {
  chatApp.classList.remove('chat-open');
});

// ---------- Mensajes ----------
function addMessage(msg) {
  const isOwn = msg.sender_id === currentUser.id;
  const div = document.createElement('div');
  div.className = 'message' + (isOwn ? ' own' : '');
  div.innerHTML = `
    <div class="message-content">${escapeHtml(msg.content)}</div>
    <div class="message-meta">
      <span class="message-time">${formatTime(msg.created_at)}</span>
    </div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

socket.on('conversation history', ({ withUser, messages }) => {
  if (withUser !== selectedUserId) return;
  messagesEl.innerHTML = '';
  messages.forEach(addMessage);
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

socket.on('private message', (msg) => {
  // ¿Este mensaje pertenece a la conversación abierta?
  if (!selectedUserId) return;
  const belongs =
    (msg.sender_id === currentUser.id && msg.recipient_id === selectedUserId) ||
    (msg.sender_id === selectedUserId && msg.recipient_id === currentUser.id);

  if (belongs) {
    addMessage(msg);
  } else if (msg.sender_id !== currentUser.id) {
    // Notificación visual opcional en la lista
    const item = userListEl.querySelector(`[data-user-id="${msg.sender_id}"]`);
    if (item) item.classList.add('unread');
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!selectedUserId) return;
  const content = input.value.trim();
  if (!content) return;

  socket.emit('private message', { to: selectedUserId, content });
  input.value = '';
  socket.emit('typing', { to: selectedUserId, isTyping: false });
});

// ---------- Escribiendo ----------
input.addEventListener('input', () => {
  if (!selectedUserId) return;
  socket.emit('typing', { to: selectedUserId, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { to: selectedUserId, isTyping: false });
  }, 1500);
});

socket.on('typing', ({ from, fromUsername, isTyping }) => {
  if (from !== selectedUserId) return;
  typingEl.textContent = isTyping ? `${fromUsername} está escribiendo...` : '';
});

// ---------- Usuarios en línea ----------
socket.on('online users', (ids) => {
  onlineUsers = new Set(ids);
  renderUserList();
  updateChatStatus();
});

// ---------- Logout ----------
logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.href = '/';
});