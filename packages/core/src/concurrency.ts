import {
  AuthoredDataSchema,
  CardSchema,
  type AuthoredData,
  type Card
} from '@orient/schema';
import {
  getCardRecordByPath,
  upsertCardRecord,
  type OrientDatabase
} from './db.js';
import { saveCardToDisk } from './durableCards.js';

export class PathMutex {
  private locks = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    let releaseLock: () => void = () => {};
    const currentPromise = this.locks.get(key) || Promise.resolve();

    const nextPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const chainPromise = currentPromise.then(() => nextPromise);
    this.locks.set(key, chainPromise);

    await currentPromise;

    return () => {
      releaseLock();
      if (this.locks.get(key) === chainPromise) {
        this.locks.delete(key);
      }
    };
  }
}

export type SlotMergeResult =
  | { status: 'merged'; mergedAuthored: AuthoredData; mergedSlots: string[] }
  | { status: 'conflict'; conflictSlots: string[] };

function areEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function mergeCardSlots(
  base: AuthoredData,
  current: AuthoredData,
  incoming: Partial<AuthoredData>
): SlotMergeResult {
  const allSlots: Array<keyof AuthoredData> = [
    'purpose',
    'role',
    'why',
    'oneThing',
    'conventions',
    'doNot',
    'decisions',
    'representativeFile',
    'contrast'
  ];

  const incomingModifiedSlots: Array<keyof AuthoredData> = [];
  const currentModifiedSlots: Array<keyof AuthoredData> = [];
  const conflictSlots: string[] = [];

  for (const slot of allSlots) {
    const baseVal = base[slot];
    const currVal = current[slot];
    const incomingVal = incoming[slot];

    const isIncomingChanged = incomingVal !== undefined && !areEqual(incomingVal, baseVal);
    const isCurrentChanged = currVal !== undefined && !areEqual(currVal, baseVal);

    if (isIncomingChanged) incomingModifiedSlots.push(slot);
    if (isCurrentChanged) currentModifiedSlots.push(slot);

    // If both modified the same slot with differing values -> conflict!
    if (isIncomingChanged && isCurrentChanged && !areEqual(incomingVal, currVal)) {
      conflictSlots.push(slot);
    }
  }

  if (conflictSlots.length > 0) {
    return { status: 'conflict', conflictSlots };
  }

  // Safe disjoint merge
  const merged: AuthoredData = {
    ...current
  };

  for (const slot of incomingModifiedSlots) {
    (merged as Record<string, unknown>)[slot] = (incoming as Record<string, unknown>)[slot];
  }

  const validated = AuthoredDataSchema.parse(merged);

  return {
    status: 'merged',
    mergedAuthored: validated,
    mergedSlots: incomingModifiedSlots
  };
}

export interface CardUpdateParams {
  orientDb: OrientDatabase;
  repoRoot: string;
  mutex: PathMutex;
  path: string;
  expectedVersion?: number;
  authoredUpdates: Partial<AuthoredData>;
  agent?: { name: string; sessionId?: string };
}

export type CardUpdateOutcome =
  | { status: 'updated'; card: Card }
  | { status: 'merged'; card: Card; mergedSlots: string[] }
  | { status: 'conflict'; currentVersion: number; conflictSlots: string[] };

export async function applyCardUpdate(
  params: CardUpdateParams
): Promise<CardUpdateOutcome> {
  const { orientDb, repoRoot, mutex, path: cardPath, expectedVersion, authoredUpdates } = params;

  const release = await mutex.acquire(cardPath);

  try {
    const currentCard = getCardRecordByPath(orientDb, cardPath);
    if (!currentCard) {
      throw new Error(`Card at path "${cardPath}" does not exist in store`);
    }

    const isVersionMatch = expectedVersion === undefined || expectedVersion === currentCard.version;

    if (isVersionMatch) {
      // Clean non-concurrent update
      const newAuthored = AuthoredDataSchema.parse({
        ...currentCard.authored,
        ...authoredUpdates
      });

      const updatedCard: Card = CardSchema.parse({
        ...currentCard,
        version: currentCard.version + 1,
        authored: newAuthored,
        meta: {
          ...currentCard.meta,
          updatedAt: new Date().toISOString()
        }
      });

      upsertCardRecord(orientDb, updatedCard);
      saveCardToDisk(repoRoot, updatedCard);

      return { status: 'updated', card: updatedCard };
    }

    // Version mismatch: OCC 3-way disjoint merge
    // Retrieve historical version from DB to serve as base
    let baseAuthored = currentCard.authored;

    const histRow = orientDb.raw
      .prepare('SELECT authored_json FROM card_versions WHERE card_path = ? AND version = ?')
      .get(cardPath, expectedVersion) as { authored_json: string } | undefined;

    if (histRow) {
      try {
        baseAuthored = JSON.parse(histRow.authored_json);
      } catch {
        // Fallback
      }
    }

    const mergeResult = mergeCardSlots(baseAuthored, currentCard.authored, authoredUpdates);

    if (mergeResult.status === 'conflict') {
      return {
        status: 'conflict',
        currentVersion: currentCard.version,
        conflictSlots: mergeResult.conflictSlots
      };
    }

    const mergedCard: Card = CardSchema.parse({
      ...currentCard,
      version: currentCard.version + 1,
      authored: mergeResult.mergedAuthored,
      meta: {
        ...currentCard.meta,
        updatedAt: new Date().toISOString()
      }
    });

    upsertCardRecord(orientDb, mergedCard);
    saveCardToDisk(repoRoot, mergedCard);

    return {
      status: 'merged',
      card: mergedCard,
      mergedSlots: mergeResult.mergedSlots
    };
  } finally {
    release();
  }
}
