import { describe, it, expect } from 'vitest';
import {
  ReportSchema,
  ReportResultSchema,
  EventPayloadSchema,
  ReviewRequestSchema,
  InboxItemSchema,
  FindForTaskResponseSchema,
  ProjectsResponseSchema,
  TreeResponseSchema,
  CardUpdateRequestSchema,
  InboxResponseSchema,
  type Report,
  type InboxItem
} from '../index.js';

describe('Contracts & Reports Schemas', () => {
  it('validates a complete agent report payload', () => {
    const report: Report = {
      agent: {
        name: 'Cursor',
        sessionId: 'cursor-sess-456'
      },
      taskSummary: 'Implement stripe webhook endpoint for subscription payments',
      anchor: {
        commit: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
        workingTreeHash: 'wt_98765'
      },
      items: [
        {
          path: 'src/webhooks/stripe.ts',
          kind: 'created',
          role: 'routes',
          why: 'Handles customer subscription lifecycle events from Stripe.',
          surface: {
            routes: ['POST /webhooks/stripe'],
            envVars: ['STRIPE_WEBHOOK_SECRET'],
            ports: [],
            deps: ['stripe']
          },
          confidence: 'high'
        }
      ]
    };

    const parsed = ReportSchema.parse(report);
    expect(parsed.agent.name).toBe('Cursor');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.role).toBe('routes');
  });

  it('validates report result responses', () => {
    const successResult = {
      accepted: true,
      acceptedItems: ['src/webhooks/stripe.ts'],
      rejectedItems: []
    };
    expect(ReportResultSchema.parse(successResult).accepted).toBe(true);

    const partialRejection = {
      accepted: false,
      acceptedItems: [],
      rejectedItems: [{ path: 'src/fake.ts', reason: 'Path does not exist in repository' }]
    };
    expect(ReportResultSchema.parse(partialRejection).accepted).toBe(false);
  });

  it('validates typed SSE event payloads', () => {
    const scanProgress = {
      type: 'scan.progress',
      payload: { phase: 'parsing', done: 45, total: 100 }
    };
    expect(EventPayloadSchema.parse(scanProgress).type).toBe('scan.progress');

    const agentState = {
      type: 'agent.state',
      payload: {
        agent: 'Claude Code',
        color: '#E07A5F',
        task: 'Refactoring auth middleware',
        step: 'editing'
      }
    };
    expect(EventPayloadSchema.parse(agentState).type).toBe('agent.state');
  });

  it('validates inbox items and review requests', () => {
    const reviewReq = {
      path: 'src/auth/jwt.ts',
      hash: 'blob_abc123'
    };
    expect(ReviewRequestSchema.parse(reviewReq).path).toBe('src/auth/jwt.ts');

    const inboxItem: InboxItem = {
      id: 'inbox_1',
      type: 'unreported-change',
      path: 'src/payments/webhook.ts',
      title: 'Unreported change · src/payments/webhook.ts',
      subtitle: 'No agent explained this edit.',
      score: 8.5,
      state: 'pending',
      createdAt: '2026-10-25T14:30:00Z'
    };
    expect(InboxItemSchema.parse(inboxItem).score).toBe(8.5);
  });

  it('validates find_for_task responses', () => {
    const taskResponse = {
      files: [
        { path: 'src/auth/jwt.ts', score: 0.92, reason: 'Contains token verification' }
      ],
      conventions: ['Endpoints export route handler using Router'],
      touches: ['src/auth', 'src/middleware'],
      confidence: 'high' as const
    };
    const parsed = FindForTaskResponseSchema.parse(taskResponse);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.confidence).toBe('high');
  });

  it('validates REST API response and request payloads', () => {
    const projectsRes = {
      projects: [
        {
          id: 'proj_1',
          root: '/repos/my-app',
          name: 'my-app',
          branch: 'main',
          activeAgents: ['Claude Code'],
          freshnessPercent: 95,
          outdatedCount: 2,
          unreportedCount: 0,
          lastOpenedAt: '2026-10-25T15:00:00Z'
        }
      ]
    };
    expect(ProjectsResponseSchema.parse(projectsRes).projects).toHaveLength(1);

    const treeRes = {
      projectId: 'proj_1',
      root: [
        {
          id: 'proj_1:src',
          path: 'src',
          name: 'src',
          isFolder: true,
          status: 'Fresh' as const
        }
      ],
      totalFiles: 42,
      noiseCount: 1500
    };
    expect(TreeResponseSchema.parse(treeRes).totalFiles).toBe(42);

    const cardUpdate = {
      path: 'src/auth',
      expectedVersion: 2,
      authored: {
        why: 'Updated why statement'
      },
      pinned: true
    };
    expect(CardUpdateRequestSchema.parse(cardUpdate).pinned).toBe(true);

    const inboxRes = {
      items: [],
      totalCount: 0
    };
    expect(InboxResponseSchema.parse(inboxRes).totalCount).toBe(0);
  });
});
