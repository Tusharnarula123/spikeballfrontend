'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';
import { apiFetch } from '@/lib/api';

/** Authenticated fetch wrapper — attaches the Clerk session JWT when signed in. */
export function useApi() {
  const { getToken, isLoaded } = useAuth();

  const fetchApi = useCallback(
    async (path: string, init?: RequestInit) => {
      // Always request a token; getToken() returns null when there is no session.
      const token = await getToken();
      return apiFetch(path, init ?? {}, token);
    },
    [getToken],
  );

  return { fetchApi, isLoaded };
}
