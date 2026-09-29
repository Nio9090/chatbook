const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const messageEl = document.getElementById('auth-message');
const tabs = document.querySelectorAll('.tab');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    if (target === 'login') {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
    }
    messageEl.textContent = '';
  });
});

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'same-origin'
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Error de conexión');
  return json;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.textContent = '';
  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  try {
    await postJSON('/api/auth/login', { email, password });
    window.location.href = '/chat.html';
  } catch (err) {
    messageEl.textContent = err.message;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.textContent = '';
  const username = registerForm.username.value.trim();
  const email = registerForm.email.value.trim();
  const password = registerForm.password.value;

  try {
    await postJSON('/api/auth/register', { username, email, password });
    window.location.href = '/chat.html';
  } catch (err) {
    messageEl.textContent = err.message;
  }
});