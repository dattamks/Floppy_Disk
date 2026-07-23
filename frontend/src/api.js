// Minimal API client for the Floppy Disk backend.
// Same-origin in dev via the Vite proxy (/api -> :8000), so Django session
// cookies + CSRF work without cross-origin credential juggling.

const BASE = '/api/v1';

function getCookie(name) {
  const match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
  return match ? decodeURIComponent(match.pop()) : '';
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') {
    const token = getCookie('csrftoken');
    if (token) headers['X-CSRFToken'] = token;
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const err = new Error('Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// Turn a DRF error body into a single human-readable message.
export function firstError(err, fallback = 'Something went wrong. Please try again.') {
  const d = err && err.data;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (d.detail) return Array.isArray(d.detail) ? d.detail[0] : d.detail;
  const firstKey = Object.keys(d)[0];
  if (firstKey) {
    const v = d[firstKey];
    return Array.isArray(v) ? v[0] : String(v);
  }
  return fallback;
}

export const api = {
  getCsrf: () => request('/auth/csrf'),
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  passwordReset: (email) => request('/auth/password-reset', { method: 'POST', body: { email } }),

  // Storage
  listFolders: (parent) => request(`/storage/folders${parent ? `?parent=${parent}` : ''}`),
  createFolder: (name, parent) =>
    request('/storage/folders', { method: 'POST', body: parent ? { name, parent } : { name } }),
  listFiles: (folder) => request(`/storage/files${folder ? `?folder=${folder}` : ''}`),
  usage: () => request('/storage/usage'),
  trash: () => request('/storage/trash'),
  deleteFile: (id) => request(`/storage/files/${id}`, { method: 'DELETE' }),
  restoreFile: (id) => request(`/storage/files/${id}/restore`, { method: 'POST' }),
  purgeFile: (id) => request(`/storage/files/${id}/purge`, { method: 'POST' }),

  // Sharing
  createShare: (fileId, opts = {}) => request(`/storage/files/${fileId}/share`, { method: 'POST', body: opts }),
  listShares: () => request('/storage/shares'),
  revokeShare: (id) => request(`/storage/shares/${id}`, { method: 'DELETE' }),

  // Upload: initiate (reserve quota) -> PUT bytes -> complete (commit + dedup)
  initiateUpload: (payload) => request('/storage/uploads', { method: 'POST', body: payload }),
  completeUpload: (fileId) => request(`/storage/uploads/${fileId}/complete`, { method: 'POST' }),
  uploadBytes: async (url, file) => {
    const headers = { 'Content-Type': 'application/octet-stream' };
    const token = getCookie('csrftoken');
    if (token) headers['X-CSRFToken'] = token;
    const res = await fetch(url, { method: 'PUT', headers, credentials: 'same-origin', body: file });
    if (!res.ok) {
      const err = new Error('Upload failed');
      err.status = res.status;
      throw err;
    }
  },

  // Channels
  listChannels: (mine) => request(`/channels/${mine ? '?mine=1' : ''}`),
  createChannel: (payload) => request('/channels/', { method: 'POST', body: payload }),
  subscribeChannel: (id) => request(`/channels/${id}/subscribe`, { method: 'POST' }),
  unsubscribeChannel: (id) => request(`/channels/${id}/subscribe`, { method: 'DELETE' }),

  // Moderation
  report: (payload) => request('/moderation/reports', { method: 'POST', body: payload }),
};
