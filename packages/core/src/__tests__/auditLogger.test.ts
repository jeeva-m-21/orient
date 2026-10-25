import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  AuditLogger,
  redactSensitiveContent,
  type AuditLogEntry
} from '../auditLogger.js';

describe('Audit Logger & Forensics (SPRINT-3.5)', () => {
  let tempDir: string;
  let logFile: string;
  let logger: AuditLogger;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-audit-test-'));
    logFile = path.join(tempDir, 'audit.log');
    logger = new AuditLogger(logFile);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('redacts bearer tokens, API keys, private keys, and credential passwords from text', () => {
    const rawText = `
      Authorization: Bearer abcdef1234567890abcdef1234567890
      API_KEY=sk-proj-99887766554433221100aabbccdd
      DB_PASSWORD=my_super_secret_db_pass
      -----BEGIN RSA PRIVATE KEY-----
      MIIEowIBAAKCAQEA0Y123456789...
      -----END RSA PRIVATE KEY-----
    `;

    const redacted = redactSensitiveContent(rawText);

    expect(redacted).not.toContain('abcdef1234567890abcdef1234567890');
    expect(redacted).not.toContain('sk-proj-99887766554433221100aabbccdd');
    expect(redacted).not.toContain('my_super_secret_db_pass');
    expect(redacted).not.toContain('MIIEowIBAAKCAQEA0Y123456789...');

    expect(redacted).toContain('[REDACTED_TOKEN]');
    expect(redacted).toContain('[REDACTED_API_KEY]');
    expect(redacted).toContain('[REDACTED_PASSWORD]');
    expect(redacted).toContain('[REDACTED_PRIVATE_KEY]');
  });

  it('records structured audit log entries in append-only JSON lines', () => {
    const entry1: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      eventType: 'report_ingestion',
      agent: { name: 'Claude Code', sessionId: 'sess-abc' },
      projectPath: '/workspace/project',
      details: {
        accepted: true,
        paths: ['app/api/auth/route.ts']
      }
    };

    const entry2: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      eventType: 'validation_failure',
      agent: { name: 'Cursor Agent' },
      projectPath: '/workspace/project',
      details: {
        rejectedPath: '.env.production',
        reason: 'Restricted credential path'
      }
    };

    logger.log(entry1);
    logger.log(entry2);

    expect(fs.existsSync(logFile)).toBe(true);
    const content = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(content).toHaveLength(2);

    const parsed1 = JSON.parse(content[0]!);
    expect(parsed1.eventType).toBe('report_ingestion');
    expect(parsed1.agent.name).toBe('Claude Code');

    const parsed2 = JSON.parse(content[1]!);
    expect(parsed2.eventType).toBe('validation_failure');
  });

  it('automatically redacts leaked credentials passed in details objects', () => {
    const leakedEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      eventType: 'mcp_tool_call',
      agent: { name: 'Untrusted Agent' },
      projectPath: '/workspace/project',
      details: {
        tool: 'report',
        payload: {
          token: 'Bearer 11223344556677889900aabbccddeeff',
          secretKey: 'sk-1234567890abcdef1234567890'
        }
      }
    };

    logger.log(leakedEntry);

    const rawLog = fs.readFileSync(logFile, 'utf8');
    expect(rawLog).not.toContain('11223344556677889900aabbccddeeff');
    expect(rawLog).not.toContain('sk-1234567890abcdef1234567890');
    expect(rawLog).toContain('[REDACTED_TOKEN]');
    expect(rawLog).toContain('[REDACTED_API_KEY]');
  });

  it('reads recent audit entries in chronological order', () => {
    for (let i = 0; i < 5; i++) {
      logger.log({
        timestamp: new Date().toISOString(),
        eventType: 'card_mutation',
        projectPath: '/workspace',
        details: { index: i }
      });
    }

    const recent = logger.readRecentEntries(3);
    expect(recent).toHaveLength(3);
    expect(recent[2]?.details.index).toBe(4);
  });
});
