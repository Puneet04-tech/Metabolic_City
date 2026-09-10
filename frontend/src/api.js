const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'metabolic-city-token';
const USER_KEY = 'metabolic-city-user';

export { API_URL, TOKEN_KEY, USER_KEY };

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body === 'object' ? JSON.stringify(options.body) : options.body,
  });

  if (response.status === 401) {
    clearSession();
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (data && data.message) || 'Request failed.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}
