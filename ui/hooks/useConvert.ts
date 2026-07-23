'use client';

import { useCallback, useEffect, useState } from 'react';
import { convertImage, getJobStatus, getPreviewUrl, ApiException } from '@/lib/api';
import type {
  ConvertImageDto,
  ConvertResponse,
  JobStatusResponse,
} from '@/types/converter';
import { isQueued } from '@/types/converter';

export interface UseConvertReturn {
  isConverting: boolean;
  convertedFile: ConvertResponse | null;
  previewUrl: string | null;
  jobStatus: JobStatusResponse | null;
  error: string | null;
  convert: (dto: ConvertImageDto) => Promise<ConvertResponse | null>;
  reset: () => void;
}

const POLL_MS = 1500;

export function useConvert(): UseConvertReturn {
  const [isConverting, setIsConverting] = useState(false);
  const [convertedFile, setConvertedFile] = useState<ConvertResponse | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsConverting(false);
    setConvertedFile(null);
    setPreviewUrl(null);
    setJobStatus(null);
    setError(null);
    setPollingJobId(null);
  }, []);

  // Poll job status for queued jobs.
  useEffect(() => {
    if (!pollingJobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const s = await getJobStatus(pollingJobId);
        if (cancelled) return;
        setJobStatus(s);
        if (s.status === 'done') {
          const result = s.result as ConvertResponse | undefined;
          if (result && 'convertedFileId' in result) {
            setConvertedFile(result);
            setPreviewUrl(getPreviewUrl(result.convertedFileId));
          }
          setIsConverting(false);
          setPollingJobId(null);
          return;
        }
        if (s.status === 'failed') {
          setError(s.error ?? 'Conversion failed.');
          setIsConverting(false);
          setPollingJobId(null);
          return;
        }
      } catch {
        // transient
      }
      timer = setTimeout(tick, POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollingJobId]);

  const convert = useCallback(async (dto: ConvertImageDto): Promise<ConvertResponse | null> => {
    setError(null);
    setIsConverting(true);
    setConvertedFile(null);
    setPreviewUrl(null);
    setJobStatus(null);
    try {
      const res = await convertImage(dto);
      if (isQueued(res)) {
        setPollingJobId(res.jobId);
        return null;
      }
      setConvertedFile(res);
      setPreviewUrl(getPreviewUrl(res.convertedFileId));
      setIsConverting(false);
      return res;
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : (e as Error).message;
      setError(msg);
      setIsConverting(false);
      return null;
    }
  }, []);

  return { isConverting, convertedFile, previewUrl, jobStatus, error, convert, reset };
}
