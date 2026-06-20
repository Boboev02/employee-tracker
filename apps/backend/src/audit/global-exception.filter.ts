import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  constructor(private readonly prisma: PrismaService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttpException
      ? (typeof exception.getResponse() === 'string' ? exception.getResponse() : (exception.getResponse() as any)?.message ?? exception.message)
      : (exception as any)?.message ?? 'Unknown error';
    const stack = (exception as any)?.stack;

    // Логируем только реальные ошибки сервера (500+), не обычные 4xx (validation, forbidden и т.д.)
    // Но также логируем 401/403 для отслеживания подозрительной активности
    if (status >= 500 || !isHttpException) {
      try {
        await this.prisma.errorLog.create({
          data: {
            orgId: request.user?.orgId ?? null,
            userId: request.user?.sub ?? request.user?.id ?? null,
            endpoint: request.url,
            method: request.method,
            statusCode: status,
            message: typeof message === 'string' ? message.slice(0, 2000) : JSON.stringify(message).slice(0, 2000),
            stack: stack ? String(stack).slice(0, 5000) : null,
            body: request.body ? JSON.stringify(request.body).slice(0, 2000) : null,
          },
        });
      } catch (e) {
        this.logger.error('Failed to save error log', e);
      }
    }

    this.logger.error(`${request.method} ${request.url} - ${status}: ${message}`);

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
