export const OUTPUT_FORMATS = [
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'tiff',
  'bmp',
  'pdf',
  'ico',
] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export type MergePdfDto = Omit<ConvertImageDto, 'fileId' | 'outputFormat'> & {
  fileIds: string[];
};

export const RESIZE_MODES = ['cover', 'contain', 'fill', 'inside', 'outside'] as const;
export type ResizeMode = (typeof RESIZE_MODES)[number];

export interface ConvertImageDto {
  fileId: string;
  outputFormat: OutputFormat;
  quality?: number;
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  resizeMode?: ResizeMode;
  rotate?: number;
  rotateAuto?: boolean;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  grayscale?: boolean;
  blur?: number;
  sharpen?: boolean;
  brightness?: number;
  saturation?: number;
  contrast?: number;
  hue?: number;
  gamma?: number;
  normalize?: boolean;
  removeBackground?: boolean;
  stripMetadata?: boolean;
  backgroundColor?: string;
  outputFileName?: string;
}

export interface UploadResponse {
  fileId: string;
  originalName: string;
  size: number;
  mimeType: string;
  width: number;
  height: number;
  channels?: number;
  hasAlpha?: boolean;
  colorSpace?: string;
  uploadedAt: string;
}

export interface ConvertResponse {
  convertedFileId: string;
  downloadUrl: string;
  outputFormat: OutputFormat;
  outputSize: number;
  processingTimeMs: number;
  outputFileName: string;
}

export interface QueuedResponse {
  jobId: string;
  status: 'queued';
  count?: number;
}

export type ConvertOrQueued = ConvertResponse | QueuedResponse;

export interface JobStatusResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: number;
  result?: ConvertResponse | Array<{ status: 'fulfilled' | 'rejected'; value?: ConvertResponse; reason?: string }>;
  error?: string;
}

export interface BatchResultItem {
  status: 'fulfilled' | 'rejected';
  value?: ConvertResponse;
  reason?: string;
}

export type BatchResponse = QueuedResponse | BatchResultItem[];

export function isBatchQueued(r: BatchResponse): r is QueuedResponse {
  return !Array.isArray(r) && (r as QueuedResponse).status === 'queued';
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
}

export function isQueued(r: ConvertOrQueued): r is QueuedResponse {
  return (r as QueuedResponse).status === 'queued';
}
