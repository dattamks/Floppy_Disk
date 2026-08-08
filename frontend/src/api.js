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
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
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
  changePassword: (current_password, new_password) =>
    request('/auth/password-change', { method: 'POST', body: { current_password, new_password } }),
  passwordReset: (email) => request('/auth/password-reset', { method: 'POST', body: { email } }),
  passwordResetConfirm: (token, new_password) =>
    request('/auth/password-reset/confirm', { method: 'POST', body: { token, new_password } }),
  verifyEmail: (token) => request('/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: () => request('/auth/verify-email/resend', { method: 'POST' }),

  // Storage
  listFolders: (parent) => request(`/storage/folders${parent ? `?parent=${parent}` : ''}`),
  createFolder: (name, parent) =>
    request('/storage/folders', { method: 'POST', body: parent ? { name, parent } : { name } }),
  updateFolder: (id, patch) => request(`/storage/folders/${id}`, { method: 'PATCH', body: patch }),
  deleteFolder: (id) => request(`/storage/folders/${id}`, { method: 'DELETE' }),
  restoreFolder: (id) => request(`/storage/folders/${id}/restore`, { method: 'POST' }),
  purgeFolder: (id) => request(`/storage/folders/${id}/purge`, { method: 'POST' }),
  listFiles: (folder) => request(`/storage/files${folder ? `?folder=${folder}` : ''}`),
  listMedia: () => request('/storage/media'),
  search: (q) => request(`/storage/search?q=${encodeURIComponent(q)}`),
  usage: () => request('/storage/usage'),
  trash: () => request('/storage/trash'),
  updateFile: (id, patch) => request(`/storage/files/${id}`, { method: 'PATCH', body: patch }),
  updateFileContent: (id, content) =>
    request(`/storage/files/${id}/content`, { method: 'PUT', body: { content } }),
  createNote: (body) => request('/storage/notes', { method: 'POST', body }),
  deleteFile: (id) => request(`/storage/files/${id}`, { method: 'DELETE' }),
  fileDownload: (id, opts) =>
    request(`/storage/files/${id}/download${opts && opts.download ? '?download=1' : ''}`),
  // Stable inline URL for a file's bytes - used as the <img src> for image thumbnails.
  fileRawUrl: (id) => `${BASE}/storage/files/${id}/raw`,
  restoreFile: (id) => request(`/storage/files/${id}/restore`, { method: 'POST' }),
  purgeFile: (id) => request(`/storage/files/${id}/purge`, { method: 'POST' }),

  // Sharing
  createShare: (fileId, opts = {}) =>
    request(`/storage/files/${fileId}/share`, { method: 'POST', body: opts }),
  listShares: () => request('/storage/shares'),
  revokeShare: (id) => request(`/storage/shares/${id}`, { method: 'DELETE' }),

  // Upload: initiate (reserve quota) -> PUT bytes -> complete (commit + dedup)
  initiateUpload: (payload) => request('/storage/uploads', { method: 'POST', body: payload }),
  completeUpload: (fileId) => request(`/storage/uploads/${fileId}/complete`, { method: 'POST' }),
  uploadBytes: async (url, file) => {
    const headers = { 'Content-Type': 'application/octet-stream' };
    const token = getCookie('csrftoken');
    if (token) headers['X-CSRFToken'] = token;
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      credentials: 'same-origin',
      body: file,
    });
    if (!res.ok) {
      const err = new Error('Upload failed');
      err.status = res.status;
      throw err;
    }
  },

  // Video
  play: (fileId) => request(`/storage/files/${fileId}/play`, { method: 'POST' }),

  // Account / compliance (DPDPA)
  updateSettings: (patch) => request('/auth/account/settings', { method: 'PATCH', body: patch }),
  deleteAccount: () => request('/auth/account/delete', { method: 'POST' }),
  signOutOtherSessions: () => request('/auth/account/sessions/revoke-others', { method: 'POST' }),
  folderDownloadUrl: (id) => `${BASE}/storage/folders/${id}/download`,
  bulkDownloadUrl: (ids) => `${BASE}/storage/download?ids=${ids.map(encodeURIComponent).join(',')}`,
  setAvatar: (dataUrl) => request('/auth/account/avatar', { method: 'PATCH', body: { avatar: dataUrl } }),
  removeAvatar: () => request('/auth/account/avatar', { method: 'DELETE' }),
  exportData: () => request('/auth/account/export', { method: 'POST' }),
  logConsent: (policy, version) =>
    request('/auth/account/consent', { method: 'POST', body: { policy, version } }),

  // Notifications
  notifications: () => request('/notifications/'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  // Knowledge graph
  graph: () => request('/graph/'),
  graphRelated: (fileId) => request(`/graph/related/${fileId}`),
  graphMentions: (fileId) => request(`/graph/mentions/${fileId}`),

  // API keys (programmatic / MCP access). `root_folder` (a folder id) confines
  // the key to that folder's subtree - including the knowledge graph.
  listApiKeys: () => request('/auth/api-keys'),
  createApiKey: ({ name, readOnly, rootFolder } = {}) =>
    request('/auth/api-keys', {
      method: 'POST',
      body: {
        name: name || '',
        read_only: !!readOnly,
        ...(rootFolder ? { root_folder: rootFolder } : {}),
      },
    }),
  revokeApiKey: (id) => request(`/auth/api-keys/${id}`, { method: 'DELETE' }),

  // Storage administration (owner only). Where uploaded files live: local disk
  // or Cloudflare R2. The secret is write-only - never returned by the server.
  storageConfig: () => request('/admin/storage/'),
  saveStorageConfig: (patch) => request('/admin/storage/', { method: 'PUT', body: patch }),
  testStorage: (creds) => request('/admin/storage/test', { method: 'POST', body: creds }),
  storageMigration: () => request('/admin/storage/migrate'),
  startStorageMigration: (deleteLocal) =>
    request('/admin/storage/migrate', { method: 'POST', body: { delete_local: !!deleteLocal } }),
  pauseStorageMigration: () => request('/admin/storage/migrate/pause', { method: 'POST' }),

  // --- Tables (structured data; a first-class entity like files/notes) ---
  listTables: () => request('/tables/'),
  getTable: (id) => request(`/tables/${id}`),
  createTable: (body) => request('/tables/', { method: 'POST', body }),
  updateTable: (id, patch) => request(`/tables/${id}`, { method: 'PATCH', body: patch }),
  deleteTable: (id) => request(`/tables/${id}`, { method: 'DELETE' }),
  tableRows: (id) => request(`/tables/${id}/rows`),
  createRow: (id, data) => request(`/tables/${id}/rows`, { method: 'POST', body: { data } }),
  bulkDeleteRows: (id, ids) => request(`/tables/${id}/rows/bulk_delete`, { method: 'POST', body: { ids } }),
  updateRow: (rowId, data) => request(`/tables/rows/${rowId}`, { method: 'PATCH', body: { data } }),
  deleteRow: (rowId) => request(`/tables/rows/${rowId}`, { method: 'DELETE' }),
  createField: (id, body) => request(`/tables/${id}/fields`, { method: 'POST', body }),
  updateField: (fieldId, patch) => request(`/tables/fields/${fieldId}`, { method: 'PATCH', body: patch }),
  deleteField: (fieldId) => request(`/tables/fields/${fieldId}`, { method: 'DELETE' }),
  createView: (id, body) => request(`/tables/${id}/views`, { method: 'POST', body }),
  updateView: (viewId, patch) => request(`/tables/views/${viewId}`, { method: 'PATCH', body: patch }),
  deleteView: (viewId) => request(`/tables/views/${viewId}`, { method: 'DELETE' }),
};
