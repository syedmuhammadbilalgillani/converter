'use client';

import { useEffect, useRef, useState } from 'react';
import { getJobStatus } from '@/lib/api';
import type { JobStatusResponse } from '@/types/converter';

const POLL_INTERVAL_MS = 1500;

export function useJobPoller(jobId: string | null) {
  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!jobId) return;
    stoppedRef.current = false;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const s = await getJobStatus(jobId);
        if (cancelled) return;
        setStatus(s);
        if (s.status === 'done' || s.status === 'failed') {
          stoppedRef.current = true;
          return;
        }
      } catch {
        // transient error — keep polling
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  return {
    status,
    progress: status?.progress ?? 0,
    isFinished: status?.status === 'done' || status?.status === 'failed',
  };
}
