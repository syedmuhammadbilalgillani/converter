'use client';

import { useCallback, useRef, useState } from 'react';
import { uploadImage, ApiException } from '@/lib/api';
import type { UploadResponse } from '@/types/converter';

export type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export interface UseImageUploadReturn {
  state: UploadState;
  uploadedFile: UploadResponse | null;
  localFile: File | null;
  localPreviewUrl: string | null;
  uploadProgress: number;
  error: string | null;
  upload: (file: File) => Promise<UploadResponse | null>;
  reset: () => void;
}

export function useImageUpload(): UseImageUploadReturn {
  const [state, setState] = useState<UploadState>('idle');
  const [uploadedFile, setUploadedFile] = useState<UploadResponse | null>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const previousUrlRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
    previousUrlRef.current = null;
    setState('idle');
    setUploadedFile(null);
    setLocalFile(null);
    setLocalPreviewUrl(null);
    setUploadProgress(0);
    setError(null);
  }, []);

  const upload = useCallback(async (file: File): Promise<UploadResponse | null> => {
    if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
    const url = URL.createObjectURL(file);
    previousUrlRef.current = url;
    setLocalFile(file);
    setLocalPreviewUrl(url);
    setUploadProgress(0);
    setError(null);
    setState('uploading');
    try {
      const res = await uploadImage(file, { onProgress: setUploadProgress });
      setUploadedFile(res);
      setState('success');
      return res;
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : (e as Error).message;
      setError(msg);
      setState('error');
      return null;
    }
  }, []);

  return {
    state,
    uploadedFile,
    localFile,
    localPreviewUrl,
    uploadProgress,
    error,
    upload,
    reset,
  };
}
