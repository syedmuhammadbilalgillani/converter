import axios, { AxiosError, AxiosProgressEvent } from 'axios';
import { API_BASE_URL } from './constants';
import type {
  ApiError,
  BatchResponse,
  ConvertImageDto,
  ConvertOrQueued,
  ConvertResponse,
  JobStatusResponse,
  MergePdfDto,
  QueuedResponse,
  UploadResponse,
} from '@/types/converter';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120_000,
});

export class ApiException extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function unwrap(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const ae = err as AxiosError<ApiError>;
    const data = ae.response?.data;
    if (data && typeof data === 'object' && 'error' in data) {
      throw new ApiException(data.statusCode, data.error, data.message);
    }
    throw new ApiException(ae.response?.status ?? 0, 'NETWORK_ERROR', ae.message);
  }
  throw err;
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export async function uploadImage(file: File, opts: UploadOptions = {}): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await client.post<UploadResponse>('/upload', form, {
      signal: opts.signal,
      onUploadProgress: (e: AxiosProgressEvent) => {
        if (e.total) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
      },
    });
    return res.data;
  } catch (e) {
    unwrap(e);
  }
}

export async function convertImage(dto: ConvertImageDto): Promise<ConvertOrQueued> {
  try {
    const res = await client.post<ConvertOrQueued>('/convert', dto);
    return res.data;
  } catch (e) {
    unwrap(e);
  }
}

export function getPreviewUrl(fileId: string): string {
  return `${API_BASE_URL}/convert/preview/${fileId}?ts=${Date.now()}`;
}

export function getDownloadUrl(fileId: string): string {
  return `${API_BASE_URL}/download/${fileId}`;
}

export function downloadFile(fileId: string, _filename: string): void {
  const a = document.createElement('a');
  a.href = getDownloadUrl(fileId);
  a.rel = 'noopener';
  // server sets Content-Disposition; download attribute fallback:
  a.download = _filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function batchConvert(jobs: ConvertImageDto[]): Promise<BatchResponse> {
  try {
    const res = await client.post<BatchResponse>('/convert/batch', { jobs });
    return res.data;
  } catch (e) {
    unwrap(e);
  }
}

export async function mergePdf(dto: MergePdfDto): Promise<ConvertResponse> {
  try {
    const res = await client.post<ConvertResponse>('/convert/pdf', dto);
    return res.data;
  } catch (e) {
    unwrap(e);
  }
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  try {
    const res = await client.get<JobStatusResponse>(`/jobs/${jobId}`);
    return res.data;
  } catch (e) {
    unwrap(e);
  }
}

export type { BatchResponse, ConvertResponse };
