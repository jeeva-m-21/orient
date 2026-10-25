import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CardSchema } from '@orient/schema';
import {
  nextjsGoldenCard,
  fastapiGoldenCard,
  springbootGoldenCard,
  getFixturePath
} from '../index.js';

describe('Golden Multi-Stack Fixtures', () => {
  it('validates Next.js golden card against CardSchema', () => {
    const parsed = CardSchema.parse(nextjsGoldenCard);
    expect(parsed.authored.role).toBe('entrypoint');
    expect(parsed.derived.languages).toContain('typescript');
    expect(parsed.derived.surface.ports).toContain(3000);
  });

  it('validates FastAPI golden card against CardSchema', () => {
    const parsed = CardSchema.parse(fastapiGoldenCard);
    expect(parsed.authored.role).toBe('entrypoint');
    expect(parsed.derived.languages).toContain('python');
    expect(parsed.derived.surface.ports).toContain(8000);
  });

  it('validates Spring Boot golden card against CardSchema', () => {
    const parsed = CardSchema.parse(springbootGoldenCard);
    expect(parsed.authored.role).toBe('entrypoint');
    expect(parsed.derived.languages).toContain('java');
    expect(parsed.derived.surface.ports).toContain(8080);
  });

  it('provides physical fixture repository directories on disk', () => {
    const nextjsPath = getFixturePath('nextjs');
    expect(fs.existsSync(path.join(nextjsPath, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(nextjsPath, 'app/api/auth/route.ts'))).toBe(true);

    const fastapiPath = getFixturePath('fastapi');
    expect(fs.existsSync(path.join(fastapiPath, 'pyproject.toml'))).toBe(true);
    expect(fs.existsSync(path.join(fastapiPath, 'app/main.py'))).toBe(true);

    const springPath = getFixturePath('springboot');
    expect(fs.existsSync(path.join(springPath, 'pom.xml'))).toBe(true);
  });
});
