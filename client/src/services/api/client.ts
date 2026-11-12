const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanApiUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const response = await fetch(`${cleanApiUrl}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  let data;
  if (isJson) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const err = new Error((data && data.error) || response.statusText || 'Request failed') as Error & {
      status?: number;
    };
    err.status = response.status;
    throw err;
  }

  return data;
}

export const api = {
  get: (endpoint: string) => fetchWithAuth(endpoint),
  post: (endpoint: string, body: unknown) => fetchWithAuth(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  put: (endpoint: string, body: unknown) => fetchWithAuth(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  patch: (endpoint: string, body?: unknown) => fetchWithAuth(endpoint, {
    method: 'PATCH',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }),
  delete: (endpoint: string) => fetchWithAuth(endpoint, {
    method: 'DELETE',
  }),
};
