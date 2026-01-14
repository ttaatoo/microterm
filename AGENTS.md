# AGENTS Playbook for microterm repository

This document defines how automated agents (Explore, Librarian, Frontend-UX, Document Writer, Code-Reviewer, Oracle, etc.) should operate within this repository. It codifies build/test conventions, code style expectations, and the orchestration rules that guide multi-task operations.

## Core Operator Principles
- Act as a cooperative team: use the right specialized agent for each task; parallelize where possible; avoid blocking IO.
- Always prefer existing patterns and tooling in the codebase. When unsure, ask clarifying questions before acting.
- Maintain codebase discipline: do not introduce risky refactors; fix minimally; run validations where available.
- Document every non-trivial action you take using the appropriate agent outputs and validation steps.

## Phase Model (Agent Workflow)
- Phase 0: Intent Gate
  - Detect the task type and relevant agents. If a skill matches, invoke it immediately (see Section: Agent Roles).
- Phase 1: Codebase Assessment (Open-ended tasks)
  - Do a quick assessment of the repo patterns, dependencies, and tests to determine the best approach.
  - If architecture or multi-system concerns appear, consult Oracle early.
- Phase 2: Implementation (multistep tasks)
  - Break the work into atomic tasks using a Todo list. Mark tasks as in_progress before starting; complete them individually.
  - Use parallel exploration where possible; collect results via background outputs.
- Phase 3: Completion
  - Validate diagnostics, tests, and build; confirm all todos completed; summarize outcomes.

> Note: Your default stance is to propose, plan, and then execute only when the user explicitly asks you to implement something. Use this document as the reference for automation tasks.

## Agent Roles and Responsibilities
- Explore (contextual grep): Find code structure, patterns, and patterns across the repo. Can be run in background and in parallel.
- Librarian (reference grep): Seek external docs, library usage, and best practices. Use for unfamiliar libraries or frameworks.
- Frontend-UX Engineer: Delegated UI/UX visual changes and components. Only visual changes — do not touch non-visual logic.
- Document Writer: Create/read/update docs, READMEs, API docs, and architecture docs.
- Code-Reviewer: Review code for quality, security, performance, and stability; provide feedback and suggested improvements.
- Oracle: Provide high-signal guidance for architecture decisions or problem domains that require expert reasoning.
- Pr-Toolkit: Assist with PR composition, changelogs, and release notes (if available).

## Task Lifecycle & Todo Management
- For non-trivial tasks (2+ steps), ALWAYS create a detailed Todo list BEFORE starting.
- State machine for tasks: pending -> in_progress -> completed or cancelled.
- Only ONE task should be in_progress at a time. Complete each task before moving on to the next.
- Before starting each task, update its in_progress status. After finishing, mark completed.
- If scope changes, update the todo entries accordingly.

## Build, Lint, Test – Local Commands (common aliases)
- Install dependencies: bun install
- Frontend dev: bun run dev
- Frontend production build: bun run build
- Full desktop dev: bun run tauri dev
- Desktop build: bun run tauri build
- Rust tests: (cd src-tauri) cargo test
- TypeScript lint: bun run lint
- TypeScript tests (Vitest): bun run test or bun run test:run
- Full test coverage: bun run test:coverage

### Running a Single Test (Vitest with Bun)
- File-scoped test: bun test path/to/file.test.ts
- Run a specific test by name: bun test path/to/file.test.ts -t "should do something"
- Run tests by name pattern: bun test -t "^init" or bun test -- -t "init" --glob

## Code Style Guidelines (TypeScript/React and Rust)
- General: follow ESLint + Prettier defaults for TS, with project-specific overrides if present.
- Imports: Group external modules first, then internal modules; consistent ordering; avoid alias collisions.
- Formatting: Use Prettier; adhere to 2-space indentation and semicolon usage consistent with the project.
- Types: Prefer explicit types; avoid any; use unknown if you must bypass type checks temporarily; never use as any in production paths.
- Naming:
  - Functions and variables: camelCase
  - React components: PascalCase
  - Interfaces/types: PascalCase prefixed with I or exported types named clearly
- Error handling: Do not swallow errors. Use try/catch with contextual messages. Do not use empty catch blocks.
- Async/Promises: Always handle rejections; use proper await error propagation.
- Testing: Write tests for new features; strive for coverage; avoid flaky tests.
- Security: Do not commit secrets; use envs; never hardcode credentials.
- Accessibility: For UI changes, ensure aria labels and keyboard navigation when applicable.
- Documentation: Every non-trivial function or module should have JSDoc-style comments.

## Git & PR Hygiene (Conventional Commits)
- Use conventional commits: feat:, fix:, docs:, style:, refactor:, perf:, test:, build:, ci:, chore:
- Include a concise subject in imperative mood; optional body with rationale; optional breaking changes note in footer.
- When there are multiple related changes, break into logical commits.
- PR descriptions should explain the user-facing impact and testing performed.

## Cursor Rules & Copilot Guidance
- Cursor rules: The repository includes Cursor rules at .cursor/rules/commit-message.mdc. Follow them for commit messages when you perform commits.
- Copilot: If you enable Copilot rules in this repo (see .github/copilot-instructions.md), adhere to those constraints as well. (File not found in this repo snapshot; create or adjust if present.)

## Validation & Evidence (Post-change)
- Diagnostics: Run lsp_diagnostics on changed files.
- Build: Ensure build completes with exit code 0.
- Tests: Ensure tests pass; note any pre-existing failures.
- Documentation: Ensure docs reflect changes where applicable.

## Cursor and Copilot References
- Cursor commit rule path: .cursor/rules/commit-message.mdc
- Copilot instructions path (if present): .github/copilot-instructions.md

## Example Sections to Update
- If you modify build/test commands in package.json, reflect in this AGENTS.md.
- If new agents or roles are added, append to the Agent Roles section and describe triggers.

## Versioning & History
- AGENTS.md is a living document. Update with major workflow changes and arch decisions.

