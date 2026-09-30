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

const canRefreshFor = (path, options) =>
  !options._retried && !path.startsWith('/auth/refresh') && !path.startsWith('/auth/login') && !path.startsWith('/auth/signup');

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
    credentials: 'include',
    body: options.body && typeof options.body === 'object' ? JSON.stringify(options.body) : options.body,
  });

  if (response.status === 401) {
    if (canRefreshFor(path, options) && getToken()) {
      try {
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
        if (refreshResponse.ok) {
          const refreshed = await refreshResponse.json();
          setSession(refreshed.token, refreshed.user);
          return apiRequest(path, { ...options, _retried: true });
        }
      } catch {
        // Fall through to the normal session-clearing path.
      }
    }
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

async function refreshAccessToken() {
  if (!getToken()) return false;
  try {
    const refreshResponse = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json();
      setSession(refreshed.token, refreshed.user);
      return true;
    }
  } catch {
    // Fall through to session clearing.
  }
  clearSession();
  return false;
}

async function openStream(path, retried = false) {
  const headers = { Accept: 'text/event-stream' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { headers, credentials: 'include' });

  if (response.status === 401 && !retried) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw new Error('Live stream session expired.');
    return openStream(path, true);
  }
  if (!response.ok) throw new Error(`Live stream unavailable (${response.status}).`);
  return response;
}

function parseSseLine(line) {
  const dataLine = line.split('\n').find((part) => part.startsWith('data: '));
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine.slice(6));
  } catch {
    return null;
  }
}

export async function fetchStream(path, { onMessage, signal } = {}) {
  const response = await openStream(path);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const readChunk = async () => {
    while (true) {
      if (signal?.aborted) {
        try {
          reader.cancel();
        } catch (e) {
          // Ignore cancel errors
        }
        return;
      }
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split('\n\n');
      buffer = messages.pop() || '';
      for (const message of messages) {
        const data = parseSseLine(message);
        if (data) onMessage(data);
      }
    }
  };

  try {
    await readChunk();
  } catch (error) {
    if (!signal?.aborted) throw error;
  } finally {
    try {
      reader.cancel();
    } catch (e) {
      // Ignore cancel errors
    }
  }
}
