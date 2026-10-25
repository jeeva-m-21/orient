import { z } from 'zod';

export const RoleEnum = z.enum([
  'entrypoint',
  'routes',
  'controllers',
  'services',
  'repositories',
  'models',
  'migrations',
  'middleware',
  'ui-components',
  'ui-pages',
  'state',
  'hooks',
  'utils',
  'config',
  'infra',
  'scripts',
  'tests',
  'fixtures',
  'docs',
  'assets',
  'generated',
  'vendor',
  'other'
]);
export type Role = z.infer<typeof RoleEnum>;

export const CardLevelEnum = z.enum(['repo', 'folder', 'file']);
export type CardLevel = z.infer<typeof CardLevelEnum>;

export const StalenessStateEnum = z.enum([
  'Fresh',
  'Drifted',
  'Outdated',
  'Affected',
  'Unknown'
]);
export type StalenessState = z.infer<typeof StalenessStateEnum>;

export const SourceEnum = z.enum(['agent-reported', 'generated', 'human']);
export type Source = z.infer<typeof SourceEnum>;

export const ConfidenceEnum = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceEnum>;

export const EvidenceKindEnum = z.enum(['file', 'line', 'import', 'route', 'config']);
export type EvidenceKind = z.infer<typeof EvidenceKindEnum>;

export const EvidenceSchema = z.object({
  kind: EvidenceKindEnum,
  ref: z.string().min(1),
  note: z.string().optional()
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const AnchorSchema = z.object({
  commit: z.string().min(1),
  blob: z.string().optional(),
  tree: z.string().optional(),
  normalized: z.string().optional(),
  interface: z.string().optional(),
  structure: z.string().optional()
});
export type Anchor = z.infer<typeof AnchorSchema>;

export const RouteDefSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  handlerRef: z.string().optional()
});
export type RouteDef = z.infer<typeof RouteDefSchema>;

export const KeyFileSchema = z.object({
  path: z.string().min(1),
  reason: z.string().min(1)
});
export type KeyFile = z.infer<typeof KeyFileSchema>;

export const SurfaceSchema = z.object({
  routes: z.array(RouteDefSchema).default([]),
  exports: z.array(z.string()).default([]),
  envVars: z.array(z.string()).default([]),
  tables: z.array(z.string()).default([]),
  ports: z.array(z.number()).default([])
});
export type Surface = z.infer<typeof SurfaceSchema>;

export const DerivedDataSchema = z.object({
  fileCount: z.number().int().nonnegative(),
  loc: z.number().int().nonnegative(),
  languages: z.array(z.string()),
  keyFiles: z.array(KeyFileSchema).default([]),
  dependsOn: z.array(z.string()).default([]),
  usedBy: z.array(z.string()).default([]),
  surface: SurfaceSchema,
  tests: z.object({
    present: z.boolean(),
    paths: z.array(z.string()).default([]),
    command: z.string().optional()
  }),
  health: z.object({
    lastChanged: z.string(),
    todoCount: z.number().int().nonnegative().default(0),
    hasTests: z.boolean()
  })
});
export type DerivedData = z.infer<typeof DerivedDataSchema>;

export const DecisionSchema = z.object({
  choice: z.string().min(1),
  alternatives: z.array(z.string()).optional(),
  reason: z.string().optional()
});
export type Decision = z.infer<typeof DecisionSchema>;

export const RepresentativeFileSchema = z.object({
  path: z.string().min(1),
  snippetRange: z.tuple([z.number().int().positive(), z.number().int().positive()])
});
export type RepresentativeFile = z.infer<typeof RepresentativeFileSchema>;

export const AuthoredDataSchema = z.object({
  purpose: z.string().max(140),
  role: RoleEnum,
  why: z.string().max(200),
  oneThing: z.string(),
  conventions: z.array(z.string().max(120)).max(5).default([]),
  doNot: z.array(z.string()).max(5).default([]),
  decisions: z.array(DecisionSchema).default([]),
  representativeFile: RepresentativeFileSchema.optional(),
  contrast: z.string().optional()
});
export type AuthoredData = z.infer<typeof AuthoredDataSchema>;

export const CardMetaSchema = z.object({
  source: SourceEnum,
  agent: z
    .object({
      name: z.string().min(1),
      sessionId: z.string().optional(),
      color: z.string().min(1)
    })
    .optional(),
  confidence: ConfidenceEnum,
  evidence: z.array(EvidenceSchema).default([]),
  anchor: AnchorSchema,
  pinned: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
  origin: z
    .object({
      commit: z.string().optional(),
      promptSummary: z.string().optional()
    })
    .optional()
});
export type CardMeta = z.infer<typeof CardMetaSchema>;

export const CardSchema = z.object({
  id: z.string().min(1),
  level: CardLevelEnum,
  path: z.string(),
  version: z.number().int().positive().default(1),
  state: StalenessStateEnum.default('Unknown'),
  derived: DerivedDataSchema,
  authored: AuthoredDataSchema,
  meta: CardMetaSchema
});
export type Card = z.infer<typeof CardSchema>;
