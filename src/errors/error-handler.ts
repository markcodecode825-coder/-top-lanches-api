import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from './app-error';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Rota não encontrada',
        statusCode: 404,
        requestId: request.id
      }
    })
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          requestId: request.id,
          ...(error.details === undefined
            ? {}
            : { details: error.details })
        }
      });
    }

    const fastifyError = error as {
      validation?: unknown;
      statusCode?: number;
      code?: unknown;
    };

    if (fastifyError.validation) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          statusCode: 422,
          requestId: request.id,
          details: fastifyError.validation
        }
      });
    }

    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          statusCode: 422,
          requestId: request.id,
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        }
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: 'Já existe um registro com os mesmos dados únicos.',
          statusCode: 409,
          requestId: request.id
        }
      });
    }

    if (fastifyError.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Limite de requisições excedido.',
          statusCode: 429,
          requestId: request.id
        }
      });
    }

    if (
      fastifyError.statusCode === 400 ||
      fastifyError.statusCode === 413
    ) {
      return reply.status(fastifyError.statusCode).send({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            fastifyError.statusCode === 413
              ? 'Payload excede o limite permitido'
              : 'Requisição inválida',
          statusCode: fastifyError.statusCode,
          requestId: request.id
        }
      });
    }

    const errorType =
      error instanceof Error ? error.name : typeof error;
    const errorCode =
      typeof fastifyError.code === 'string'
        ? fastifyError.code
        : undefined;

    request.log.error(
      {
        requestId: request.id,
        errorType,
        ...(errorCode ? { errorCode } : {})
      },
      'Unhandled request error'
    );

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erro interno do servidor',
        statusCode: 500,
        requestId: request.id
      }
    });
  });
}
