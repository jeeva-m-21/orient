import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CardSchema, type Card } from '@orient/schema';

export function getCardSlug(cardPath: string): string {
  if (!cardPath || cardPath === '.' || cardPath === '') {
    return '_root';
  }
  const cleanPath = cardPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  const slug = cleanPath.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('sha256').update(cleanPath).digest('hex').slice(0, 8);
  return `${slug}-${hash}`;
}

export function getCardFilePath(repoRoot: string, cardPath: string): string {
  const slug = getCardSlug(cardPath);
  return path.join(repoRoot, '.project', 'cards', `${slug}.json`);
}

export function saveCardToDisk(repoRoot: string, card: Card): string {
  const validated = CardSchema.parse(card);
  const cardsDir = path.join(repoRoot, '.project', 'cards');
  if (!fs.existsSync(cardsDir)) {
    fs.mkdirSync(cardsDir, { recursive: true });
  }

  const filePath = getCardFilePath(repoRoot, validated.path);
  const jsonContent = JSON.stringify(validated, null, 2) + '\n';
  fs.writeFileSync(filePath, jsonContent, 'utf8');

  // Maintain immutable historical snapshot under .project/cards/.history/<slug>/v<version>.json
  const slug = getCardSlug(validated.path);
  const historyDir = path.join(cardsDir, '.history', slug);
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }

  const snapshotPath = path.join(historyDir, `v${validated.version}.json`);
  fs.writeFileSync(snapshotPath, jsonContent, 'utf8');

  return filePath;
}

export function loadCardFromDisk(repoRoot: string, cardPath: string): Card | null {
  const filePath = getCardFilePath(repoRoot, cardPath);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return CardSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function loadAllCardsFromDisk(repoRoot: string): Card[] {
  const cardsDir = path.join(repoRoot, '.project', 'cards');
  if (!fs.existsSync(cardsDir)) {
    return [];
  }

  const cards: Card[] = [];
  const entries = fs.readdirSync(cardsDir);

  for (const entry of entries) {
    if (entry.endsWith('.json') && !entry.startsWith('.')) {
      try {
        const fullPath = path.join(cardsDir, entry);
        const raw = fs.readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(raw);
        cards.push(CardSchema.parse(parsed));
      } catch {
        // Skip invalid card files
      }
    }
  }

  return cards;
}

export function deleteCardFromDisk(repoRoot: string, cardPath: string): boolean {
  const filePath = getCardFilePath(repoRoot, cardPath);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export function syncCardsToGitRef(
  repoRoot: string,
  refName = 'refs/orient/cards'
): string {
  const cardsDir = path.join(repoRoot, '.project', 'cards');
  if (!fs.existsSync(cardsDir)) {
    fs.mkdirSync(cardsDir, { recursive: true });
  }

  const entries = fs.readdirSync(cardsDir).filter((e) => e.endsWith('.json') && !e.startsWith('.'));
  if (entries.length === 0) {
    throw new Error('No cards found in .project/cards to sync to git ref');
  }

  // Create isolated temp git index file
  const tempIndex = path.join(repoRoot, '.git', `orient-idx-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const env = { ...process.env, GIT_INDEX_FILE: tempIndex };

  try {
    for (const file of entries) {
      const fullPath = path.join(cardsDir, file);
      const blobSha = execFileSync('git', ['hash-object', '-w', fullPath], {
        cwd: repoRoot,
        env,
        encoding: 'utf8'
      }).trim();

      execFileSync(
        'git',
        ['update-index', '--add', '--cacheinfo', '100644', blobSha, `cards/${file}`],
        {
          cwd: repoRoot,
          env,
          stdio: 'ignore'
        }
      );
    }

    const treeSha = execFileSync('git', ['write-tree'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8'
    }).trim();

    // Check if ref already exists for parent link
    let currentRef = '';
    try {
      currentRef = execFileSync('git', ['rev-parse', '--verify', refName], {
        cwd: repoRoot,
        env,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
    } catch {
      // First commit on this ref
    }

    const commitArgs = ['commit-tree', treeSha];
    if (currentRef) {
      commitArgs.push('-p', currentRef);
    }
    commitArgs.push('-m', 'orient: sync cards');

    const commitSha = execFileSync('git', commitArgs, {
      cwd: repoRoot,
      env,
      encoding: 'utf8'
    }).trim();

    execFileSync('git', ['update-ref', refName, commitSha], {
      cwd: repoRoot,
      env,
      stdio: 'ignore'
    });

    return commitSha;
  } finally {
    if (fs.existsSync(tempIndex)) {
      fs.unlinkSync(tempIndex);
    }
  }
}

export function loadCardsFromGitRef(
  repoRoot: string,
  refName = 'refs/orient/cards'
): Card[] {
  const cards: Card[] = [];

  try {
    const lsOutput = execFileSync('git', ['ls-tree', '-r', `${refName}:cards`], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    if (!lsOutput) return [];

    const lines = lsOutput.split(/\r?\n/);
    for (const line of lines) {
      const match = /^[0-9]+\s+blob\s+([a-f0-9]+)\t(.+)$/.exec(line);
      if (match) {
        const blobSha = match[1]!;
        const rawJson = execFileSync('git', ['cat-file', '-p', blobSha], {
          cwd: repoRoot,
          encoding: 'utf8'
        });
        const parsed = JSON.parse(rawJson);
        cards.push(CardSchema.parse(parsed));
      }
    }
  } catch {
    // Ref doesn't exist or has no cards
    return [];
  }

  return cards;
}
