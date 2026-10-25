import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface AuditLogEntry {
  timestamp: string;
  eventType:
    | 'mcp_tool_call'
    | 'report_ingestion'
    | 'validation_failure'
    | 'conflict_rejection'
    | 'card_mutation';
  agent?: {
    name: string;
    sessionId?: string;
  };
  projectPath: string;
  details: Record<string, unknown>;
}

export function redactSensitiveContent(text: string): string {
  let result = text;

  // 1. Private keys
  result = result.replace(
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
    '[REDACTED_PRIVATE_KEY]'
  );

  // 2. Bearer tokens
  result = result.replace(/\bBearer\s+[a-zA-Z0-9_\-.]{20,}\b/gi, 'Bearer [REDACTED_TOKEN]');

  // 3. API keys (e.g. sk-..., secret-..., ghp_...)
  result = result.replace(/\bsk-(?:proj-)?[a-zA-Z0-9_\-.]{20,}\b/gi, '[REDACTED_API_KEY]');

  // 4. Passwords / secrets in env or JSON style
  result = result.replace(
    /([A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|KEY)\s*[:=]\s*["']?)([^"'\r\n\s]{8,})(["']?)/gi,
    (_match, prefix: string, _val: string, suffix: string) => {
      if (/password/i.test(prefix)) return `${prefix}[REDACTED_PASSWORD]${suffix}`;
      if (/key/i.test(prefix)) return `${prefix}[REDACTED_API_KEY]${suffix}`;
      if (/token/i.test(prefix)) return `${prefix}[REDACTED_TOKEN]${suffix}`;
      return `${prefix}[REDACTED_SECRET]${suffix}`;
    }
  );

  return result;
}

export class AuditLogger {
  readonly logFilePath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.logFilePath = customPath;
    } else {
      const homeDir = os.homedir();
      this.logFilePath = path.join(homeDir, '.config', 'orient', 'audit.log');
    }
  }

  log(entry: AuditLogEntry): void {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    const rawJson = JSON.stringify(entry);
    const sanitizedJson = redactSensitiveContent(rawJson) + '\n';

    fs.appendFileSync(this.logFilePath, sanitizedJson, {
      encoding: 'utf8',
      mode: 0o600
    });
  }

  readRecentEntries(count = 50): AuditLogEntry[] {
    if (!fs.existsSync(this.logFilePath)) {
      return [];
    }

    try {
      const lines = fs
        .readFileSync(this.logFilePath, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const slice = lines.slice(-count);
      return slice.map((l) => JSON.parse(l) as AuditLogEntry);
    } catch {
      return [];
    }
  }
}
