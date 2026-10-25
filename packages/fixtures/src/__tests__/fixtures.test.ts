import { describe, it, expect } from 'vitest';
import { CardSchema } from '@orient/schema';
import {
  nextjsGoldenCard,
  fastapiGoldenCard,
  springbootGoldenCard
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
});
