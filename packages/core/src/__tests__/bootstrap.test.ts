import { describe, it, expect } from 'vitest';
import { CardSchema } from '@orient/schema';
import { generateBootstrapPrompt, parseAgentCardResponse, GOLDEN_EXAMPLE_CARD } from '../bootstrap.js';

describe('Cold Start Bootstrap Prompt Generator (SPRINT-5.1)', () => {
  const sampleContext = {
    repoName: 'acme-commerce',
    folders: ['src/auth', 'src/billing', 'packages/ui', 'scripts'],
    detectedStack: ['TypeScript', 'Fastify', 'PostgreSQL', 'Tailwind'],
    entryPoints: ['src/server.ts'],
    ports: [4477, 8080]
  };

  it('generates a copyable bootstrap prompt with required schema specifications', () => {
    const prompt = generateBootstrapPrompt(sampleContext);

    expect(prompt).toContain('acme-commerce');
    expect(prompt).toContain('src/auth');
    expect(prompt).toContain('src/billing');
    expect(prompt).toContain('packages/ui');
    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('Fastify');

    // Must specify hard constraints
    expect(prompt).toContain('140 characters');
    expect(prompt).toContain('200 characters');
    expect(prompt).toContain('role');
    expect(prompt).toContain('.project/cards/');

    // Must explain submission options (file write or MCP report)
    expect(prompt).toContain('report');
  });

  it('embeds a valid golden example card that parses cleanly with CardSchema', () => {
    const prompt = generateBootstrapPrompt(sampleContext);

    // Extract JSON example from prompt
    const match = prompt.match(/```json\s*([\s\S]*?)\s*```/);
    expect(match).not.toBeNull();
    const jsonStr = match?.[1] || '';

    const parsed = JSON.parse(jsonStr);
    const cardParse = CardSchema.safeParse(parsed);
    expect(cardParse.success).toBe(true);
  });

  it('parses agent markdown response containing single or multiple JSON card blocks', () => {
    const agentResponse = `
Here are the bootstrap cards for your top-level directories:

\`\`\`json
${JSON.stringify(GOLDEN_EXAMPLE_CARD, null, 2)}
\`\`\`

All directories have been analyzed according to the repository architecture.
`;

    const result = parseAgentCardResponse(agentResponse);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]!.path).toBe('src/auth');
    expect(result.cards[0]!.authored.role).toBe('routes');
    expect(result.errors).toHaveLength(0);
  });

  it('gracefully captures errors when agent returns invalid card JSON', () => {
    const invalidResponse = `
\`\`\`json
{
  "path": "src/broken",
  "role": "non-existent-role",
  "purpose": "A very long purpose that exceeds the limit "
}
\`\`\`
`;

    const result = parseAgentCardResponse(invalidResponse);
    expect(result.cards).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
