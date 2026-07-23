import { Injectable, Logger } from '@nestjs/common';
import sharp, { Sharp } from 'sharp';
import { PDFDocument } from 'pdf-lib';
import heicConvert from 'heic-convert';
import { promises as fs } from 'fs';
import { ConvertImageDto, OutputFormat, ResizeMode } from './dto/convert-image.dto';
import { StorageService } from '../storage/storage.service';
import { AppException } from '../../common/errors/app.exception';
import { AppErrorCode } from '../../common/errors/error-codes';

export interface ConvertResult {
  convertedFileId: string;
  downloadUrl: string;
  outputFormat: OutputFormat;
  outputSize: number;
  processingTimeMs: number;
  outputFileName: string;
}

export const FORMAT_MIME: Record<OutputFormat, string> = {
  [OutputFormat.JPEG]: 'image/jpeg',
  [OutputFormat.PNG]: 'image/png',
  [OutputFormat.WEBP]: 'image/webp',
  [OutputFormat.AVIF]: 'image/avif',
  [OutputFormat.GIF]: 'image/gif',
  [OutputFormat.TIFF]: 'image/tiff',
  [OutputFormat.BMP]: 'image/bmp',
  [OutputFormat.PDF]: 'application/pdf',
  [OutputFormat.ICO]: 'image/x-icon',
};

const ALPHA_UNFRIENDLY: OutputFormat[] = [OutputFormat.JPEG, OutputFormat.BMP];

// ICO icon sizes to embed (largest first is not required; decoders pick best).
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

// HEIC/HEIF magic: bytes 4..12 contain "ftyp" followed by a heic/heix/mif1 brand.
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'mif1', 'msf1'];

@Injectable()
export class ConvertService {
  private readonly logger = new Logger(ConvertService.name);

  constructor(private readonly storage: StorageService) {}

  /**
   * Apply transformations in the exact pipeline order from the spec.
   * Pure function over a Sharp instance — exposed for unit testing.
   */
  applyTransformations(pipeline: Sharp, dto: ConvertImageDto): Sharp {
    let p = pipeline;

    if (dto.rotateAuto) p = p.rotate();
    if (typeof dto.rotate === 'number' && dto.rotate !== 0) p = p.rotate(dto.rotate);

    if (dto.width || dto.height) {
      if (!dto.width && !dto.height) {
        // unreachable, narrowing
      }
      // Default to "inside" (contain without cropping). "cover" silently
      // crops away image data, which users rarely expect from a converter.
      const fit = (dto.resizeMode ?? ResizeMode.INSIDE) as keyof sharp.FitEnum;
      const maintain = dto.maintainAspectRatio ?? true;
      p = p.resize({
        width: dto.width,
        height: dto.height,
        fit: maintain ? fit : ('fill' as keyof sharp.FitEnum),
        // Lanczos3 is the highest-quality resampling kernel; enlarging past
        // the source resolution only invents blurry pixels, so avoid it.
        kernel: 'lanczos3' as keyof sharp.KernelEnum,
        withoutEnlargement: true,
      });
    }

    if (dto.flipHorizontal) p = p.flop();
    if (dto.flipVertical) p = p.flip();

    if (dto.grayscale) p = p.grayscale();

    const hasModulate =
      dto.brightness !== undefined ||
      dto.saturation !== undefined ||
      dto.hue !== undefined;
    if (hasModulate) {
      const brightness =
        dto.brightness !== undefined ? 1 + dto.brightness / 100 : 1;
      const saturation =
        dto.saturation !== undefined ? 1 + dto.saturation / 100 : 1;
      p = p.modulate({
        brightness: Math.max(0, brightness),
        saturation: Math.max(0, saturation),
        hue: dto.hue ?? 0,
      });
    }

    if (dto.contrast !== undefined && dto.contrast !== 0) {
      // Linear contrast: out = a*in + b, with a centered on 0.5
      const a = 1 + dto.contrast / 100;
      const b = -(a - 1) * 128;
      p = p.linear(a, b);
    }

    if (dto.gamma !== undefined) p = p.gamma(dto.gamma);
    if (dto.normalize) p = p.normalize();
    if (dto.sharpen) p = p.sharpen();
    if (dto.blur !== undefined && dto.blur > 0) p = p.blur(dto.blur);

    if (dto.stripMetadata === false) {
      p = p.withMetadata();
    }

    if (ALPHA_UNFRIENDLY.includes(dto.outputFormat)) {
      p = p.flatten({ background: dto.backgroundColor ?? '#ffffff' });
    } else if (dto.backgroundColor && dto.outputFormat !== OutputFormat.PDF) {
      p = p.flatten({ background: dto.backgroundColor });
    }

    return p;
  }

  private encode(pipeline: Sharp, dto: ConvertImageDto): Sharp {
    const quality = dto.quality ?? 85;
    // At high quality, keep full chroma resolution (no color subsampling).
    // 4:2:0 (the sharp default) discards half the color data and is the
    // single biggest source of visible quality loss on edges/text/gradients.
    const chromaSubsampling = quality >= 90 ? '4:4:4' : '4:2:0';
    // A quality of 100 means the user wants a lossless result where the codec
    // supports it, not merely the highest lossy setting.
    const lossless = quality >= 100;
    switch (dto.outputFormat) {
      case OutputFormat.JPEG:
        return pipeline.jpeg({
          quality,
          mozjpeg: true,
          chromaSubsampling,
          trellisQuantisation: true,
          overshootDeringing: true,
          optimiseScans: true,
        });
      case OutputFormat.PNG:
        // PNG is always lossless; effort/adaptiveFiltering improve compression
        // without touching pixels. palette=true would be lossy, so keep it off.
        return pipeline.png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          effort: 10,
        });
      case OutputFormat.WEBP:
        return pipeline.webp({
          quality,
          lossless,
          nearLossless: lossless,
          smartSubsample: true,
          effort: 6,
        });
      case OutputFormat.AVIF:
        return pipeline.avif({
          quality,
          lossless,
          chromaSubsampling,
          effort: 6,
        });
      case OutputFormat.GIF:
        return pipeline.gif({ effort: 10 });
      case OutputFormat.TIFF:
        return pipeline.tiff({
          quality,
          compression: lossless ? 'lzw' : 'jpeg',
        });
      case OutputFormat.BMP:
      case OutputFormat.PDF:
        // Handled by renderToBuffer() — these are not sharp-native encoders.
        throw new AppException(
          AppErrorCode.CONVERSION_FAILED,
          `Format "${dto.outputFormat}" must be produced via renderToBuffer().`,
        );
      default:
        throw new AppException(
          AppErrorCode.UNSUPPORTED_FORMAT,
          `Unsupported output format: ${String(dto.outputFormat)}`,
        );
    }
  }

  /**
   * Produce the final encoded bytes for any supported output format.
   * Sharp-native formats go through encode(); BMP and PDF are built here
   * because sharp/libvips has no reliable encoder for them.
   */
  private async renderToBuffer(pipeline: Sharp, dto: ConvertImageDto): Promise<Buffer> {
    if (dto.outputFormat === OutputFormat.BMP) {
      return this.encodeBmp(pipeline);
    }
    if (dto.outputFormat === OutputFormat.PDF) {
      return this.encodePdf(pipeline, dto);
    }
    if (dto.outputFormat === OutputFormat.ICO) {
      return this.encodeIco(pipeline);
    }
    return this.encode(pipeline, dto).toBuffer();
  }

  /**
   * Open a source image as a Sharp pipeline. sharp cannot decode HEIC/HEIF in
   * this build, so those are transcoded to PNG (lossless) via heic-convert
   * first, then handed to sharp for the rest of the pipeline.
   */
  private async loadSource(path: string): Promise<Sharp> {
    const fileBuf = await fs.readFile(path);
    if (isHeic(fileBuf)) {
      const png = await heicConvert({ buffer: fileBuf, format: 'PNG' });
      return sharp(Buffer.from(png), { failOn: 'error' });
    }
    return sharp(fileBuf, { failOn: 'error' });
  }

  /**
   * Encode a multi-resolution Windows ICO. Each entry is a PNG (supported by
   * all modern icon loaders), preserving alpha and full quality.
   */
  private async encodeIco(pipeline: Sharp): Promise<Buffer> {
    const src = await pipeline.png().toBuffer();
    const images = await Promise.all(
      ICO_SIZES.map((size) =>
        sharp(src)
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png({ compressionLevel: 9 })
          .toBuffer()
          .then((data) => ({ size, data })),
      ),
    );

    const headerSize = 6;
    const dirEntrySize = 16;
    const dirSize = dirEntrySize * images.length;
    let offset = headerSize + dirSize;

    const header = Buffer.alloc(headerSize);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type 1 = icon
    header.writeUInt16LE(images.length, 4);

    const entries: Buffer[] = [];
    for (const img of images) {
      const e = Buffer.alloc(dirEntrySize);
      e.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // width (0 => 256)
      e.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // height
      e.writeUInt8(0, 2); // color palette
      e.writeUInt8(0, 3); // reserved
      e.writeUInt16LE(1, 4); // color planes
      e.writeUInt16LE(32, 6); // bits per pixel
      e.writeUInt32LE(img.data.length, 8); // size of image data
      e.writeUInt32LE(offset, 12); // offset of image data
      offset += img.data.length;
      entries.push(e);
    }

    return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
  }

  /**
   * Merge several already-uploaded images into a single multi-page PDF,
   * one page per image, in the given order.
   */
  async convertToPdf(fileIds: string[], dto: Omit<ConvertImageDto, 'fileId'>): Promise<ConvertResult> {
    const start = Date.now();
    if (!fileIds.length) {
      throw new AppException(AppErrorCode.CONVERSION_FAILED, 'No files provided for PDF merge.');
    }

    const pdf = await PDFDocument.create();
    const quality = dto.quality ?? 90;
    let firstMeta: Awaited<ReturnType<StorageService['readMeta']>> | null = null;

    for (const fileId of fileIds) {
      const meta = await this.storage.readMeta(fileId);
      if (!meta) {
        throw new AppException(AppErrorCode.FILE_NOT_FOUND, `No upload found for fileId="${fileId}".`);
      }
      if (!firstMeta) firstMeta = meta;

      let pipeline = await this.loadSource(meta.originalPath);
      pipeline = this.applyTransformations(pipeline, { ...dto, outputFormat: OutputFormat.PDF, fileId });

      const hasAlpha = (await pipeline.clone().metadata()).hasAlpha ?? false;
      const useJpeg = !hasAlpha;
      const imgBuf = useJpeg
        ? await pipeline.jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer()
        : await pipeline.png({ compressionLevel: 9 }).toBuffer();
      const image = useJpeg ? await pdf.embedJpg(imgBuf) : await pdf.embedPng(imgBuf);
      const page = pdf.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const buffer = Buffer.from(await pdf.save());
    const outputFileName = `${dto.outputFileName?.trim() || 'merged'}.pdf`;
    const outputPath = this.storage.outputPath(fileIds[0], OutputFormat.PDF);
    await fs.writeFile(outputPath, buffer);

    const meta = firstMeta!;
    meta.lastOutput = {
      format: OutputFormat.PDF,
      path: outputPath,
      size: buffer.length,
      fileName: outputFileName,
      convertedAt: new Date().toISOString(),
    };
    await this.storage.writeMeta(meta);

    return {
      convertedFileId: fileIds[0],
      downloadUrl: `/download/${fileIds[0]}`,
      outputFormat: OutputFormat.PDF,
      outputSize: buffer.length,
      processingTimeMs: Date.now() - start,
      outputFileName,
    };
  }

  /**
   * Encode a lossless 24-bit (BGR, bottom-up) Windows BMP from raw pixels.
   * BMP has no alpha here — callers flatten alpha onto backgroundColor first
   * (BMP is in ALPHA_UNFRIENDLY), so 24-bit is exact and lossless.
   */
  private async encodeBmp(pipeline: Sharp): Promise<Buffer> {
    const { data, info } = await pipeline
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    const rowSize = width * 3;
    const padding = (4 - (rowSize % 4)) % 4;
    const paddedRow = rowSize + padding;
    const pixelDataSize = paddedRow * height;
    const fileHeaderSize = 14;
    const dibHeaderSize = 40;
    const offset = fileHeaderSize + dibHeaderSize;
    const fileSize = offset + pixelDataSize;

    const buf = Buffer.alloc(fileSize);
    // BITMAPFILEHEADER
    buf.write('BM', 0, 'ascii');
    buf.writeUInt32LE(fileSize, 2);
    buf.writeUInt32LE(offset, 10);
    // BITMAPINFOHEADER
    buf.writeUInt32LE(dibHeaderSize, 14);
    buf.writeInt32LE(width, 18);
    buf.writeInt32LE(height, 22); // positive => bottom-up rows
    buf.writeUInt16LE(1, 26); // planes
    buf.writeUInt16LE(24, 28); // bits per pixel
    buf.writeUInt32LE(0, 30); // BI_RGB, no compression
    buf.writeUInt32LE(pixelDataSize, 34);
    buf.writeInt32LE(2835, 38); // ~72 DPI horizontal
    buf.writeInt32LE(2835, 42); // ~72 DPI vertical

    for (let y = 0; y < height; y++) {
      const srcRow = (height - 1 - y) * width * channels; // flip vertically
      let dst = offset + y * paddedRow;
      for (let x = 0; x < width; x++) {
        const s = srcRow + x * channels;
        buf[dst++] = data[s + 2]; // B
        buf[dst++] = data[s + 1]; // G
        buf[dst++] = data[s]; // R
      }
    }
    return buf;
  }

  /**
   * Wrap the processed image in a single-page PDF sized to the image.
   * Photographic sources are embedded as JPEG; everything else as lossless PNG.
   */
  private async encodePdf(pipeline: Sharp, dto: ConvertImageDto): Promise<Buffer> {
    const quality = dto.quality ?? 90;
    const hasAlpha = (await pipeline.clone().metadata()).hasAlpha ?? false;
    // JPEG can't carry transparency; use PNG when the image has an alpha channel.
    const useJpeg = !hasAlpha;
    const imgBuf = useJpeg
      ? await pipeline.jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer()
      : await pipeline.png({ compressionLevel: 9 }).toBuffer();

    const pdf = await PDFDocument.create();
    const image = useJpeg ? await pdf.embedJpg(imgBuf) : await pdf.embedPng(imgBuf);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  async convert(dto: ConvertImageDto): Promise<ConvertResult> {
    const start = Date.now();
    const meta = await this.storage.readMeta(dto.fileId);
    if (!meta) {
      throw new AppException(
        AppErrorCode.FILE_NOT_FOUND,
        `No upload found for fileId="${dto.fileId}".`,
      );
    }

    let outputPath: string;
    let outputSize: number;
    let outputFileName: string;
    try {
      let pipeline = await this.loadSource(meta.originalPath);
      pipeline = this.applyTransformations(pipeline, dto);
      const buffer = await this.renderToBuffer(pipeline, dto);

      outputPath = this.storage.outputPath(dto.fileId, dto.outputFormat);
      await fs.writeFile(outputPath, buffer);
      outputSize = buffer.length;

      const baseName = dto.outputFileName?.trim() || stripExt(meta.originalName);
      outputFileName = `${baseName}.${dto.outputFormat}`;

      meta.lastOutput = {
        format: dto.outputFormat,
        path: outputPath,
        size: outputSize,
        fileName: outputFileName,
        convertedAt: new Date().toISOString(),
      };
      await this.storage.writeMeta(meta);
    } catch (err) {
      if (err instanceof AppException) throw err;
      this.logger.error(`Conversion failed: ${(err as Error).message}`, (err as Error).stack);
      throw new AppException(
        AppErrorCode.CONVERSION_FAILED,
        `Failed to convert image: ${(err as Error).message}`,
      );
    }

    return {
      convertedFileId: dto.fileId,
      downloadUrl: `/download/${dto.fileId}`,
      outputFormat: dto.outputFormat,
      outputSize,
      processingTimeMs: Date.now() - start,
      outputFileName,
    };
  }

  async getPreviewBuffer(fileId: string): Promise<Buffer> {
    const meta = await this.storage.readMeta(fileId);
    if (!meta || !meta.lastOutput) {
      throw new AppException(
        AppErrorCode.FILE_NOT_FOUND,
        `No converted output for fileId="${fileId}".`,
      );
    }
    return sharp(meta.lastOutput.path)
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
  }
}

function isHeic(buf: Buffer): boolean {
  // ISO-BMFF: bytes 4..8 == "ftyp", brand at 8..12 (and compatible brands).
  if (buf.length < 12) return false;
  if (buf.toString('ascii', 4, 8) !== 'ftyp') return false;
  const brand = buf.toString('ascii', 8, 12).toLowerCase();
  return HEIC_BRANDS.includes(brand);
}

function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}
