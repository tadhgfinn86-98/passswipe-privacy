type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

const DEBUG_ENABLED = process.env.LOG_LEVEL?.toLowerCase() === 'debug';

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function format(level: Level, message: string): string {
  return `${timestamp()} [${level}] ${message}`;
}

/** Turns anything thrown into a short, readable one-liner. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export const logger = {
  info(message: string): void {
    console.log(format('INFO', message));
  },

  warn(message: string): void {
    console.warn(format('WARN', message));
  },

  /**
   * `error` accepts anything thrown — the message stays on one line and the
   * stack is only printed when it is actually available.
   */
  error(message: string, error?: unknown): void {
    if (error === undefined) {
      console.error(format('ERROR', message));
      return;
    }
    console.error(format('ERROR', `${message}: ${describeError(error)}`));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  },

  /** Only printed when LOG_LEVEL=debug, so normal logs stay readable. */
  debug(message: string): void {
    if (DEBUG_ENABLED) {
      console.log(format('DEBUG', message));
    }
  },
};
