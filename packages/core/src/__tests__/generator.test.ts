import { describe, it, expect, vi } from 'vitest';
import { CardSchema, type DerivedData } from '@orient/schema';
import {
  buildDeterministicBrief,
  criticPass,
  generateCardWithBackend,
  type DeterministicBrief,
  type CardGenerationOptions
} from '../generator.js';

describe('Fallback LLM Generator & Critic Pass (SPRINT-5.2)', () => {
  const sampleDerived: DerivedData = {
    fileCount: 3,
    loc: 240,
    languages: ['typescript'],
    keyFiles: [
      { path: 'src/billing/stripe.ts', reason: 'Stripe webhook client' },
      { path: 'src/billing/invoices.ts', reason: 'Invoice generator' }
    ],
    dependsOn: ['src/config', 'src/db'],
    usedBy: ['src/api'],
    surface: {
      routes: [
        { method: 'POST', path: '/billing/webhook', handlerRef: 'src/billing/stripe.ts' },
        { method: 'GET', path: '/billing/invoices', handlerRef: 'src/billing/invoices.ts' }
      ],
      exports: ['handleStripeWebhook', 'getInvoiceById'],
      envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
      tables: ['subscriptions', 'invoices'],
      ports: []
    },
    tests: {
      present: true,
      paths: ['src/billing/__tests__/stripe.test.ts']
    },
    health: {
      lastChanged: '2026-10-25T15:00:00Z',
      todoCount: 0,
      hasTests: true
    }
  };

  it('constructs a compact deterministic brief with AST facts and no sensitive secrets', () => {
    const brief = buildDeterministicBrief({
      path: 'src/billing',
      level: 'folder',
      derived: sampleDerived
    });

    expect(brief.path).toBe('src/billing');
    expect(brief.keyFiles).toContain('src/billing/stripe.ts');
    expect(brief.routes).toContain('POST /billing/webhook');
    expect(brief.exports).toContain('handleStripeWebhook');
    expect(brief.envVars).toContain('STRIPE_SECRET_KEY');

    // Never includes full source code
    expect(brief).not.toHaveProperty('sourceCode');
  });

  describe('criticPass', () => {
    const brief: DeterministicBrief = {
      path: 'src/billing',
      level: 'folder',
      languages: ['typescript'],
      keyFiles: ['src/billing/stripe.ts', 'src/billing/invoices.ts'],
      routes: ['POST /billing/webhook', 'GET /billing/invoices'],
      exports: ['handleStripeWebhook', 'getInvoiceById'],
      envVars: ['STRIPE_SECRET_KEY'],
      dependencies: ['src/config', 'src/db']
    };

    it('strips hallucinated claims referencing non-existent files or routes', () => {
      const ungroundedCard = {
        id: 'card:folder:src/billing',
        level: 'folder' as const,
        path: 'src/billing',
        version: 1,
        state: 'Fresh' as const,
        derived: sampleDerived,
        authored: {
          purpose: 'Billing subsystem managing subscriptions and Stripe integration.',
          role: 'services' as const,
          why: 'Handles customer invoices and recurring payments safely.',
          oneThing: 'Always verify Stripe webhook signatures before processing events.',
          conventions: [
            'Export handlers as async functions',
            'Calls nonExistentFile.ts to process payments', // Hallucination!
            'Route /api/fake-payment processes checkout' // Hallucination!
          ],
          doNot: ['Never log raw webhook payloads containing customer PII.'],
          decisions: [
            {
              choice: 'Stripe Webhooks',
              reason: 'Real-time billing updates'
            }
          ]
        },
        meta: {
          source: 'generated' as const,
          confidence: 'medium' as const,
          evidence: [],
          anchor: { commit: 'commit_hash_123' },
          pinned: false,
          createdAt: '2026-10-25T12:00:00Z',
          updatedAt: '2026-10-25T12:00:00Z'
        }
      };

      const result = criticPass(ungroundedCard, brief);
      expect(result.strippedClaims.length).toBeGreaterThan(0);
      expect(result.card.authored.conventions).not.toContain('Calls nonExistentFile.ts to process payments');
      expect(result.card.authored.conventions).not.toContain('Route /api/fake-payment processes checkout');
      expect(result.card.authored.conventions).toContain('Export handlers as async functions');
    });

    it('enforces string bounds on authored purpose and why', () => {
      const oversizedCard = {
        id: 'card:folder:src/billing',
        level: 'folder' as const,
        path: 'src/billing',
        version: 1,
        state: 'Fresh' as const,
        derived: sampleDerived,
        authored: {
          purpose: 'A'.repeat(200), // Exceeds 140
          role: 'services' as const,
          why: 'B'.repeat(300), // Exceeds 200
          oneThing: 'One two three four five six seven eight nine ten eleven twelve thirteen', // > 12 words
          conventions: [],
          doNot: [],
          decisions: []
        },
        meta: {
          source: 'generated' as const,
          confidence: 'low' as const,
          evidence: [],
          anchor: { commit: 'commit_hash_123' },
          pinned: false,
          createdAt: '2026-10-25T12:00:00Z',
          updatedAt: '2026-10-25T12:00:00Z'
        }
      };

      const result = criticPass(oversizedCard, brief);
      expect(result.card.authored.purpose.length).toBeLessThanOrEqual(140);
      expect(result.card.authored.why.length).toBeLessThanOrEqual(200);
      expect(result.card.authored.oneThing.split(/\s+/).length).toBeLessThanOrEqual(12);
    });
  });

  describe('generateCardWithBackend', () => {
    it('produces valid card conforming to CardSchema with heuristic fallback backend', async () => {
      const options: CardGenerationOptions = {
        path: 'src/billing',
        level: 'folder',
        derived: sampleDerived,
        backend: 'heuristic',
        commit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
      };

      const card = await generateCardWithBackend(options);
      expect(card.path).toBe('src/billing');
      expect(card.authored.purpose).toBeDefined();
      expect(card.authored.role).toBe('routes');
      expect(card.meta.source).toBe('generated');

      const parseResult = CardSchema.safeParse(card);
      expect(parseResult.success).toBe(true);
    });

    it('invokes custom provider and caches the result for identical interface and structure hashes', async () => {
      const mockProvider = vi.fn().mockResolvedValue(
        JSON.stringify({
          purpose: 'Billing module for Stripe payments',
          role: 'services',
          why: 'Isolates external payment provider communication',
          oneThing: 'Verify webhook signatures before updating database tables',
          conventions: ['Export handlers as async functions'],
          doNot: ['Never commit live Stripe secret keys']
        })
      );

      const options: CardGenerationOptions = {
        path: 'src/billing',
        level: 'folder',
        derived: sampleDerived,
        backend: 'custom',
        provider: mockProvider,
        commit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        cacheKey: 'test-cache-key-1'
      };

      const card1 = await generateCardWithBackend(options);
      expect(mockProvider).toHaveBeenCalledTimes(1);
      expect(card1.authored.purpose).toBe('Billing module for Stripe payments');

      // Second call with same cacheKey should return cached card without calling provider
      const card2 = await generateCardWithBackend(options);
      expect(mockProvider).toHaveBeenCalledTimes(1);
      expect(card2.authored.purpose).toBe('Billing module for Stripe payments');
    });
  });
});
