type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
type Fields = Record<string, unknown>;

interface LoggerOptions {
  write?: (line: string) => void;
  base?: Fields;
}

function serialise(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

export function createLogger(options: LoggerOptions = {}) {
  const write = options.write ?? ((line: string) => process.stdout.write(line + '\n'));
  const base = options.base ?? {};

  function emit(severity: Severity, message: string, fields: Fields = {}) {
    const entry: Fields = { severity, message, time: new Date().toISOString(), ...base };
    for (const [k, v] of Object.entries(fields)) entry[k] = serialise(v);
    write(JSON.stringify(entry));
  }

  return {
    debug: (message: string, fields?: Fields) => emit('DEBUG', message, fields),
    info: (message: string, fields?: Fields) => emit('INFO', message, fields),
    warn: (message: string, fields?: Fields) => emit('WARNING', message, fields),
    error: (message: string, fields?: Fields) => emit('ERROR', message, fields),
  };
}

export type Logger = ReturnType<typeof createLogger>;

export const logger: Logger = createLogger({ base: { service: 'cofresso-web' } });

/**
 * Extract the Cloud Trace id from an incoming request so Cloud Logging can
 * group log lines with the request. Header format: TRACE_ID/SPAN_ID;o=1
 */
export function traceFields(
  headers: Headers,
  projectId = process.env.GOOGLE_CLOUD_PROJECT,
): Fields {
  const header = headers.get('x-cloud-trace-context');
  if (!header || !projectId) return {};
  const traceId = header.split('/')[0];
  return { 'logging.googleapis.com/trace': `projects/${projectId}/traces/${traceId}` };
}
