import { z } from 'zod';
import { RoleEnum, ConfidenceEnum, DecisionSchema, StalenessStateEnum, SourceEnum } from './card.js';

export const ChangeKindEnum = z.enum(['created', 'modified', 'removed', 'moved']);
export type ChangeKind = z.infer<typeof ChangeKindEnum>;

export const ReportItemSchema = z.object({
  path: z.string().min(1),
  kind: ChangeKindEnum,
  role: RoleEnum.optional(),
  why: z.string().max(200).optional(),
  decisions: z.array(DecisionSchema).optional(),
  surface: z
    .object({
      routes: z.array(z.string()).optional(),
      envVars: z.array(z.string()).optional(),
      ports: z.array(z.number()).optional(),
      deps: z.array(z.string()).optional()
    })
    .optional(),
  confidence: ConfidenceEnum.optional(),
  claims: z
    .array(
      z.object({
        kind: z.enum(['file', 'line', 'import', 'route', 'config']),
        ref: z.string().min(1),
        note: z.string().optional()
      })
    )
    .optional()
});
export type ReportItem = z.infer<typeof ReportItemSchema>;

export const ReportSchema = z.object({
  agent: z.object({
    name: z.string().min(1),
    sessionId: z.string().optional()
  }),
  taskSummary: z.string().max(140),
  anchor: z.object({
    commit: z.string().min(1),
    workingTreeHash: z.string().optional()
  }),
  items: z.array(ReportItemSchema).min(1)
});
export type Report = z.infer<typeof ReportSchema>;

export const ReportResultSchema = z.object({
  accepted: z.boolean(),
  acceptedItems: z.array(z.string()),
  rejectedItems: z.array(
    z.object({
      path: z.string(),
      reason: z.string()
    })
  )
});
export type ReportResult = z.infer<typeof ReportResultSchema>;

export const InboxItemTypeEnum = z.enum([
  'unreported-change',
  'outdated-card',
  'collision',
  'failing-test',
  'new-dependency',
  'new-port-env',
  'changed-since-reviewed'
]);
export type InboxItemType = z.infer<typeof InboxItemTypeEnum>;

export const InboxItemStateEnum = z.enum(['pending', 'reviewed', 'dismissed']);
export type InboxItemState = z.infer<typeof InboxItemStateEnum>;

export const InboxItemSchema = z.object({
  id: z.string().min(1),
  type: InboxItemTypeEnum,
  path: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string(),
  score: z.number().nonnegative(),
  state: InboxItemStateEnum.default('pending'),
  createdAt: z.string(),
  data: z.record(z.unknown()).optional()
});
export type InboxItem = z.infer<typeof InboxItemSchema>;

export const ReviewRequestSchema = z.object({
  path: z.string().min(1),
  hash: z.string().min(1)
});
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;

export const ReviewRecordSchema = z.object({
  path: z.string().min(1),
  hash: z.string().min(1),
  reviewedAt: z.string()
});
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

export const FindForTaskRequestSchema = z.object({
  text: z.string().min(1)
});
export type FindForTaskRequest = z.infer<typeof FindForTaskRequestSchema>;

export const FindForTaskResponseSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().min(1),
      score: z.number(),
      reason: z.string()
    })
  ),
  conventions: z.array(z.string()).default([]),
  touches: z.array(z.string()).default([]),
  confidence: ConfidenceEnum
});
export type FindForTaskResponse = z.infer<typeof FindForTaskResponseSchema>;

export const AgentStepEnum = z.enum([
  'reading',
  'planning',
  'editing',
  'testing',
  'waiting',
  'stuck',
  'done'
]);
export type AgentStep = z.infer<typeof AgentStepEnum>;

export const AgentStateSchema = z.object({
  agent: z.string().min(1),
  color: z.string().min(1),
  task: z.string(),
  step: AgentStepEnum
});
export type AgentState = z.infer<typeof AgentStateSchema>;

export const TreeNodeSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  name: z.string().min(1),
  isFolder: z.boolean(),
  children: z.array(z.string()).optional(),
  role: RoleEnum.optional(),
  status: StalenessStateEnum.default('Unknown'),
  activeAgent: z.string().optional()
});
export type TreeNode = z.infer<typeof TreeNodeSchema>;

export const EventPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scan.progress'),
    payload: z.object({
      phase: z.string(),
      done: z.number().int().nonnegative(),
      total: z.number().int().nonnegative()
    })
  }),
  z.object({
    type: z.literal('tree.patch'),
    payload: z.object({
      added: z.array(TreeNodeSchema).default([]),
      removed: z.array(z.string()).default([]),
      updated: z.array(TreeNodeSchema).default([])
    })
  }),
  z.object({
    type: z.literal('card.updated'),
    payload: z.object({
      cardId: z.string(),
      status: StalenessStateEnum,
      source: SourceEnum,
      version: z.number().int().positive()
    })
  }),
  z.object({
    type: z.literal('status.changed'),
    payload: z.object({
      path: z.string(),
      from: StalenessStateEnum,
      to: StalenessStateEnum
    })
  }),
  z.object({
    type: z.literal('agent.state'),
    payload: AgentStateSchema
  }),
  z.object({
    type: z.literal('inbox.updated'),
    payload: z.object({
      items: z.array(InboxItemSchema)
    })
  }),
  z.object({
    type: z.literal('report.received'),
    payload: z.object({
      agent: z.string(),
      accepted: z.boolean(),
      rejectedReasons: z.array(z.string()).optional()
    })
  })
]);
export type EventPayload = z.infer<typeof EventPayloadSchema>;
