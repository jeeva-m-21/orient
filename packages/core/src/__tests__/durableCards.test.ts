import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { nextjsGoldenCard } from '@orient/fixtures';
import {
  getCardFilePath,
  saveCardToDisk,
  loadCardFromDisk,
  loadAllCardsFromDisk,
  deleteCardFromDisk,
  syncCardsToGitRef,
  loadCardsFromGitRef
} from '../durableCards.js';
import type { Card } from '@orient/schema';

describe('Durable Card Storage (.project/cards/) (SPRINT-3.2)', () => {
  let tempRepo: string;

  const sampleCard: Card = {
    ...nextjsGoldenCard,
    id: 'test:packages-core',
    path: 'packages/core',
    level: 'folder',
    version: 1,
    state: 'Fresh'
  };

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-durable-repo-'));
    // Initialize git repo for ref tests
    execSync('git init -b main', { cwd: tempRepo, stdio: 'ignore' });
    execSync('git config user.name "Orient Test"', { cwd: tempRepo, stdio: 'ignore' });
    execSync('git config user.email "test@orient.local"', { cwd: tempRepo, stdio: 'ignore' });
    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Test Repo\n', 'utf8');
    execSync('git add . && git commit -m "initial commit"', { cwd: tempRepo, stdio: 'ignore' });
  });

  afterEach(() => {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('generates consistent deterministic file paths for repo, folder, and file cards', () => {
    const rootPath = getCardFilePath(tempRepo, '');
    expect(rootPath).toBe(path.join(tempRepo, '.project', 'cards', '_root.json'));

    const folderPath = getCardFilePath(tempRepo, 'packages/core');
    expect(folderPath).toContain('.project/cards');
    expect(folderPath.endsWith('.json')).toBe(true);

    // Deterministic: multiple calls return exact same file path
    expect(getCardFilePath(tempRepo, 'packages/core')).toBe(folderPath);
  });

  it('saves and loads cards from disk preserving full schema fidelity', () => {
    const filePath = saveCardToDisk(tempRepo, sampleCard);
    expect(fs.existsSync(filePath)).toBe(true);

    const loaded = loadCardFromDisk(tempRepo, 'packages/core');
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(sampleCard.id);
    expect(loaded?.authored.purpose).toBe(sampleCard.authored.purpose);
    expect(loaded?.version).toBe(1);

    const allCards = loadAllCardsFromDisk(tempRepo);
    expect(allCards).toHaveLength(1);
    expect(allCards[0]?.path).toBe('packages/core');
  });

  it('maintains content-addressed immutable version snapshots under .project/cards/.history/', () => {
    saveCardToDisk(tempRepo, sampleCard);

    // Save updated version 2
    const v2Card: Card = {
      ...sampleCard,
      version: 2,
      authored: {
        ...sampleCard.authored,
        purpose: 'Updated purpose for version 2'
      }
    };
    saveCardToDisk(tempRepo, v2Card);

    const historyDir = path.join(tempRepo, '.project', 'cards', '.history');
    expect(fs.existsSync(historyDir)).toBe(true);

    // Check that historical snapshots exist
    const historySubdirs = fs.readdirSync(historyDir);
    expect(historySubdirs.length).toBeGreaterThan(0);

    const snapshots = fs.readdirSync(path.join(historyDir, historySubdirs[0]!));
    expect(snapshots).toContain('v1.json');
    expect(snapshots).toContain('v2.json');
  });

  it('supports card deletion from disk', () => {
    saveCardToDisk(tempRepo, sampleCard);
    expect(loadCardFromDisk(tempRepo, 'packages/core')).not.toBeNull();

    const deleted = deleteCardFromDisk(tempRepo, 'packages/core');
    expect(deleted).toBe(true);
    expect(loadCardFromDisk(tempRepo, 'packages/core')).toBeNull();
  });

  it('synchronizes cards to dedicated git ref (refs/orient/cards) without polluting working tree or HEAD', () => {
    saveCardToDisk(tempRepo, sampleCard);

    const commitSha = syncCardsToGitRef(tempRepo);
    expect(commitSha).toMatch(/^[a-f0-9]{40}$/);

    // Current HEAD commit is still the initial commit
    const headSha = execSync('git rev-parse HEAD', { cwd: tempRepo, encoding: 'utf8' }).trim();
    expect(headSha).not.toBe(commitSha);

    // The dedicated git ref exists
    const refSha = execSync('git rev-parse refs/orient/cards', { cwd: tempRepo, encoding: 'utf8' }).trim();
    expect(refSha).toBe(commitSha);

    // Loading from git ref restores the exact card
    const cardsFromRef = loadCardsFromGitRef(tempRepo);
    expect(cardsFromRef).toHaveLength(1);
    expect(cardsFromRef[0]?.path).toBe('packages/core');
    expect(cardsFromRef[0]?.authored.purpose).toBe(sampleCard.authored.purpose);
  });
});
