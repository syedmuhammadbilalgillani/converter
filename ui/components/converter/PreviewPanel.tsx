'use client';

import { useRef, useState } from 'react';
import { ImageIcon } from '@phosphor-icons/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatBytes } from '@/lib/constants';
import { cn } from '@/lib/utils';

export interface PreviewPanelProps {
  originalUrl: string | null;
  originalLabel?: string;
  originalWidth?: number;
  originalHeight?: number;
  originalSize?: number;
  convertedUrl: string | null;
  convertedFormat?: string;
  convertedSize?: number;
  isLoading?: boolean;
}

export function PreviewPanel(props: PreviewPanelProps) {
  return (
    <>
      <div className="hidden md:block">
        <SplitView {...props} />
      </div>
      <div className="md:hidden">
        <TabsView {...props} />
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
      <ImageIcon className="size-12 opacity-40" />
      <p className="text-sm">Upload an image to see a preview</p>
    </div>
  );
}

function ImageBox({
  url,
  loading,
  alt,
  label,
  meta,
}: {
  url: string | null;
  loading?: boolean;
  alt: string;
  label: string;
  meta?: string;
}) {
  if (loading) {
    return (
      <div className="relative flex h-full min-h-[300px] items-center justify-center bg-muted/30">
        <Skeleton className="absolute inset-2 rounded" />
        <span className="absolute top-2 left-2 z-10 rounded bg-background/80 px-2 py-0.5 text-xs">
          {label}
        </span>
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center bg-muted/30 text-muted-foreground">
        <span className="text-xs">No {label.toLowerCase()} yet</span>
      </div>
    );
  }
  return (
    <div className="relative h-full min-h-[300px] bg-[conic-gradient(at_50%_50%,_#e5e5e5_25%,_#fafafa_25%,_#fafafa_50%,_#e5e5e5_50%,_#e5e5e5_75%,_#fafafa_75%)] bg-[length:16px_16px]">
      <span className="absolute top-2 left-2 z-10 rounded bg-background/80 px-2 py-0.5 text-xs font-medium">
        {label}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-contain"
      />
      {meta && (
        <span className="absolute bottom-2 left-2 z-10 rounded bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
          {meta}
        </span>
      )}
    </div>
  );
}

function SplitView({
  originalUrl,
  convertedUrl,
  originalLabel,
  originalWidth,
  originalHeight,
  originalSize,
  convertedFormat,
  convertedSize,
  isLoading,
}: PreviewPanelProps) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updatePos = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, p)));
  };

  if (!originalUrl) return <EmptyState />;

  const originalMeta = [
    originalWidth && originalHeight ? `${originalWidth}×${originalHeight}` : null,
    originalSize ? formatBytes(originalSize) : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const convertedMeta = [
    convertedFormat?.toUpperCase(),
    convertedSize ? formatBytes(convertedSize) : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg border select-none"
      onMouseMove={(e) => draggingRef.current && updatePos(e.clientX)}
      onMouseUp={() => (draggingRef.current = false)}
      onMouseLeave={() => (draggingRef.current = false)}
      onTouchMove={(e) => draggingRef.current && updatePos(e.touches[0].clientX)}
      onTouchEnd={() => (draggingRef.current = false)}
    >
      <div className="relative h-[480px]">
        <div className="absolute inset-0">
          <ImageBox url={originalUrl} alt="Original" label={originalLabel ?? 'Original'} meta={originalMeta} />
        </div>
        <div
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${pos}%` }}
        >
          <div className="h-full" style={{ width: containerRef.current?.clientWidth ?? '100%' }}>
            <ImageBox url={convertedUrl} loading={isLoading} alt="Converted" label="Converted" meta={convertedMeta} />
          </div>
        </div>
        <div
          role="separator"
          aria-label="Drag to compare"
          aria-orientation="vertical"
          tabIndex={0}
          className={cn(
            'absolute inset-y-0 z-20 flex w-1 -translate-x-1/2 cursor-col-resize items-center justify-center bg-primary/80',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
          style={{ left: `${pos}%` }}
          onMouseDown={() => (draggingRef.current = true)}
          onTouchStart={() => (draggingRef.current = true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 2));
            if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 2));
          }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow">
            ↔
          </span>
        </div>
      </div>
    </div>
  );
}

function TabsView({
  originalUrl,
  convertedUrl,
  originalWidth,
  originalHeight,
  originalSize,
  convertedFormat,
  convertedSize,
  isLoading,
}: PreviewPanelProps) {
  if (!originalUrl) return <EmptyState />;
  return (
    <Tabs defaultValue="original" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="original">Original</TabsTrigger>
        <TabsTrigger value="converted">Converted</TabsTrigger>
      </TabsList>
      <TabsContent value="original">
        <ImageBox
          url={originalUrl}
          alt="Original"
          label="Original"
          meta={[
            originalWidth && originalHeight ? `${originalWidth}×${originalHeight}` : null,
            originalSize ? formatBytes(originalSize) : null,
          ].filter(Boolean).join(' • ')}
        />
      </TabsContent>
      <TabsContent value="converted">
        <ImageBox
          url={convertedUrl}
          loading={isLoading}
          alt="Converted"
          label="Converted"
          meta={[convertedFormat?.toUpperCase(), convertedSize ? formatBytes(convertedSize) : null].filter(Boolean).join(' • ')}
        />
      </TabsContent>
    </Tabs>
  );
}

// Helper for showing the format badge separately if needed
export function FormatBadge({ format }: { format: string }) {
  return <Badge className="uppercase">{format}</Badge>;
}
