'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { CloudArrowUpIcon, XIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ACCEPTED_MIME_TYPES, MAX_BATCH_SIZE, MAX_FILE_SIZE_BYTES, FORMAT_INFO, formatBytes } from '@/lib/constants';
import { uploadImage, getDownloadUrl, mergePdf, ApiException } from '@/lib/api';
import { useBatchConvert } from '@/hooks/useBatchConvert';
import { DEFAULT_SETTINGS, settingsToDto, type SettingsValue } from './SettingsPanel';
import type { OutputFormat, UploadResponse } from '@/types/converter';
import { cn } from '@/lib/utils';

interface Item {
  localId: string;
  file: File;
  previewUrl: string;
  uploaded?: UploadResponse;
  uploadError?: string;
  format: OutputFormat;
  status: 'uploading' | 'ready' | 'queued' | 'processing' | 'done' | 'failed';
  outputSize?: number;
  outputFileName?: string;
  outputFormat?: OutputFormat;
  errorMessage?: string;
}

export interface BatchUploaderProps {
  globalFormat: OutputFormat;
  settings: SettingsValue;
}

export function BatchUploader({ globalFormat, settings }: BatchUploaderProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [submittedIds, setSubmittedIds] = useState<string[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const { isBatching, progress, results, run, reset } = useBatchConvert();

  // Apply batch results back to items by localId (not by items-array index)
  useEffect(() => {
    if (!results) return;
    setItems((prev) =>
      prev.map((it) => {
        const idx = submittedIds.indexOf(it.localId);
        if (idx === -1) return it;
        const r = results[idx];
        if (!r) return it;
        if (r.status === 'fulfilled' && r.value) {
          return {
            ...it,
            status: 'done',
            outputSize: r.value.outputSize,
            outputFileName: r.value.outputFileName,
            outputFormat: r.value.outputFormat,
          };
        }
        return { ...it, status: 'failed', errorMessage: r.reason };
      }),
    );
  }, [results, submittedIds]);

  // Set items to processing while polling
  useEffect(() => {
    if (isBatching) {
      setItems((prev) => prev.map((it) => (it.uploaded ? { ...it, status: 'processing' } : it)));
    }
  }, [isBatching]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (items.length + accepted.length > MAX_BATCH_SIZE) {
        toast.error(`Batch is limited to ${MAX_BATCH_SIZE} files.`);
        return;
      }
      const newItems: Item[] = accepted.map((f) => ({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        format: globalFormat,
        status: 'uploading',
      }));
      setItems((prev) => [...prev, ...newItems]);

      for (const item of newItems) {
        try {
          const u = await uploadImage(item.file);
          setItems((prev) =>
            prev.map((it) =>
              it.localId === item.localId ? { ...it, uploaded: u, status: 'ready' } : it,
            ),
          );
        } catch (e) {
          const msg = e instanceof ApiException ? e.message : (e as Error).message;
          setItems((prev) =>
            prev.map((it) =>
              it.localId === item.localId ? { ...it, status: 'failed', uploadError: msg } : it,
            ),
          );
        }
      }
    },
    [globalFormat, items.length],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_MIME_TYPES,
    maxSize: MAX_FILE_SIZE_BYTES,
    multiple: true,
    onDrop,
  });

  const remove = (id: string) =>
    setItems((prev) => {
      const it = prev.find((x) => x.localId === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.localId !== id);
    });

  const setItemFormat = (id: string, f: OutputFormat) =>
    setItems((prev) => prev.map((it) => (it.localId === id ? { ...it, format: f } : it)));

  const convertAll = () => {
    const ready = items.filter((i) => i.uploaded && i.status !== 'done');
    if (ready.length === 0) {
      toast.error('No ready files to convert.');
      return;
    }
    const jobs = ready.map((i) => settingsToDto(i.uploaded!.fileId, i.format, settings));
    setSubmittedIds(ready.map((i) => i.localId));
    setItems((prev) =>
      prev.map((it) => (ready.includes(it) ? { ...it, status: 'queued' } : it)),
    );
    void run(jobs);
  };

  const downloadAllZip = async () => {
    const done = items.filter((i) => i.status === 'done' && i.uploaded);
    if (done.length === 0) return;
    const zip = new JSZip();
    toast.info(`Packaging ${done.length} files…`);
    await Promise.all(
      done.map(async (i) => {
        const res = await fetch(getDownloadUrl(i.uploaded!.fileId));
        const blob = await res.blob();
        zip.file(i.outputFileName ?? `${i.file.name}.${i.outputFormat ?? i.format}`, blob);
      }),
    );
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted-images.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const mergeToPdf = async () => {
    const ready = items.filter((i) => i.uploaded);
    if (ready.length < 1) {
      toast.error('Upload at least one image to build a PDF.');
      return;
    }
    // Reuse the shared settings (resize, rotate, colour, etc.); drop the
    // per-file fileId/outputFormat — the PDF endpoint takes an ordered list.
    const { fileId: _fileId, outputFormat: _outputFormat, ...opts } = settingsToDto(
      ready[0].uploaded!.fileId,
      'pdf',
      settings,
    );
    void _fileId;
    void _outputFormat;
    setIsMerging(true);
    try {
      const res = await mergePdf({
        ...opts,
        fileIds: ready.map((i) => i.uploaded!.fileId),
      });
      const a = document.createElement('a');
      a.href = getDownloadUrl(res.convertedFileId);
      a.download = res.outputFileName;
      a.click();
      toast.success(`PDF ready — ${ready.length} page${ready.length > 1 ? 's' : ''}.`);
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : (e as Error).message;
      toast.error(`PDF merge failed: ${msg}`);
    } finally {
      setIsMerging(false);
    }
  };

  const resetAll = () => {
    items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setItems([]);
    setSubmittedIds([]);
    reset();
  };

  const doneCount = items.filter((i) => i.status === 'done').length;
  const readyCount = items.filter((i) => i.uploaded).length;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          'cursor-pointer focus-within:ring-2 focus-within:ring-ring',
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        )}
        role="button"
        tabIndex={0}
        aria-label="Upload multiple images"
      >
        <input {...getInputProps()} aria-label="Batch file input" />
        <CloudArrowUpIcon className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drop up to {MAX_BATCH_SIZE} images here</p>
        <p className="text-xs text-muted-foreground">{items.length} / {MAX_BATCH_SIZE} added</p>
      </div>

      {items.length > 0 && (
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {items.map((it) => (
            <Card key={it.localId}>
              <CardContent className="flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.previewUrl}
                  alt={it.file.name}
                  className="h-14 w-14 flex-shrink-0 rounded object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(it.file.size)}
                    {it.outputSize && (
                      <> → {formatBytes(it.outputSize)}</>
                    )}
                  </p>
                  {it.errorMessage && (
                    <p className="text-xs text-destructive">{it.errorMessage}</p>
                  )}
                </div>
                <Select
                  value={it.format}
                  onValueChange={(v) => setItemFormat(it.localId, v as OutputFormat)}
                  disabled={['queued', 'processing'].includes(it.status)}
                >
                  <SelectTrigger className="w-[100px]" aria-label={`Format for ${it.file.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_INFO.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <StatusBadge status={it.status} />
                {it.status === 'done' && it.uploaded && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Download ${it.file.name}`}
                    asChild
                  >
                    <a href={getDownloadUrl(it.uploaded.fileId)} download={it.outputFileName}>
                      <DownloadSimpleIcon className="size-4" />
                    </a>
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${it.file.name}`}
                  onClick={() => remove(it.localId)}
                  disabled={['queued', 'processing'].includes(it.status)}
                >
                  <XIcon className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isBatching && (
        <div className="space-y-1.5">
          <Progress value={progress} aria-label="Batch progress" />
          <p className="text-xs text-muted-foreground" aria-live="polite">Processing… {progress}%</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={convertAll} disabled={items.length === 0 || isBatching}>
          Convert all
        </Button>
        <Button
          variant="outline"
          onClick={downloadAllZip}
          disabled={doneCount === 0}
        >
          Download all as ZIP ({doneCount})
        </Button>
        <Button
          variant="outline"
          onClick={mergeToPdf}
          disabled={readyCount === 0 || isMerging || isBatching}
        >
          {isMerging ? 'Building PDF…' : `Merge to PDF (${readyCount})`}
        </Button>
        <Button variant="ghost" onClick={resetAll} disabled={items.length === 0}>
          Clear
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Item['status'] }) {
  const map: Record<Item['status'], { label: string; cls: string }> = {
    uploading: { label: 'Uploading', cls: 'bg-blue-500/10 text-blue-700' },
    ready: { label: 'Ready', cls: 'bg-muted text-foreground' },
    queued: { label: 'Queued', cls: 'bg-amber-500/10 text-amber-700' },
    processing: { label: 'Processing', cls: 'bg-amber-500/10 text-amber-700' },
    done: { label: 'Done', cls: 'bg-emerald-500/10 text-emerald-700' },
    failed: { label: 'Failed', cls: 'bg-destructive/10 text-destructive' },
  };
  const s = map[status];
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}
