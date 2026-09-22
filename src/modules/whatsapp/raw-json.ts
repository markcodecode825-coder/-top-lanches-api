import type { FastifyInstance } from 'fastify';

const rawBodySymbol = Symbol('whatsappRawBody');

type BodyWithRaw = Record<string, unknown> & {
  [rawBodySymbol]?: Buffer;
};

export function registerWhatsAppJsonParser(
  app: FastifyInstance
): void {
  const secureJsonParser =
    app.getDefaultJsonParser('error', 'error');

  app.removeContentTypeParser('application/json');
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (request, body, done) => {
      const rawBody = Buffer.isBuffer(body)
        ? body
        : Buffer.from(body);

      void secureJsonParser(
        request,
        rawBody.toString('utf8'),
        (error, parsed) => {
          if (error) {
            done(error, undefined);
            return;
          }

          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed)
          ) {
            Object.defineProperty(
              parsed,
              rawBodySymbol,
              {
                value: rawBody,
                configurable: false,
                enumerable: false,
                writable: false
              }
            );
          }

          done(null, parsed);
        }
      );
    }
  );
}

export function getWhatsAppRawBody(
  body: unknown
): Buffer | null {
  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body)
  ) {
    return null;
  }

  return (
    (body as BodyWithRaw)[rawBodySymbol] ??
    null
  );
}
