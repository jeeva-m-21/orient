import {
  ReportSchema,
  type Report,
  type ReportResult,
  type Card,
  sanitizeCardText,
  isBlacklistedPath,
  validateSafePath
} from '@orient/schema';

export interface ValidationContext {
  repoRoot: string;
  knownFiles: Set<string>;
  fileFactsMap?: Map<
    string,
    {
      routes?: Array<{ path: string; method?: string }>;
      exports?: Array<{ name: string }>;
      envVars?: string[];
      imports?: Array<{ source: string }>;
    }
  >;
  currentCardsMap?: Map<string, Card>;
}

export interface VerifiedClaim {
  path: string;
  kind: string;
  ref: string;
  status: 'verified' | 'unverified';
}

export interface ValidationOutcome {
  result: ReportResult;
  sanitizedReport: Report;
  verifiedClaims: VerifiedClaim[];
}

export function validateAgentReport(
  rawReport: Report,
  context: ValidationContext
): ValidationOutcome {
  const validatedReport = ReportSchema.parse(rawReport);

  const sanitizedTaskSummary = sanitizeCardText(validatedReport.taskSummary, 140);
  const acceptedItems: string[] = [];
  const rejectedItems: Array<{ path: string; reason: string }> = [];
  const verifiedClaims: VerifiedClaim[] = [];
  const sanitizedItems: Report['items'] = [];

  for (const item of validatedReport.items) {
    const normPath = item.path.replace(/\\/g, '/');

    // 1. Blacklist check
    if (isBlacklistedPath(normPath)) {
      rejectedItems.push({
        path: item.path,
        reason: `Path is a restricted secret or credential: ${item.path}`
      });
      continue;
    }

    // 2. Safe path / traversal check
    try {
      validateSafePath(context.repoRoot, normPath);
    } catch {
      rejectedItems.push({
        path: item.path,
        reason: `Path escapes workspace boundary: ${item.path}`
      });
      continue;
    }

    // 3. Human pin protection
    const existingCard = context.currentCardsMap?.get(normPath);
    if (existingCard?.meta?.pinned) {
      rejectedItems.push({
        path: item.path,
        reason: `Card at ${item.path} is pinned by a human and cannot be modified by agent reports`
      });
      continue;
    }

    // 4. Anti-Hallucination: File/folder existence in workspace
    if (item.kind !== 'removed') {
      const existsAsFile = context.knownFiles.has(normPath);
      let existsAsFolder = false;
      if (!existsAsFile) {
        const folderPrefix = normPath.endsWith('/') ? normPath : `${normPath}/`;
        for (const kf of context.knownFiles) {
          if (kf.startsWith(folderPrefix)) {
            existsAsFolder = true;
            break;
          }
        }
      }

      if (!existsAsFile && !existsAsFolder) {
        rejectedItems.push({
          path: item.path,
          reason: `Referenced path does not exist in workspace tree (hallucinated path: ${item.path})`
        });
        continue;
      }
    }

    // 5. Cross-check claims against AST facts
    let hasUnverifiedClaim = false;
    if (item.claims && item.claims.length > 0) {
      const facts = context.fileFactsMap?.get(normPath);

      for (const claim of item.claims) {
        let isVerified = false;

        if (claim.kind === 'file') {
          isVerified = context.knownFiles.has(claim.ref.replace(/\\/g, '/'));
        } else if (claim.kind === 'route') {
          isVerified = Array.isArray(facts?.routes) && facts.routes.some((r) => r.path === claim.ref);
        } else if (claim.kind === 'import') {
          isVerified = Array.isArray(facts?.imports) && facts.imports.some((i) => i.source === claim.ref);
        } else {
          // line, config, etc. default to plausible
          isVerified = true;
        }

        verifiedClaims.push({
          path: normPath,
          kind: claim.kind,
          ref: claim.ref,
          status: isVerified ? 'verified' : 'unverified'
        });

        if (!isVerified) {
          hasUnverifiedClaim = true;
        }
      }
    }

    // 6. Text sanitization on why
    const sanitizedWhy = item.why ? sanitizeCardText(item.why, 200) : undefined;
    const finalConfidence = hasUnverifiedClaim ? 'low' : item.confidence;

    sanitizedItems.push({
      ...item,
      why: sanitizedWhy,
      confidence: finalConfidence
    });

    acceptedItems.push(item.path);
  }

  const accepted = rejectedItems.length === 0 && acceptedItems.length > 0;

  return {
    result: {
      accepted,
      acceptedItems,
      rejectedItems
    },
    sanitizedReport: {
      ...validatedReport,
      taskSummary: sanitizedTaskSummary,
      items: sanitizedItems
    },
    verifiedClaims
  };
}
