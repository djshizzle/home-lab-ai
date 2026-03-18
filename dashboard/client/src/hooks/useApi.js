import { useState, useCallback } from 'react';

const BASE = '/api';

export function useApi() {
  const [loading, setLoading] = useState(false);

  const request = useCallback(async (path, options = {}) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await res.json();
      }
      return await res.text();
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback((path) => request(path), [request]);
  const post = useCallback((path, body) => request(path, { method: 'POST', body }), [request]);
  const del = useCallback((path) => request(path, { method: 'DELETE' }), [request]);

  return { get, post, del, loading };
}
