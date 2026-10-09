import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

const safeMessages: Record<number, string> = {
  400: 'Solicitud no válida. Revisa los campos del formulario.',
  404: 'Recurso no encontrado.',
  413: 'La solicitud supera el tamaño permitido.',
  429: 'Has realizado demasiadas solicitudes. Inténtalo más tarde.',
  503: 'El contacto directo no está disponible. Inténtalo más tarde o utiliza el correo de seguridad.',
};
const safeUnavailableMessages = new Set([
  'El contacto directo todavía no está disponible. Puedes escribir a security@stanelabs.com.',
  'No se pudo entregar el mensaje. Inténtalo más tarde o utiliza el correo de seguridad.',
]);

/** Never serialize or log an exception, request, parser snippet or validation value. */
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const candidate = exception instanceof HttpException
      ? exception.getStatus()
      : typeof exception === 'object' && exception !== null && 'statusCode' in exception
        ? Number(exception.statusCode)
        : 500;
    const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
    let message = safeMessages[status] || 'No se pudo procesar la solicitud.';
    // Only server-authored, allowlisted availability messages may pass through.
    if (status === 503 && exception instanceof HttpException) {
      const payload = exception.getResponse();
      const text = typeof payload === 'string' ? payload : (payload as { message?: unknown }).message;
      if (typeof text === 'string' && safeUnavailableMessages.has(text)) message = text;
    }
    if (response.headersSent) { response.end(); return; }
    response.status(status).json({ statusCode: status, message });
  }
}
