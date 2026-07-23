import { ArgumentsHost } from '@nestjs/common';
import { GlobalHttpExceptionFilter } from './http-exception.filter';
import { AppException } from '../errors/app.exception';
import { AppErrorCode } from '../errors/error-codes';

function makeHost(): { host: ArgumentsHost; res: { statusCode?: number; body?: any } } {
  const res: any = {};
  res.status = (s: number) => {
    res.statusCode = s;
    return res;
  };
  res.json = (b: any) => {
    res.body = b;
    return res;
  };
  const req = { method: 'POST', url: '/x' };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('GlobalHttpExceptionFilter', () => {
  const filter = new GlobalHttpExceptionFilter();

  it('renders AppException with correct shape and status', () => {
    const { host, res } = makeHost();
    filter.catch(new AppException(AppErrorCode.FILE_TOO_LARGE, 'too big'), host);
    expect(res.statusCode).toBe(413);
    expect(res.body).toMatchObject({
      statusCode: 413,
      error: AppErrorCode.FILE_TOO_LARGE,
      message: 'too big',
    });
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('maps each AppErrorCode to its declared HTTP status', () => {
    const cases: Array<[AppErrorCode, number]> = [
      [AppErrorCode.FILE_TOO_LARGE, 413],
      [AppErrorCode.UNSUPPORTED_FORMAT, 422],
      [AppErrorCode.FILE_NOT_FOUND, 404],
      [AppErrorCode.CONVERSION_FAILED, 422],
      [AppErrorCode.INVALID_DIMENSIONS, 400],
      [AppErrorCode.INVALID_QUALITY, 400],
    ];
    for (const [code, status] of cases) {
      const { host, res } = makeHost();
      filter.catch(new AppException(code, 'x'), host);
      expect(res.statusCode).toBe(status);
    }
  });

  it('falls back to 500 for unknown errors', () => {
    const { host, res } = makeHost();
    filter.catch(new Error('boom'), host);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('boom');
  });
});
