// ═══════════════════════════════════════════
//  TripYatra — Shared Utilities
// ═══════════════════════════════════════════

const API_BASE = 'http://localhost:5001/api';

// ─── Session / Token Management ───────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('tripyatra_token'),
  getUser:  () => { try { return JSON.parse(localStorage.getItem('tripyatra_user')); } catch { return null; } },
  setSession: (token, user) => {
    localStorage.setItem('tripyatra_token', token);
    localStorage.setItem('tripyatra_user', JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem('tripyatra_token');
    localStorage.removeItem('tripyatra_user');
  },
  isLoggedIn: () => !!localStorage.getItem('tripyatra_token'),
  requireAuth: () => {
    if (!Auth.isLoggedIn()) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  },
  requireGuest: () => {
    if (Auth.isLoggedIn()) {
      window.location.href = '/dashboard.html';
      return false;
    }
    return true;
  }
};

// ─── API Client ────────────────────────────────────────────
const api = {
  async request(method, endpoint, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const token = Auth.getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body)  opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        Auth.clearSession();
        window.location.href = '/login.html';
        return Promise.reject(new Error(data.error || 'Session expired. Please log in again.'));
      }
      throw new Error(data.error || 'Something went wrong');
    }
    return data;
  },
  get:    (ep)         => api.request('GET',    ep),
  post:   (ep, body)   => api.request('POST',   ep, body),
  delete: (ep)         => api.request('DELETE', ep),
};

// ─── Toast Notifications ───────────────────────────────────
function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ─── Global AI Loader ──────────────────────────────────────
function startAILoader(message = 'AI is crafting your journey...') {
  let loader = document.getElementById('ai-pulse-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'ai-pulse-loader';
    loader.className = 'ai-loader-overlay';
    loader.innerHTML = `
      <div class="ai-loader-content">
        <div class="train-loader-container">
          <div class="train-icon">🚂</div>
          <div class="train-track"></div>
        </div>
        <div class="ai-loader-text">
          <h3 id="ai-loader-msg" class="font-display"></h3>
          <p>Please wait, this might take a few seconds...</p>
        </div>
      </div>
    `;
    document.body.appendChild(loader);
  }
  document.getElementById('ai-loader-msg').textContent = message;
  // Trigger layout to ensure animation happens
  void loader.offsetWidth;
  loader.classList.add('active');
}

function stopAILoader() {
  const loader = document.getElementById('ai-pulse-loader');
  if (loader) {
    loader.classList.remove('active');
  }
}

// ─── Navbar Renderer ───────────────────────────────────────
function renderNavbar(activePage = '') {
  const user = Auth.getUser();
  const initial = user?.name ? user.name[0].toUpperCase() : '?';
  const html = `
    <nav class="navbar">
      <a href="/dashboard.html" class="navbar-logo">Trip<span>Yatra</span></a>
      <div class="navbar-actions">
        <div class="nav-user">
          <div class="nav-avatar">${initial}</div>
          <span>${user?.name || 'User'}</span>
        </div>
        <button class="btn btn-ghost" onclick="logout()" style="padding:8px 14px;font-size:0.82rem">Sign Out</button>
      </div>
    </nav>`;
  const el = document.getElementById('navbar');
  if (el) el.innerHTML = html;
}

function logout() {
  Auth.clearSession();
  showToast('Logged out successfully', 'info');
  setTimeout(() => window.location.href = '/login.html', 500);
}

// ─── Date Helpers ──────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ─── Train type → badge color ──────────────────────────────
function trainBadgeClass(type = '') {
  const t = type.toLowerCase();
  if (t.includes('rajdhani') || t.includes('shatabdi')) return 'badge-yellow';
  if (t.includes('vande')    || t.includes('tejas'))    return 'badge-purple';
  if (t.includes('express')  || t.includes('superfast'))return 'badge-orange';
  return 'badge-blue';
}
