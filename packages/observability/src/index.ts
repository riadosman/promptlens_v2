import pino, { type Logger } from 'pino';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const REDACTED_FIELDS = [
  'authorization',
  'cookie',
  'content',
  'password',
  'prompt',
  'refreshToken',
  'secret',
  'token',
  '*.authorization',
  '*.cookie',
  '*.content',
  '*.password',
  '*.prompt',
  '*.refreshToken',
  '*.secret',
  '*.token',
];

export function createLogger(service: string, level = 'info'): Logger {
  return pino({
    base: { service },
    level,
    redact: { paths: REDACTED_FIELDS, censor: '[REDACTED]' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export function startTelemetry(options: {
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly endpoint?: string;
}): Promise<() => Promise<void>> {
  if (!options.endpoint) return Promise.resolve(() => Promise.resolve());
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion,
    }),
    traceExporter: new OTLPTraceExporter({ url: options.endpoint }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  sdk.start();
  return Promise.resolve(() => sdk.shutdown());
}
