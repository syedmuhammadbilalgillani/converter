import sharp from 'sharp';
import { ConvertService } from './convert.service';
import { ConvertImageDto, OutputFormat, ResizeMode } from './dto/convert-image.dto';
import { StorageService } from '../storage/storage.service';

async function srcRgb(width = 100, height = 100): Promise<sharp.Sharp> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .png()
    .toBuffer();
  return sharp(buf);
}

describe('ConvertService.applyTransformations', () => {
  const svc = new ConvertService({} as StorageService);

  function dto(overrides: Partial<ConvertImageDto>): ConvertImageDto {
    return {
      fileId: 'x',
      outputFormat: OutputFormat.PNG,
      ...overrides,
    } as ConvertImageDto;
  }

  it('resizes to the requested dimensions with fit=fill', async () => {
    const out = await svc
      .applyTransformations(await srcRgb(), dto({ width: 50, height: 25, maintainAspectRatio: false }))
      .png()
      .toBuffer();
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(25);
  });

  it('respects resizeMode=contain when maintainAspectRatio=true', async () => {
    const out = await svc
      .applyTransformations(
        await srcRgb(200, 100),
        dto({ width: 50, height: 50, resizeMode: ResizeMode.CONTAIN, maintainAspectRatio: true }),
      )
      .png()
      .toBuffer();
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(50);
  });

  it('grayscale produces equal R/G/B channels', async () => {
    // start from a non-neutral red image so grayscale is a real change
    const red = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .png()
      .toBuffer();
    const out = await svc
      .applyTransformations(sharp(red), dto({ grayscale: true }))
      .png()
      .toBuffer();
    const { channels } = await sharp(out).stats();
    expect(channels[0].mean).toBeCloseTo(channels[1].mean, 0);
    expect(channels[1].mean).toBeCloseTo(channels[2].mean, 0);
  });

  it('rotate=90 swaps width and height', async () => {
    const out = await svc
      .applyTransformations(await srcRgb(80, 40), dto({ rotate: 90 }))
      .png()
      .toBuffer();
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(80);
  });

  it('flatten applies background when output is JPEG', async () => {
    // start from RGBA src
    const rgba = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const out = await svc
      .applyTransformations(sharp(rgba), dto({ outputFormat: OutputFormat.JPEG, backgroundColor: '#ff0000' }))
      .jpeg()
      .toBuffer();
    const { dominant } = await sharp(out).stats();
    expect(dominant.r).toBeGreaterThan(200);
    expect(dominant.g).toBeLessThan(50);
  });
});
