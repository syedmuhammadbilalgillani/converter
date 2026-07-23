import sharp from 'sharp';
import { FileValidationPipe } from './file-validation.pipe';
import { AppErrorCode } from '../errors/error-codes';
import { AppException } from '../errors/app.exception';

async function makePng(width = 32, height = 32): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
}

function mockFile(opts: Partial<Express.Multer.File> & { buffer: Buffer }): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: opts.buffer.length,
    buffer: opts.buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...opts,
  } as Express.Multer.File;
}

describe('FileValidationPipe', () => {
  const pipe = new FileValidationPipe();

  it('accepts a valid PNG buffer and returns metadata', async () => {
    const buf = await makePng(50, 40);
    const result = await pipe.transform(mockFile({ buffer: buf }));
    expect(result.width).toBe(50);
    expect(result.height).toBe(40);
    expect(result.detectedFormat).toBe('png');
  });

  it('rejects missing file with FILE_NOT_FOUND', async () => {
    await expect(pipe.transform(undefined)).rejects.toMatchObject({
      code: AppErrorCode.FILE_NOT_FOUND,
    });
  });

  it('rejects disallowed MIME type', async () => {
    const buf = await makePng();
    await expect(
      pipe.transform(mockFile({ buffer: buf, mimetype: 'application/pdf' })),
    ).rejects.toBeInstanceOf(AppException);
  });

  it('rejects bytes that arent a valid image (magic byte mismatch)', async () => {
    const buf = Buffer.from('this is just text, not png');
    await expect(
      pipe.transform(mockFile({ buffer: buf, mimetype: 'image/png' })),
    ).rejects.toMatchObject({ code: AppErrorCode.UNSUPPORTED_FORMAT });
  });
});
