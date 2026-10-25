import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export * from './goldenCards.js';

export type FixtureName = 'nextjs' | 'fastapi' | 'springboot';

/**
 * Returns the absolute directory path of a synthetic test fixture repository.
 */
export function getFixturePath(name: FixtureName): string {
  const devPath = path.resolve(__dirname, '../repos', name);
  const srcPath = path.resolve(__dirname, 'repos', name);
  return fs.existsSync(devPath) ? devPath : srcPath;
}
