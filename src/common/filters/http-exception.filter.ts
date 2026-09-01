import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erro interno do servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
      }
    }

    // Log detalhado apenas no server (nunca expor ao cliente)
    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status}`,
      exception instanceof Error ? exception.stack : 'Unknown error',
    );

    // Segurança: Nunca expor stack trace ou detalhes internos ao cliente
    const errorResponse = {
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
      path: request.url,
      // NUNCA incluir stack trace, database errors ou detalhes internos
    };

    // Para erros 500, retornar mensagem genérica
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      errorResponse.message = ['Erro interno do servidor. Tente novamente mais tarde.'];
    }

    response.status(status).json(errorResponse);
  }
}
