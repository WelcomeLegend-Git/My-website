<p align="center">
  <h1 align="center">📚 JEE Study Companion</h1>
  <p align="center">
    An AI-powered progressive web application for JEE aspirants to master formulas, track mistakes, and accelerate exam preparation.
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/tRPC-2596BE?logo=trpc&logoColor=white" alt="tRPC" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Gemini_AI-8E75B2?logo=google&logoColor=white" alt="Gemini AI" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT" />
</p>

---

## Overview

JEE Study Companion is a full-stack web platform designed specifically for students preparing for the Joint Entrance Examination. It combines structured study tools with Gemini AI integration to provide a personalized, data-driven preparation experience.

### Key Features

| Feature | Description |
|---------|-------------|
| **Formula Library** | Organized by subject and chapter with LaTeX rendering, AI-generated mind maps, and multi-image attachments |
| **Mistake Tracker** | Log errors by type (conceptual, calculation, careless), track resolution status, and get AI-powered analysis |
| **Practice Quizzes** | Generate quizzes from your formula collections or logged mistakes for targeted revision |
| **AI Study Coach** | Contextual Gemini-powered assistant that explains formulas, identifies weak areas, and suggests study strategies |
| **Bookmarks** | Save and organize formulas, mistakes, quiz questions, and coach messages for quick reference |
| **Remote Bridge** | Real-time WebSocket connection to link a phone and tablet for cross-device study sessions |
| **PWA Support** | Installable on mobile devices for offline-capable access |

---

## Architecture

```mermaid
graph TB
    subgraph Client["Frontend — React + Vite"]
        UI[React UI]
        RR[React Router]
        TQ[tRPC Client + React Query]
        PWA[Service Worker — PWA]
    end

    subgraph Server["Backend — Express + tRPC"]
        API[tRPC Router Layer]
        AUTH[JWT Auth Middleware]
        SVC[Service Layer]
        AI[Gemini AI Service]
        WS[WebSocket — Remote Bridge]
    end

    subgraph Data["Data Layer"]
        ORM[Prisma ORM]
        DB[(Supabase PostgreSQL)]
        FS[Local File Storage]
    end

    UI --> RR --> TQ
    TQ -- "HTTP/JSON" --> API
    API --> AUTH --> SVC
    SVC --> AI
    SVC --> ORM --> DB
    SVC --> FS
    UI -- "WS" --> WS
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (strict mode, end-to-end) |
| **Frontend** | React 18, React Router, React Query, Vite |
| **Backend** | Node.js, Express, tRPC v11 |
| **Database** | PostgreSQL via Supabase |
| **ORM** | Prisma 5 with migrations |
| **AI** | Google Gemini API (multi-key rotation, model fallback) |
| **Auth** | JWT access + refresh token flow |
| **Real-time** | WebSocket (Remote Bridge) |
| **Monorepo** | npm Workspaces + Turborepo |
| **Deployment** | Render (backend) + Render Static (frontend) |

---

## Project Structure

```
jee-study-companion/
├── apps/
│   ├── server/                # Express + tRPC backend
│   │   ├── prisma/            # Schema, migrations, seed
│   │   └── src/
│   │       ├── auth/          # JWT strategy & middleware
│   │       ├── services/      # AI, email, Google Drive, Remote Bridge
│   │       ├── trpc/
│   │       │   └── routers/   # auth, formulas, mistakes, quiz, study, subjects, bookmarks, backup
│   │       └── storage/       # File upload handling
│   └── web/                   # React + Vite frontend
│       └── src/
│           ├── components/    # Shared UI components
│           ├── features/      # AI, formulas, mistakes, quiz, PWA
│           ├── hooks/         # Custom React hooks
│           ├── pages/         # Route-level page components
│           └── lib/           # tRPC client, utilities
├── packages/
│   └── shared/                # Shared types and domain models
├── render.yaml                # Infrastructure-as-code (Render)
├── turbo.json                 # Turborepo pipeline config
└── package.json               # Workspace root
```

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **npm** 10+
- A **Supabase** project (free tier works) or any PostgreSQL 15+ instance
- A **Google Gemini API** key

### 1. Clone and Install

```bash
git clone https://github.com/WelcomeLegend-Git/My-website.git
cd My-website
npm install
```

### 2. Configure Environment

```bash
cp apps/server/.env.example apps/server/.env
```

Edit `apps/server/.env` with your credentials:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
JWT_ACCESS_SECRET="replace-with-32-char-secret"
JWT_REFRESH_SECRET="replace-with-another-32-char-secret"
GEMINI_API_KEYS="your-gemini-api-key"
UPLOAD_DIR="./uploads"
```

### 3. Set Up the Database

```bash
cd apps/server
npx prisma generate
npx prisma db push
cd ../..
```

### 4. Run in Development

```bash
# Start backend (from repo root)
npm run dev --workspace=apps/server

# In a separate terminal, start frontend
npm run dev --workspace=apps/web
```

The backend runs on `http://localhost:4000` and the frontend on `http://localhost:5173`.

---

## Deployment

This project uses [Render](https://render.com) for production hosting. The `render.yaml` file defines the full infrastructure:

- **Backend** — Node.js web service (Singapore region)
- **Frontend** — Static site with SPA rewrite rules

To deploy, connect this repository to Render and it will auto-detect the `render.yaml` blueprint.

---

## API Architecture

The backend exposes a type-safe API via tRPC with the following routers:

| Router | Endpoints | Description |
|--------|-----------|-------------|
| `auth` | register, login, refresh, logout | JWT-based authentication flow |
| `subjects` | list, get | Physics, Chemistry, Mathematics with chapters |
| `formulas` | CRUD, collections, AI explain, AI mind-map | Formula management with AI enrichment |
| `mistakes` | CRUD, AI analyze, status transitions | Error tracking with AI-powered insights |
| `quiz` | generate, submit, history, from-mistakes | Adaptive quiz engine |
| `study` | coach chat, session management | Gemini-powered study assistant |
| `bookmarks` | CRUD, list by entity type | Cross-entity bookmarking system |
| `backup` | export, import | Google Drive backup integration |

---

## Testing

```bash
# Run all tests
npm run test

# Run backend tests only
npm run test --workspace=apps/server

# Lint all workspaces
npm run lint

# Type-check all workspaces
npm run typecheck
```

---

## License

This project is licensed under the [MIT License](LICENSE).