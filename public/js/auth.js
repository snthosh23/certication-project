// Authentication Helper Script

const API_BASE = '/api/auth';

// 1. Storage Helpers
function saveAuth(token, user) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
}

function getAuthToken() {
  return localStorage.getItem('auth_token');
}

function getAuthUser() {
  const user = localStorage.getItem('auth_user');
  return user ? JSON.parse(user) : null;
}

function isAuthenticated() {
  return !!getAuthToken();
}

// 2. Auth Guard redirects
function checkAuthGuard() {
  const path = window.location.pathname;
  
  if (path.includes('dashboard.html') && !isAuthenticated()) {
    window.location.href = 'login.html';
  }
  
  if (path.includes('login.html') && isAuthenticated()) {
    window.location.href = 'dashboard.html';
  }
}

// 3. API Actions
async function loginAdmin(email, password) {
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    if (data.success) {
      saveAuth(data.token, data.user);
      showToast('Logged in successfully', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 1000);
    } else {
      showToast(data.message || 'Login credentials invalid', 'error');
    }
  } catch (error) {
    console.error('Login action error:', error);
    showToast('Network error, please try again.', 'error');
  }
}

async function registerAdmin(username, email, password) {
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    
    const data = await res.json();
    if (data.success) {
      saveAuth(data.token, data.user);
      showToast('Account initialized successfully!', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 1000);
    } else {
      showToast(data.message || 'System initialization failed', 'error');
    }
  } catch (error) {
    console.error('Register action error:', error);
    showToast('Network error, please try again.', 'error');
  }
}

// 4. Form Handlers on Login Page
document.addEventListener('DOMContentLoaded', () => {
  // Check auth immediately
  checkAuthGuard();
  
  const toRegLink = document.getElementById('toRegisterLink');
  const toLogLink = document.getElementById('toLoginLink');
  const logSection = document.getElementById('loginFormSection');
  const regSection = document.getElementById('registerFormSection');
  
  if (toRegLink && toLogLink) {
    toRegLink.addEventListener('click', (e) => {
      e.preventDefault();
      logSection.style.display = 'none';
      regSection.style.display = 'block';
    });
    
    toLogLink.addEventListener('click', (e) => {
      e.preventDefault();
      regSection.style.display = 'none';
      logSection.style.display = 'block';
    });
  }
  
  // Submit handlers
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const pass = document.getElementById('loginPassword').value;
      loginAdmin(email, pass);
    });
  }
  
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = document.getElementById('registerUsername').value;
      const email = document.getElementById('registerEmail').value;
      const pass = document.getElementById('registerPassword').value;
      registerAdmin(user, email, pass);
    });
  }
  
  // Logout handler
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAuth();
      window.location.href = 'index.html';
    });
  }
});

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '<i class="fa-solid fa-info-circle"></i>';
  if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
  if (type === 'error') icon = '<i class="fa-solid fa-circle-xmark"></i>';
  if (type === 'warning') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
  
  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
