import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getFixturePath } from '@orient/fixtures';
import { extractPythonFacts } from '../index.js';

describe('Python Language Extractor (SPRINT-2.3)', () => {
  it('extracts imports from standard and relative from/import statements', () => {
    const code = `
import os
import sys, time
from fastapi import FastAPI, Depends, HTTPException
from .routers.items import router as items_router
from ..models import ItemModel
`;

    const facts = extractPythonFacts(code, 'app/main.py');
    expect(facts.language).toBe('python');

    const sources = facts.imports.map((i) => i.source);
    expect(sources).toContain('os');
    expect(sources).toContain('sys');
    expect(sources).toContain('time');
    expect(sources).toContain('fastapi');
    expect(sources).toContain('.routers.items');
    expect(sources).toContain('..models');

    const fastapiImport = facts.imports.find((i) => i.source === 'fastapi');
    expect(fastapiImport?.specifiers).toContain('FastAPI');
    expect(fastapiImport?.specifiers).toContain('Depends');
    expect(fastapiImport?.specifiers).toContain('HTTPException');

    const itemsImport = facts.imports.find((i) => i.source === '.routers.items');
    expect(itemsImport?.specifiers).toContain('items_router');
  });

  it('extracts top-level function, class, and variable declarations', () => {
    const code = `
class UserService:
    def __init__(self):
        pass

    def get_user(self, user_id: int):
        return None

def verify_token(token: str) -> bool:
    return True

async def fetch_remote_profile():
    pass

API_VERSION = "v1"
DB_TIMEOUT = 30
`;

    const facts = extractPythonFacts(code, 'app/services.py');
    const symbolNames = facts.exports.map((e) => e.name);

    expect(symbolNames).toContain('UserService');
    expect(symbolNames).toContain('verify_token');
    expect(symbolNames).toContain('fetch_remote_profile');
    expect(symbolNames).toContain('API_VERSION');
    expect(symbolNames).toContain('DB_TIMEOUT');

    // Nested method __init__ and get_user should not be treated as top-level exports
    expect(symbolNames).not.toContain('__init__');
    expect(symbolNames).not.toContain('get_user');

    const cls = facts.exports.find((e) => e.name === 'UserService');
    expect(cls?.kind).toBe('class');

    const fn = facts.exports.find((e) => e.name === 'verify_token');
    expect(fn?.kind).toBe('function');
  });

  it('extracts FastAPI and Flask route decorators', () => {
    const code = `
@app.get("/health")
async def health():
    return {"status": "ok"}

@router.post("/items")
async def create_item():
    return {}

@app.delete("/items/{item_id}")
def delete_item(item_id: int):
    pass

@api.route("/login", methods=["POST", "GET"])
def login():
    pass
`;

    const facts = extractPythonFacts(code, 'app/main.py');
    expect(facts.routes.length).toBeGreaterThanOrEqual(4);

    expect(facts.routes).toContainEqual({
      method: 'GET',
      path: '/health',
      handlerRef: 'app/main.py'
    });
    expect(facts.routes).toContainEqual({
      method: 'POST',
      path: '/items',
      handlerRef: 'app/main.py'
    });
    expect(facts.routes).toContainEqual({
      method: 'DELETE',
      path: '/items/{item_id}',
      handlerRef: 'app/main.py'
    });
    // Flask methods array
    expect(facts.routes).toContainEqual({
      method: 'POST',
      path: '/login',
      handlerRef: 'app/main.py'
    });
    expect(facts.routes).toContainEqual({
      method: 'GET',
      path: '/login',
      handlerRef: 'app/main.py'
    });
  });

  it('extracts environment variables and port bindings', () => {
    const code = `
# TODO: configure database connection pooling
# FIXME: handle token refresh expiration
db_url = os.environ["DATABASE_URL"]
secret = os.environ.get('SECRET_KEY', 'default_secret')
timeout = os.getenv("REQUEST_TIMEOUT", "60")
PORT = 8000

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
`;

    const facts = extractPythonFacts(code, 'app/main.py');
    expect(facts.envVars).toContain('DATABASE_URL');
    expect(facts.envVars).toContain('SECRET_KEY');
    expect(facts.envVars).toContain('REQUEST_TIMEOUT');
    expect(facts.ports).toContain(8000);
    expect(facts.todoCount).toBe(2);
    expect(facts.loc).toBeGreaterThan(5);
  });

  it('extracts facts directly from real FastAPI fixture repository files', () => {
    const root = getFixturePath('fastapi');
    const mainPy = path.join(root, 'app/main.py');
    const content = fs.readFileSync(mainPy, 'utf8');

    const facts = extractPythonFacts(content, 'app/main.py');
    expect(facts.routes).toContainEqual({
      method: 'GET',
      path: '/health',
      handlerRef: 'app/main.py'
    });
    expect(facts.exports.map((e) => e.name)).toContain('health_check');
  });
});
