import type { Card } from '@orient/schema';

export const nextjsGoldenCard: Card = {
  id: 'fixture-nextjs:repo',
  level: 'repo',
  path: '',
  version: 1,
  state: 'Fresh',
  derived: {
    fileCount: 4,
    loc: 180,
    languages: ['typescript'],
    keyFiles: [
      { path: 'app/api/auth/route.ts', reason: 'Primary authentication API route' },
      { path: 'lib/auth.ts', reason: 'Highest import centrality' }
    ],
    dependsOn: [],
    usedBy: [],
    surface: {
      routes: [
        { method: 'GET', path: '/api/auth', handlerRef: 'app/api/auth/route.ts' },
        { method: 'POST', path: '/api/auth', handlerRef: 'app/api/auth/route.ts' }
      ],
      exports: ['GET', 'POST', 'verifyAuthSession'],
      envVars: ['AUTH_SECRET', 'NEXTAUTH_URL'],
      tables: ['users', 'accounts'],
      ports: [3000]
    },
    tests: {
      present: true,
      paths: ['tests/auth.test.ts'],
      command: 'pnpm test'
    },
    health: {
      lastChanged: '2026-10-25T14:00:00Z',
      todoCount: 0,
      hasTests: true
    }
  },
  authored: {
    purpose: 'Next.js App Router e-commerce web application with edge auth and product catalog.',
    role: 'entrypoint',
    why: 'Demonstrates modern React Server Components and route handler conventions.',
    oneThing: 'API routes execute under edge runtime; client components must use use client.',
    conventions: [
      'Route handlers export HTTP verb uppercase functions (GET, POST)',
      'Shared logic isolated in lib/'
    ],
    doNot: [
      'Do not import server-only code into client components',
      'Never expose AUTH_SECRET in client bundles'
    ],
    decisions: [
      {
        choice: 'Next.js App Router with Server Components',
        alternatives: ['Pages Router'],
        reason: 'Improved data streaming and layout caching'
      }
    ],
    representativeFile: {
      path: 'app/api/auth/route.ts',
      snippetRange: [1, 20]
    },
    contrast: 'Uses App Router instead of Pages Router'
  },
  meta: {
    source: 'agent-reported',
    agent: {
      name: 'Claude Code',
      sessionId: 'sess_nextjs_fixture',
      color: '#E07A5F'
    },
    confidence: 'high',
    evidence: [
      { kind: 'file', ref: 'package.json', note: 'next dependency detected' },
      { kind: 'route', ref: '/api/auth', note: 'Next.js route handler' }
    ],
    anchor: {
      commit: '1111222233334444555566667777888899990000',
      tree: 'tree_nextjs_root',
      interface: 'iface_nextjs_root'
    },
    pinned: false,
    createdAt: '2026-10-25T12:00:00Z',
    updatedAt: '2026-10-25T14:00:00Z'
  }
};

export const fastapiGoldenCard: Card = {
  id: 'fixture-fastapi:repo',
  level: 'repo',
  path: '',
  version: 1,
  state: 'Fresh',
  derived: {
    fileCount: 4,
    loc: 140,
    languages: ['python'],
    keyFiles: [
      { path: 'app/main.py', reason: 'FastAPI application factory' },
      { path: 'app/routers/items.py', reason: 'CRUD route definitions' }
    ],
    dependsOn: [],
    usedBy: [],
    surface: {
      routes: [
        { method: 'GET', path: '/items', handlerRef: 'app/routers/items.py' },
        { method: 'POST', path: '/items', handlerRef: 'app/routers/items.py' }
      ],
      exports: ['app', 'ItemModel'],
      envVars: ['DATABASE_URL'],
      tables: ['items'],
      ports: [8000]
    },
    tests: {
      present: true,
      paths: ['tests/test_items.py'],
      command: 'pytest'
    },
    health: {
      lastChanged: '2026-10-25T13:00:00Z',
      todoCount: 0,
      hasTests: true
    }
  },
  authored: {
    purpose: 'FastAPI asynchronous REST service for catalog inventory management.',
    role: 'entrypoint',
    why: 'Demonstrates async Python route handling with Pydantic v2 schemas.',
    oneThing: 'Always use async def for I/O bound endpoints calling database pools.',
    conventions: [
      'Routers mounted via APIRouter in app/routers/',
      'Pydantic schemas in app/models.py'
    ],
    doNot: [
      'Do not execute blocking synchronous requests inside async route handlers'
    ],
    decisions: [
      {
        choice: 'Pydantic v2 with SQLModel',
        reason: 'Unified validation and ORM declarations'
      }
    ],
    representativeFile: {
      path: 'app/main.py',
      snippetRange: [1, 15]
    }
  },
  meta: {
    source: 'agent-reported',
    agent: {
      name: 'Cursor',
      sessionId: 'sess_fastapi_fixture',
      color: '#3D9970'
    },
    confidence: 'high',
    evidence: [
      { kind: 'file', ref: 'pyproject.toml', note: 'fastapi dependency' },
      { kind: 'route', ref: 'GET /items', note: 'FastAPI router decorator' }
    ],
    anchor: {
      commit: '2222333344445555666677778888999900001111',
      tree: 'tree_fastapi_root',
      interface: 'iface_fastapi_root'
    },
    pinned: false,
    createdAt: '2026-10-25T11:00:00Z',
    updatedAt: '2026-10-25T13:00:00Z'
  }
};

export const springbootGoldenCard: Card = {
  id: 'fixture-springboot:repo',
  level: 'repo',
  path: '',
  version: 1,
  state: 'Fresh',
  derived: {
    fileCount: 3,
    loc: 210,
    languages: ['java'],
    keyFiles: [
      { path: 'src/main/java/com/example/demo/Application.java', reason: 'Spring Boot Main entrypoint' },
      { path: 'src/main/java/com/example/demo/controller/UserController.java', reason: 'REST Controller' }
    ],
    dependsOn: [],
    usedBy: [],
    surface: {
      routes: [
        { method: 'GET', path: '/users', handlerRef: 'UserController.java' }
      ],
      exports: ['Application', 'UserController'],
      envVars: ['SERVER_PORT'],
      tables: ['users'],
      ports: [8080]
    },
    tests: {
      present: true,
      paths: ['src/test/java/com/example/demo/ApplicationTests.java'],
      command: './mvnw test'
    },
    health: {
      lastChanged: '2026-10-25T10:00:00Z',
      todoCount: 0,
      hasTests: true
    }
  },
  authored: {
    purpose: 'Spring Boot 3 enterprise user microservice with Spring Security and JPA.',
    role: 'entrypoint',
    why: 'Demonstrates enterprise Java architecture with layered controllers and services.',
    oneThing: 'Keep controller methods lightweight and delegate business logic to services.',
    conventions: [
      'Controllers annotated with @RestController',
      'Services use constructor injection with final fields'
    ],
    doNot: [
      'Do not use field @Autowired injection'
    ],
    decisions: [
      {
        choice: 'Spring Boot 3 with Java 21 Virtual Threads',
        reason: 'High throughput concurrency with simplified blocking paradigms'
      }
    ]
  },
  meta: {
    source: 'generated',
    confidence: 'high',
    evidence: [
      { kind: 'file', ref: 'pom.xml', note: 'spring-boot-starter-web' }
    ],
    anchor: {
      commit: '3333444455556666777788889999000011112222',
      tree: 'tree_springboot_root',
      interface: 'iface_springboot_root'
    },
    pinned: false,
    createdAt: '2026-10-25T09:00:00Z',
    updatedAt: '2026-10-25T10:00:00Z'
  }
};
