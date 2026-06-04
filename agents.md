# AGENTS.md

Context for AI coding assistants (Claude Code, Codex, Cursor, Copilot) working in this repo.

## What this repo is

A coding challenge. The candidate is building a **frontend** that talks to the Python backend in `backend/`. The backend is done and should not be changed unless the user asks. Your job is to help build the frontend, not to refactor the backend.

The app is a cooking companion. A user uploads a recipe file, sees the parsed recipe, and chats with an agent that can scale servings, substitute ingredients and update cooking progress.

## Layout

```text
.
├── README.md            # The challenge brief
├── agents.md            # Repo-wide assistant instructions
├── backend/             # FastAPI + pydantic-ai. Done. Don't touch unless asked.
│   ├── README.md        # Endpoints, state model, agent tools, env vars
│   ├── src/
│   │   ├── main.py      # FastAPI app: /upload, /copilotkit (AG-UI mount), /health
│   │   ├── agents.py    # pydantic-ai agents + tools (scale, substitute, progress)
│   │   └── models.py    # Pydantic types (Recipe, RecipeContext, ...)
│   └── tests/
├── frontend/            # Next.js frontend
│   ├── README.md        # Frontend setup and architecture
│   ├── src/app/         # App Router pages and API routes
│   ├── src/components/  # UI components
│   ├── src/lib/         # Context, API helpers and mocks
│   └── src/types/       # Frontend TypeScript types
├── docker-compose.yml
└── data/                # Sample recipes
```

## Product and UX context

Target UX is a tablet in a kitchen:

- Touch-first controls.
- Readable at arm's length.
- Landscape tablet is the primary viewport.
- Keep interactions simple and glanceable.

Dense desktop-style UI is the wrong default. The cook may be holding utensils or glancing from a worktop.

## Stack

Backend:

- Python 3.11+
- `uv`
- FastAPI
- pydantic-ai
- AG-UI protocol
- Runs on port `8000`

Frontend:

- Next.js 16 App Router
- React 19
- TypeScript
- CopilotKit
- React Query
- Tailwind CSS
- FlyonUI
- Jest + React Testing Library
- Biome for linting and formatting
- Runs on port `3000`

## Frontend Next.js warning

This is not the Next.js you may know from older training data. This version has breaking changes in APIs, conventions and file structure. Before changing Next-specific code, read the relevant guide in `frontend/node_modules/next/dist/docs/` when available. Heed deprecation notices.

## Commands

Backend commands, run from `backend/`:

```bash
uv sync --extra test
uv run uvicorn src.main:app --reload --port 8000
make test              # all tests
make test-unit         # fast, no API calls
make test-integration  # hits real LLM, needs a key
make lint              # ruff check
make format            # ruff format
```

Frontend commands, run from `frontend/`:

```bash
npm install
npm run dev
npm run build
npm test
npm run lint
npm run format
```

Full stack backend only:

```bash
docker-compose up backend
```

## Frontend architecture

- `frontend/src/app/page.tsx` is the main client page.
- `frontend/src/app/api/copilotkit/[[...slug]]/route.ts` proxies CopilotKit runtime calls to `http://localhost:8000/copilotkit`.
- `frontend/src/components/FileUpload.tsx` handles file selection and upload mutation.
- `frontend/src/components/RecipeDetails.tsx` renders the parsed recipe.
- `frontend/src/components/Chat.tsx` mounts CopilotKit and subscribes to agent state changes.
- `frontend/src/lib/RecipeContext.tsx` stores frontend session state.
- `frontend/src/lib/api/upload.ts` contains the upload API call and mock upload switch.
- `frontend/src/types/recipe.ts` mirrors the backend recipe state shape.

## Frontend mock mode

Uploads normally call `POST http://localhost:8000/upload`.

For frontend-only work, use:

```bash
NEXT_PUBLIC_MOCK_UPLOAD=true
```

This makes `frontend/src/lib/api/upload.ts` return mock data from `frontend/src/lib/mockUpload.ts`.

## Backend contract

The frontend depends on these backend endpoints:

- `POST http://localhost:8000/upload`
- `POST http://localhost:8000/copilotkit`

`POST /upload` returns `threadId`, `runId` and initial recipe state.

The expected backend agent name is:

```text
recipe_agent
```

Backend tools:

- `scale_recipe`
- `substitute_ingredient`
- `update_cooking_progress`

State shape in `backend/src/models.py` is the source of truth. Keep `frontend/src/types/recipe.ts` aligned when state types change.

See `backend/README.md` for examples and payload shapes. OpenAPI is at `http://localhost:8000/docs` when the backend is running.

## State rules

The backend owns recipe extraction and agent behaviour.

The agent changes state through tool calls that return `StateSnapshotEvent`. The frontend should react to structured state updates. Do not parse chat content for recipe changes.

Important frontend state comes from:

- `POST /upload`, which returns `threadId`, `runId` and initial `state`.
- CopilotKit agent state updates from `recipe_agent`.

## Testing guidance

Backend tests live in `backend/tests/`.

Frontend tests live next to the code they cover:

- `frontend/src/components/*.test.tsx`
- `frontend/src/lib/*.test.tsx`
- `frontend/src/lib/api/*.test.ts`

When changing behaviour, add or update focused tests. Prefer testing user-visible behaviour and state transitions over implementation details.

For broad frontend UI or runtime changes, run:

```bash
npm test
npm run lint
npm run build
```

Do not run backend integration tests in a loop. They hit real LLM APIs, cost money on OpenAI and burn Gemini free-tier quota.

## Conventions

- **Python:** ruff for lint and format. British English in comments and docs where it matters.
- **Frontend:** Biome for lint and format. Keep component changes focused.
- **Env:** `LLM_MODEL` prefix picks the provider. `gpt-*`, `o1`, `o3`, `o4` use OpenAI. `gemini-*` uses Google. Adding a new provider means extending `build_model()` in `backend/src/agents.py`.
- **State mutation:** The frontend reacts to backend and CopilotKit state. It should not infer state by parsing chat text.
- **Commits:** Small, real messages. The candidate's git history is reviewed.

## Gotchas

- `starlette` is pinned `<1.0` in `backend/pyproject.toml`. Starlette 1.0 dropped `on_startup`/`on_shutdown`, which pydantic-ai's AG-UI app still uses. Do not remove the pin unless pydantic-ai has fixed it.
- `load_dotenv()` looks at the current working directory. The repo's `.env` lives at the root for Docker; the backend process expects one inside `backend/` when run directly.
- `.env` values must **not** be quoted. python-dotenv strips quotes, `docker-compose`'s `env_file` does not. `LLM_MODEL="gpt-4o"` works locally, breaks in Docker.
- The backend hardcodes model selection via `build_model()`. Do not reintroduce `GoogleModel(MODEL_NAME)` directly. It breaks OpenAI configurations.

## Out of scope

- Do not refactor the backend unless asked.
- Do not upgrade dependencies unless asked.
- Do not introduce new frontend dependencies unless the user asks or the benefit is clear.
- Do not add feature flags, abstraction layers or future-proofing. This is a challenge, not a product.
- Do not commit generated build output.

## Style

- Direct, short sentences.
- British spelling.
- No emojis unless the user asks.
- No motivational fluff. State the fact, move on.
