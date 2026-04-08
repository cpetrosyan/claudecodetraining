# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UIGen** — an AI-powered React component generator with live preview. Users chat with Claude to generate React components, which are rendered in a sandboxed iframe using a virtual (in-memory) file system.

## Commands

```bash
# Initial setup
npm run setup          # install deps + prisma generate + migrate

# Development
npm run dev            # Next.js dev server with Turbopack
npm run dev:daemon     # Background dev server (logs → logs.txt)

# Build & production
npm run build
npm start

# Linting
npm run lint           # ESLint (Next.js config)

# Testing
npm test               # Vitest (all tests)
npx vitest run <file>  # Single test file

# Database
npm run db:reset       # Reset and re-migrate SQLite DB
```

The dev server requires the `NODE_OPTIONS='--require ./node-compat.cjs'` prefix (already in package.json scripts) to load Node.js polyfills.

## Architecture

### Three-Panel UI

`src/app/main-content.tsx` renders a resizable split layout:
- **Left (35%):** Chat interface (`src/components/chat/`)
- **Right (65%):** Tabs for live preview (`PreviewFrame`) or code editor (file tree + Monaco)

### AI Generation Flow

1. User sends a prompt via `ChatContext` → POST to `src/app/api/chat/route.ts`
2. API route calls Anthropic Claude (`claude-haiku-4-5`) via Vercel AI SDK `streamText`
3. Claude uses two tools: `str_replace_editor` (file create/edit/view) and `file_manager` (directory ops)
4. Tool calls stream back; `ChatContext` applies them to `FileSystemContext`
5. On completion, the project state (messages + VFS) is serialized and saved to SQLite via Prisma
6. `PreviewFrame` renders the virtual files in an iframe by compiling JSX with Babel standalone

**Fallback:** If `ANTHROPIC_API_KEY` is absent, `src/lib/provider.ts` uses `MockLanguageModel`, which returns static counter/form/card component code.

### Virtual File System

`src/lib/file-system.ts` — `VirtualFileSystem` class maintains an in-memory tree. No disk writes occur. `src/lib/transform/jsx-transformer.ts` converts VFS contents into an import-mapped HTML document for iframe preview.

### State Management

- **`FileSystemContext`** (`src/lib/contexts/file-system-context.tsx`): owns the VFS, selected file, and applies AI tool-call results
- **`ChatContext`** (`src/lib/contexts/chat-context.tsx`): wraps Vercel AI SDK's `useChat`, dispatches tool-call updates to FileSystemContext

### Authentication

JWT sessions stored in httpOnly cookies (7-day expiry). `src/lib/auth.ts` handles create/get/delete/verify. `src/middleware.ts` protects API routes. Server actions in `src/actions/` handle sign-up, sign-in, and project CRUD. Anonymous users can still use the app without persistence.

### Database

Always refer to `prisma/schema.prisma` to understand the database structure. Prisma + SQLite. Two models: `User` (bcrypt-hashed password) and `Project` (stores messages and VFS as JSON strings).

### Key Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`). Generated components must use `@/` imports and Tailwind CSS for styling, with `/App.jsx` as the root entry point — this is enforced by the system prompt in `src/lib/prompts/generation.tsx`.

## Code Style

Comments: only on complex or non-obvious logic. Omit them everywhere else.

## Testing

Tests live alongside source in `__tests__/` directories. Vitest uses jsdom environment with `@testing-library/react`. Test files follow the pattern `*.test.tsx`.