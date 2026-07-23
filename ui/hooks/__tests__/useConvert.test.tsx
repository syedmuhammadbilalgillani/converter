import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConvert } from '../useConvert';

vi.mock('@/lib/api', async () => {
  return {
    convertImage: vi.fn(),
    getJobStatus: vi.fn(),
    getPreviewUrl: (id: string) => `http://test/preview/${id}`,
    ApiException: class ApiException extends Error {
      constructor(public statusCode: number, public code: string, message: string) {
        super(message);
      }
    },
  };
});

import * as api from '@/lib/api';

describe('useConvert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions through idle → converting → success on synchronous response', async () => {
    (api.convertImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      convertedFileId: 'abc',
      downloadUrl: '/download/abc',
      outputFormat: 'webp',
      outputSize: 12345,
      processingTimeMs: 50,
      outputFileName: 'x.webp',
    });

    const { result } = renderHook(() => useConvert());
    expect(result.current.isConverting).toBe(false);

    await act(async () => {
      await result.current.convert({ fileId: 'abc', outputFormat: 'webp' });
    });

    expect(result.current.isConverting).toBe(false);
    expect(result.current.convertedFile?.convertedFileId).toBe('abc');
    expect(result.current.previewUrl).toContain('/preview/abc');
    expect(result.current.error).toBeNull();
  });

  it('surfaces an error message on rejection', async () => {
    (api.convertImage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new (api as unknown as { ApiException: new (s: number, c: string, m: string) => Error }).ApiException(
        422,
        'CONVERSION_FAILED',
        'bad image',
      ),
    );
    const { result } = renderHook(() => useConvert());
    await act(async () => {
      await result.current.convert({ fileId: 'abc', outputFormat: 'webp' });
    });
    expect(result.current.error).toBe('bad image');
    expect(result.current.isConverting).toBe(false);
  });

  it('handles queued response by polling job status', async () => {
    (api.convertImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      jobId: 'j1',
      status: 'queued',
    });
    (api.getJobStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      jobId: 'j1',
      status: 'done',
      progress: 100,
      result: {
        convertedFileId: 'abc',
        downloadUrl: '/download/abc',
        outputFormat: 'jpeg',
        outputSize: 999,
        processingTimeMs: 12,
        outputFileName: 'x.jpeg',
      },
    });

    const { result } = renderHook(() => useConvert());
    await act(async () => {
      await result.current.convert({ fileId: 'abc', outputFormat: 'jpeg' });
    });

    await waitFor(() => {
      expect(result.current.convertedFile?.convertedFileId).toBe('abc');
    });
    expect(api.getJobStatus).toHaveBeenCalledWith('j1');
  });
});
