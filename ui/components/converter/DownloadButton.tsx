'use client';

import { DownloadSimpleIcon, ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { downloadFile } from '@/lib/api';
import { formatBytes, FILE_EXPIRY_MINUTES } from '@/lib/constants';
import type { ConvertResponse } from '@/types/converter';

export interface DownloadButtonProps {
  result: ConvertResponse;
  originalSize: number;
  onReset: () => void;
}

export function DownloadButton({ result, originalSize, onReset }: DownloadButtonProps) {
  const delta = originalSize - result.outputSize;
  const pctRaw = originalSize > 0 ? (delta / originalSize) * 100 : 0;
  const smaller = pctRaw > 0;
  const pctLabel = `${Math.abs(pctRaw).toFixed(1)}%`;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="uppercase">{result.outputFormat}</Badge>
        <span className="text-sm text-muted-foreground">{formatBytes(result.outputSize)}</span>
        <Badge
          variant={smaller ? 'default' : 'secondary'}
          className={smaller ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''}
        >
          {smaller ? `↓ ${pctLabel} smaller` : `↑ ${pctLabel} larger`}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          size="lg"
          className="w-full"
          onClick={() => downloadFile(result.convertedFileId, result.outputFileName)}
        >
          <DownloadSimpleIcon className="size-4" weight="bold" />
          Download image
        </Button>
        <Button size="lg" variant="outline" className="w-full" onClick={onReset}>
          <ArrowsClockwiseIcon className="size-4" />
          Convert another
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Your converted file will be available for {FILE_EXPIRY_MINUTES} minutes.
      </p>
    </div>
  );
}
