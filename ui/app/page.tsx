'use client';

import { Suspense, useState } from 'react';
import {
  MagicWandIcon,
  SpinnerIcon,
  SlidersHorizontalIcon,
  CheckCircleIcon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DropZone } from '@/components/converter/DropZone';
import { FormatSelector } from '@/components/converter/FormatSelector';
import {
  SettingsPanel,
  DEFAULT_SETTINGS,
  settingsToDto,
  type SettingsValue,
} from '@/components/converter/SettingsPanel';
import { PreviewPanel } from '@/components/converter/PreviewPanel';
import { DownloadButton } from '@/components/converter/DownloadButton';
import { BatchUploader } from '@/components/converter/BatchUploader';
import { useConvert } from '@/hooks/useConvert';
import { useIsMobile } from '@/hooks/use-mobile';
import { FILE_EXPIRY_MINUTES } from '@/lib/constants';
import type { OutputFormat, UploadResponse } from '@/types/converter';

export default function Home() {
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('webp');
  const [settings, setSettings] = useState<SettingsValue>(DEFAULT_SETTINGS);
  const [uploaded, setUploaded] = useState<UploadResponse | null>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const convert = useConvert();

  const handleUploaded = (file: UploadResponse, lf: File) => {
    setUploaded(file);
    setLocalFile(lf);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(URL.createObjectURL(lf));
    toast.success('Upload successful');
  };

  const handleReset = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setUploaded(null);
    setLocalFile(null);
    setLocalPreviewUrl(null);
    convert.reset();
    setSettings(DEFAULT_SETTINGS);
  };

  const handleConvert = async () => {
    if (!uploaded) return;
    const dto = settingsToDto(uploaded.fileId, outputFormat, settings);
    if (uploaded.size > 5 * 1024 * 1024) {
      toast.info('Processing large file… this may take a moment.');
    }
    const res = await convert.convert(dto);
    if (res) toast.success('Conversion complete');
    else if (convert.error) toast.error(`Conversion failed: ${convert.error}`);
  };

  const settingsNode = (
    <SettingsPanel
      value={settings}
      onChange={setSettings}
      outputFormat={outputFormat}
    />
  );

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Image Converter
        </h1>
        <p className="text-sm text-muted-foreground">
          Convert, resize, and tune images. Files expire after {FILE_EXPIRY_MINUTES} minutes.
        </p>
      </header>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="mb-4 grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="single">Single image</TabsTrigger>
          <TabsTrigger value="batch">Batch convert</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {/* Left: upload + controls */}
            <div className="space-y-4">
              <DropZone
                uploaded={uploaded}
                localPreviewUrl={localPreviewUrl}
                onUploaded={handleUploaded}
                onReset={handleReset}
              />

              <FormatSelector value={outputFormat} onChange={setOutputFormat} />

              {/* Settings: card on desktop/tablet, sheet on mobile */}
              {isMobile ? (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <SlidersHorizontalIcon className="size-4" />
                      Open settings
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Settings</SheetTitle>
                    </SheetHeader>
                    <div className="mt-3">{settingsNode}</div>
                  </SheetContent>
                </Sheet>
              ) : (
                settingsNode
              )}

              <Button
                size="lg"
                className="w-full"
                onClick={handleConvert}
                disabled={!uploaded || convert.isConverting}
                aria-live="polite"
              >
                {convert.isConverting ? (
                  <>
                    <SpinnerIcon className="size-4 animate-spin" />
                    Converting…
                  </>
                ) : convert.convertedFile ? (
                  <>
                    <CheckCircleIcon className="size-4" weight="fill" />
                    Convert again
                  </>
                ) : (
                  <>
                    <MagicWandIcon className="size-4" />
                    Convert image
                  </>
                )}
              </Button>

              {/* Job queue progress for large files */}
              {convert.jobStatus && convert.isConverting && (
                <Card>
                  <CardContent className="space-y-2 p-3">
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      Queued job ({convert.jobStatus.status})… {convert.jobStatus.progress}%
                    </p>
                    <Progress value={convert.jobStatus.progress} />
                  </CardContent>
                </Card>
              )}

              {convert.convertedFile && uploaded && (
                <DownloadButton
                  result={convert.convertedFile}
                  originalSize={uploaded.size}
                  onReset={handleReset}
                />
              )}
            </div>

            {/* Right: preview */}
            <div className="space-y-3">
              <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-lg" />}>
                <PreviewPanel
                  originalUrl={localPreviewUrl}
                  originalWidth={uploaded?.width}
                  originalHeight={uploaded?.height}
                  originalSize={uploaded?.size}
                  convertedUrl={convert.previewUrl}
                  convertedFormat={convert.convertedFile?.outputFormat}
                  convertedSize={convert.convertedFile?.outputSize}
                  isLoading={convert.isConverting}
                />
              </Suspense>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="batch">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <FormatSelector value={outputFormat} onChange={setOutputFormat} />
              {settingsNode}
            </div>
            <BatchUploader globalFormat={outputFormat} settings={settings} />
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
