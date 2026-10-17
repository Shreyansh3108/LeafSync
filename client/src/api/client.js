export class ApiError extends Error {
  constructor(status, errorEnvelope, requestId) {
    super(errorEnvelope?.message || 'Request failed');
    this.status = status;
    this.code = errorEnvelope?.code || 'INTERNAL';
    this.details = errorEnvelope?.details || [];
    this.requestId = requestId;
  }
}

export async function apiFetch(path, options = {}) {
  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  const res = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.error, data.requestId);
  }

  return data;
}