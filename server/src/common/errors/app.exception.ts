import { HttpException } from '@nestjs/common';
import { AppErrorCode, ERROR_HTTP_STATUS } from './error-codes';

export class AppException extends HttpException {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
  ) {
    super({ error: code, message }, ERROR_HTTP_STATUS[code]);
  }
}
