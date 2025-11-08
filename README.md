# JEE Study Companion

A progressive web application designed to help JEE aspirants manage formulas, track mistakes, and receive AI-assisted study guidance.

## Monorepo Structure

- `apps/server` – Express + tRPC backend with Prisma ORM and Gemini AI integration.
- `apps/web` – React frontend (to be implemented) with PWA capabilities.
- `packages/shared` – Shared domain models and utilities.

## Prerequisites

- Node.js 20+
- npm 10+
- MySQL 8 (or compatible) database

## Environment Variables

Create a `.env` file at the repository root:

```env
DATABASE_URL="mysql://user:password@localhost:3306/jee_study"
JWT_ACCESS_SECRET="<32+ character secret>"
JWT_REFRESH_SECRET="<32+ character secret>"
GEMINI_API_KEYS="key1,key2,key3"
GEMINI_MODEL_PRIMARY="models/gemini-2.0-pro-exp"
GEMINI_MODEL_FALLBACK="models/gemini-1.5-pro,models/gemini-1.5-flash"
UPLOAD_DIR="./uploads"
```

## Useful Commands

Run from repo root unless stated otherwise:

```bash
npm install           # Install dependencies
npm run lint          # Lint across workspaces via Turborepo
npm run typecheck     # Type-check all packages
npm run test          # Run tests (currently backend)
npm run dev --workdir apps/server   # Start backend in watch mode
```

## Features

- Secure authentication with JWT access & refresh tokens
- Auto-provisioned Physics, Chemistry, Mathematics subjects and key chapters for new users
- Formula library with AI-generated mind maps and attachments
- Mistake tracker with AI analysis and status transitions
- Study utilities: formula explanation, quiz generation, contextual AI assistant
- File uploads persisted locally under `UPLOAD_DIR`

Frontend implementation and PWA enhancements are upcoming.