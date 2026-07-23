'use client';

import { useCallback, useEffect, useState } from 'react';
import { batchConvert, getJobStatus, ApiException } from '@/lib/api';
import { isBatchQueued } from '@/types/converter';
import type {
  BatchResultItem,
  ConvertImageDto,
  JobStatusResponse,
} from '@/types/converter';

export type { BatchResultItem };

export function useBatchConvert() {
  const [isBatching, setIsBatching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchResultItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!pollingJobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) return;
      try {
        const s: JobStatusResponse = await getJobStatus(pollingJobId);
        if (cancelled) return;
        setProgress(s.progress ?? 0);
        if (s.status === 'done') {
          setResults((s.result as BatchResultItem[]) ?? []);
          setIsBatching(false);
          setPollingJobId(null);
          return;
        }
        if (s.status === 'failed') {
          setError(s.error ?? 'Batch failed.');
          setIsBatching(false);
          setPollingJobId(null);
          return;
        }
      } catch {
        // transient
      }
      timer = setTimeout(tick, 1500);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollingJobId]);

  const run = useCallback(async (jobs: ConvertImageDto[]) => {
    setIsBatching(true);
    setProgress(0);
    setResults(null);
    setError(null);
    try {
      const r = await batchConvert(jobs);
      if (isBatchQueued(r)) {
        // Large files: server enqueued the job — poll for completion.
        setPollingJobId(r.jobId);
      } else {
        // Small files: server processed inline and returned results directly.
        setResults(r);
        setProgress(100);
        setIsBatching(false);
      }
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : (e as Error).message;
      setError(msg);
      setIsBatching(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsBatching(false);
    setProgress(0);
    setResults(null);
    setError(null);
    setPollingJobId(null);
  }, []);

  return { isBatching, progress, results, error, run, reset };
}
