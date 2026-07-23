import type { OutputFormat } from '@/types/converter';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_BATCH_SIZE = 20;
export const FILE_EXPIRY_MINUTES = 10;

export const ACCEPTED_MIME_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/bmp': ['.bmp'],
  'image/tiff': ['.tif', '.tiff'],
  'image/svg+xml': ['.svg'],
  'image/avif': ['.avif'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
};

export interface FormatInfo {
  value: OutputFormat;
  label: string;
  category: 'Web' | 'Print' | 'Legacy';
  description: string;
  lossy: boolean;
  supportsAlpha: boolean;
}

export const FORMAT_INFO: FormatInfo[] = [
  {
    value: 'jpeg',
    label: 'JPEG',
    category: 'Web',
    description: 'Universal photo format. No transparency.',
    lossy: true,
    supportsAlpha: false,
  },
  {
    value: 'png',
    label: 'PNG',
    category: 'Web',
    description: 'Lossless. Supports transparency.',
    lossy: false,
    supportsAlpha: true,
  },
  {
    value: 'webp',
    label: 'WebP',
    category: 'Web',
    description: 'Best compression for web. Supports transparency.',
    lossy: true,
    supportsAlpha: true,
  },
  {
    value: 'avif',
    label: 'AVIF',
    category: 'Web',
    description: 'Smallest file size. Modern browsers only.',
    lossy: true,
    supportsAlpha: true,
  },
  {
    value: 'tiff',
    label: 'TIFF',
    category: 'Print',
    description: 'High quality, ideal for print workflows.',
    lossy: true,
    supportsAlpha: true,
  },
  {
    value: 'pdf',
    label: 'PDF',
    category: 'Print',
    description: 'Portable document. Merge multiple images into one file.',
    lossy: false,
    supportsAlpha: false,
  },
  {
    value: 'bmp',
    label: 'BMP',
    category: 'Legacy',
    description: 'Uncompressed legacy format. Large files.',
    lossy: false,
    supportsAlpha: false,
  },
  {
    value: 'gif',
    label: 'GIF',
    category: 'Legacy',
    description: '256 colors. Animation support varies.',
    lossy: false,
    supportsAlpha: true,
  },
  {
    value: 'ico',
    label: 'ICO',
    category: 'Legacy',
    description: 'Windows/favicon icon. Multi-resolution, keeps transparency.',
    lossy: false,
    supportsAlpha: true,
  },
];

export const FORMATS_BY_CATEGORY: Record<FormatInfo['category'], FormatInfo[]> = {
  Web: FORMAT_INFO.filter((f) => f.category === 'Web'),
  Print: FORMAT_INFO.filter((f) => f.category === 'Print'),
  Legacy: FORMAT_INFO.filter((f) => f.category === 'Legacy'),
};

export function getFormatInfo(value: OutputFormat): FormatInfo {
  return FORMAT_INFO.find((f) => f.value === value) ?? FORMAT_INFO[0];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
