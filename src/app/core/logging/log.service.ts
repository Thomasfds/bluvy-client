import { Injectable, signal } from '@angular/core';

export interface LogEntry {
  timestamp: string;
  type: 'log' | 'warn' | 'error';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class LogService {
  readonly logs = signal<LogEntry[]>([]);
  private readonly maxLogs = 500;

  constructor() {
    this.wrapConsole();
  }

  /**
   * Initializes log interception. Safe to call multiple times, but wraps once.
   */
  wrapConsole(): void {
    if (typeof window === 'undefined') return;
    if ((window as any).__bluvy_logs_wrapped) return;
    (window as any).__bluvy_logs_wrapped = true;

    const originalLog   = console.log;
    const originalWarn  = console.warn;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      this.addEntry('log', args);
    };

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      this.addEntry('warn', args);
    };

    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      this.addEntry('error', args);
    };
  }

  private addEntry(type: 'log' | 'warn' | 'error', args: any[]): void {
    try {
      const timestamp = new Date().toLocaleTimeString();
      const messageRaw = args.map(arg => {
        if (arg instanceof Error) {
          return arg.stack || arg.message;
        }
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      const message = this.scrubSensitiveData(messageRaw);

      const currentLogs = this.logs();
      const newLogs = [...currentLogs, { timestamp, type, message }];
      if (newLogs.length > this.maxLogs) {
        newLogs.shift();
      }
      this.logs.set(newLogs);
    } catch {
      // In case logging itself throws an error, prevent infinite loops
    }
  }

  /**
   * Cleans sensitive elements from logs (JWT, long Base64/Hex private keys, Authorization headers)
   */
  private scrubSensitiveData(text: string): string {
    if (!text) return '';

    let clean = text;

    // 1. Scrub JWT tokens (Header.Payload.Signature beginning with eyJ)
    const jwtRegex = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
    clean = clean.replace(jwtRegex, '[JWT_TOKEN]');

    // 2. Scrub Authorization Bearer tokens
    const bearerRegex = /Bearer\s+[a-zA-Z0-9\._\-\/]+/gi;
    clean = clean.replace(bearerRegex, 'Bearer [SCRUBBED]');

    // 3. Scrub long contiguous non-whitespace words (likely hex/base64 keys, MLS packets, ciphertext)
    // Matches any word of length 70+ characters consisting of base64/hex symbols.
    const longKeyRegex = /\b[a-zA-Z0-9\+/=_]{70,}\b/g;
    clean = clean.replace(longKeyRegex, '[LONG_KEY/CIPHERTEXT]');

    // 4. Scrub potential JSON properties containing secrets/keys/passwords
    const keyPropsRegex = /"(password|secret|privateKey|private_key|token|mbk)"\s*:\s*"[^"]*"/gi;
    clean = clean.replace(keyPropsRegex, '"$1":"[SCRUBBED]"');

    return clean;
  }

  clearLogs(): void {
    this.logs.set([]);
  }
}
