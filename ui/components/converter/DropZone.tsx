'use client';

import { useDropzone, type FileRejection } from 'react-dropzone';
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  XIcon,
  ImageIcon,
} from '@phosphor-icons/react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, formatBytes } from '@/lib/constants';
import { useImageUpload } from '@/hooks/useImageUpload';
import type { UploadResponse } from '@/types/converter';

export interface DropZoneProps {
  onUploaded: (file: UploadResponse, localFile: File) => void;
  onReset: () => void;
  uploaded: UploadResponse | null;
  localPreviewUrl: string | null;
}

export function DropZone({ onUploaded, onReset, uploaded, localPreviewUrl }: DropZoneProps) {
  const { state, upload, uploadProgress, error, reset, localFile } = useImageUpload();

  // Notify parent when upload succeeds
  useEffect(() => {
    if (state === 'success' && localFile) {
      // upload returns the response; we re-derive from hook state
      // but the hook stores it internally — read via a side channel.
    }
  }, [state, localFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_MIME_TYPES,
    maxSize: MAX_FILE_SIZE_BYTES,
    multiple: false,
    disabled: state === 'uploading' || state === 'success',
    onDrop: async (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        const r = rejections[0];
        const code = r.errors[0]?.code ?? 'unknown';
        const msg =
          code === 'file-too-large'
            ? `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
            : code === 'file-invalid-type'
              ? 'Unsupported file type.'
              : (r.errors[0]?.message ?? 'File rejected.');
        // Surface via thrown reset path — we rely on the hook's error path for visual.
        // Instead, just call upload with a fake to set error: but cleanest is to set local-error.
        alert(msg); // overlap with toast in page; simple here
        return;
      }
      const file = accepted[0];
      if (!file) return;
      const res = await upload(file);
      if (res) onUploaded(res, file);
    },
  });

  const handleRemove = () => {
    reset();
    onReset();
  };

  if (state === 'success' && uploaded) {
    return (
      <div
        className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4"
        role="status"
        aria-live="polite"
      >
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
          {localPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={localPreviewUrl}
              alt="Uploaded preview"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="h-6 w-6" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="size-4 text-emerald-600" weight="fill" />
            <span className="text-sm font-medium truncate">{uploaded.originalName}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {uploaded.width} × {uploaded.height} px • {formatBytes(uploaded.size)} • {uploaded.mimeType}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove file"
          onClick={handleRemove}
          className="flex-shrink-0"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-all',
        'cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-ring',
        isDragActive
          ? 'border-primary bg-primary/5 ring-2 ring-primary scale-[1.01]'
          : 'border-border hover:border-primary/50 hover:bg-muted/50',
        state === 'uploading' && 'pointer-events-none opacity-90',
        state === 'error' && 'border-destructive bg-destructive/5',
      )}
      role="button"
      tabIndex={0}
      aria-label="Upload image"
    >
      <input {...getInputProps()} aria-label="File input" />
      {state === 'uploading' ? (
        <div className="w-full max-w-xs space-y-3">
          {localPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={localPreviewUrl}
              alt="Uploading"
              className="mx-auto h-24 w-24 rounded object-cover"
            />
          ) : (
            <Skeleton className="mx-auto h-24 w-24 rounded" />
          )}
          <p className="text-sm font-medium">Uploading… {uploadProgress}%</p>
          <Progress value={uploadProgress} aria-label="Upload progress" />
        </div>
      ) : state === 'error' ? (
        <div className="flex flex-col items-center gap-2">
          <WarningCircleIcon className="size-8 text-destructive" weight="fill" />
          <p className="text-sm font-medium text-destructive">{error ?? 'Upload failed.'}</p>
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); reset(); }}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <CloudArrowUpIcon
            className={cn(
              'size-10 text-muted-foreground transition-colors',
              isDragActive && 'text-primary',
            )}
          />
          <p className="text-sm font-medium">
            {isDragActive ? 'Drop image here' : 'Drop image here or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground">
            Up to {MAX_FILE_SIZE_BYTES / 1024 / 1024} MB • JPEG, PNG, WebP, AVIF, GIF, TIFF, BMP, SVG, HEIC
          </p>
        </div>
      )}
    </div>
  );
}
