import type { Anchor, CardLevel, StalenessState } from '@orient/schema';

export interface StalenessEvaluationInput {
  cardLevel: CardLevel;
  anchor: Anchor;
  currentHashes: {
    blob?: string;
    normalized?: string;
    interface?: string;
    structure?: string;
    tree?: string;
  };
  previousSurface?: {
    exports?: string[];
    routes?: string[];
    files?: string[];
  };
  currentSurface?: {
    exports?: string[];
    routes?: string[];
    files?: string[];
  };
  isDependencyInterfaceChanged?: boolean;
  isPathDeleted?: boolean;
}

export interface StalenessDelta {
  addedExports: string[];
  removedExports: string[];
  addedRoutes: string[];
  removedRoutes: string[];
  addedFiles: string[];
  removedFiles: string[];
}

export interface StalenessResult {
  state: StalenessState;
  reason: string;
  delta?: StalenessDelta;
}

function computeDelta(
  prev?: { exports?: string[]; routes?: string[]; files?: string[] },
  curr?: { exports?: string[]; routes?: string[]; files?: string[] }
): StalenessDelta {
  const prevExports = prev?.exports ?? [];
  const currExports = curr?.exports ?? [];
  const prevRoutes = prev?.routes ?? [];
  const currRoutes = curr?.routes ?? [];
  const prevFiles = prev?.files ?? [];
  const currFiles = curr?.files ?? [];

  return {
    addedExports: currExports.filter((e) => !prevExports.includes(e)),
    removedExports: prevExports.filter((e) => !currExports.includes(e)),
    addedRoutes: currRoutes.filter((r) => !prevRoutes.includes(r)),
    removedRoutes: prevRoutes.filter((r) => !currRoutes.includes(r)),
    addedFiles: currFiles.filter((f) => !prevFiles.includes(f)),
    removedFiles: prevFiles.filter((f) => !currFiles.includes(f))
  };
}

/**
 * Evaluates card staleness against the 5-hash multi-tier engine.
 * Deterministic transition: Unknown -> Fresh -> Drifted -> Outdated -> Affected.
 */
export function evaluateCardStaleness(input: StalenessEvaluationInput): StalenessResult {
  const {
    cardLevel,
    anchor,
    currentHashes,
    previousSurface,
    currentSurface,
    isDependencyInterfaceChanged,
    isPathDeleted
  } = input;

  if (isPathDeleted) {
    return {
      state: 'Unknown',
      reason: 'Path has been deleted from the repository'
    };
  }

  // Check interface hash (public API / routes / exports altered)
  if (
    anchor.interface &&
    currentHashes.interface &&
    anchor.interface !== currentHashes.interface
  ) {
    return {
      state: 'Outdated',
      reason: 'Public interface changed since described',
      delta: computeDelta(previousSurface, currentSurface)
    };
  }

  // Check structure hash for directory/repo level
  if (
    cardLevel !== 'file' &&
    anchor.structure &&
    currentHashes.structure &&
    anchor.structure !== currentHashes.structure
  ) {
    return {
      state: 'Outdated',
      reason: 'Directory structure modified (files added/removed/renamed)',
      delta: computeDelta(previousSurface, currentSurface)
    };
  }

  // Check 1-hop upstream dependency interface change
  if (isDependencyInterfaceChanged) {
    return {
      state: 'Affected',
      reason: 'Dependency interface changed (1-hop reverse dependency affected)'
    };
  }

  // Check implementation / formatting changes (interface remains intact)
  const isBlobChanged =
    anchor.blob && currentHashes.blob && anchor.blob !== currentHashes.blob;
  const isNormalizedChanged =
    anchor.normalized &&
    currentHashes.normalized &&
    anchor.normalized !== currentHashes.normalized;

  if (isBlobChanged || isNormalizedChanged) {
    return {
      state: 'Drifted',
      reason: 'Implementation body or formatting changed, interface intact'
    };
  }

  return {
    state: 'Fresh',
    reason: 'Current code exactly matches described snapshot'
  };
}
