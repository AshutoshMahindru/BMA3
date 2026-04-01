/* ══════════════════════════════════════════════════════════════════════════
   useApiData — Generic hook for try-first, fallback-silently pattern

   Usage:
     const { data, source, loading, error, refetch } = useApiData(
       () => fetchPnl(scenarioId),      // API call
       PNL_DATA,                        // static fallback
       [scenarioId]                     // dependency array
     );

   Returns:
     data    — live API data OR static fallback (never null)
     source  — 'api' | 'static' | 'loading'
     loading — true during initial fetch
     error   — error message if API failed (data still populated from fallback)
     refetch — manual re-trigger
   ══════════════════════════════════════════════════════════════════════ */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ApiResult } from './api';

export type DataSource = 'api' | 'static' | 'loading';

export interface UseApiDataResult<T> {
  data: T;
  source: DataSource;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  lastFetched: Date | null;
}

export function useApiData<T>(
  apiFn: () => Promise<ApiResult<T>>,
  fallback: T,
  deps: any[] = []
): UseApiDataResult<T> {
  const [data, setData] = useState<T>(fallback);
  const [source, setSource] = useState<DataSource>('loading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFn();

      if (!mountedRef.current) return;

      if (result.data) {
        setData(result.data);
        setSource('api');
        setLastFetched(new Date());
      } else {
        // API returned null/error — use fallback
        setData(fallback);
        setSource('static');
        setError(result.error);
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      setData(fallback);
      setSource('static');
      setError(err.message || 'Unexpected error');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    return () => { mountedRef.current = false; };
  }, [doFetch]);

  return { data, source, loading, error, refetch: doFetch, lastFetched };
}

/**
 * Lightweight version that just merges API data when available.
 * Does NOT replace individual fields — returns the full API payload or full fallback.
 */
export function useApiDataSimple<T>(
  apiFn: () => Promise<ApiResult<T>>,
  fallback: T
): { data: T; source: DataSource } {
  const { data, source } = useApiData(apiFn, fallback, []);
  return { data, source };
}
