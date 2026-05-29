# Recipe Companion Frontend

Frontend for the Recipe Companion coding challenge. It is a Next.js app that lets a user upload a recipe, renders the structured recipe returned by the backend, and opens a CopilotKit chat sidebar connected to the recipe agent.

The backend is expected to run separately on `http://localhost:8000`.

## Requirements

- Node.js 20+
- npm
- Backend running on port `8000`

Install dependencies from this directory:

```bash
npm install
```

## Running Locally

Start the backend first:

```bash
cd ../backend
uv sync
uv run uvicorn src.main:app --reload --port 8000
```

Then start the frontend:

```bash
cd ../frontend
npm run dev
```

Open `http://localhost:3000`.

## Running with Docker

From the repo root, create `.env` for the backend service:

```env
LLM_MODEL=gemini-2.0-flash
GEMINI_API_KEY=your_key_here
```

Then build and run the full app:

```bash
docker compose up --build
```

Open `http://localhost:3000`.

To build or run only the frontend service:

```bash
docker compose build frontend
docker compose up frontend
```

The Docker Compose frontend service sets `BACKEND_URL=http://backend:8000` so the Next.js CopilotKit API route can reach the backend container. Browser uploads still use `http://localhost:8000/upload`, which is exposed by the backend service.

## Useful Commands

```bash
npm run dev          # Start the Next.js development server
npm run build        # Build for production
npm run start        # Start the production server after building
npm test             # Run Jest tests
npm run test:watch   # Run Jest in watch mode
npm run lint         # Run Biome checks
npm run format       # Format with Biome
```

## Mock Upload Mode

Uploads normally call the backend `POST /upload` endpoint.

For frontend-only work, set:

```bash
NEXT_PUBLIC_MOCK_UPLOAD=true
```

When enabled, `src/lib/api/upload.ts` returns a mock upload response from `src/lib/mockUpload.ts` instead of calling the backend. This is useful for UI development and tests that do not need the Python service.

## Architecture

### App Shell

`src/app/page.tsx` is the main client-side page. It wraps the app in:

- `QueryClientProvider` for React Query mutations.
- `RecipeContextProvider` for shared recipe, upload, thread and error state.

The visible app is composed from:

- `FileUpload` for selecting and submitting `.txt` or `.pdf` recipes.
- `RecipeDetails` for rendering the parsed recipe.
- `ChatWrapper` for the CopilotKit chat sidebar.

### Upload Flow

`src/components/FileUpload.tsx` owns the upload form. It uses React Query's `useMutation` to call `upload()` in `src/lib/api/upload.ts`.

On success, the upload response is written into `RecipeContext`:

- `threadId`
- `runId`
- `state`

The backend response state is the initial `RecipeAgentState`. Once this exists, the recipe view and chat can render.

### Shared State

`src/lib/RecipeContext.tsx` stores the current frontend session:

- `pending`
- `error`
- `threadId`
- `runId`
- `state`

The `state` value follows the TypeScript types in `src/types/recipe.ts`, which mirror the backend recipe context model.

The UI reacts to this state directly. Agent messages are not parsed for recipe updates.

### Recipe View

`src/components/RecipeDetails.tsx` reads `context.state.recipe` and renders the title, tags, description, timings, servings, ingredients and steps.

When the agent changes recipe state, this component re-renders from the updated context.

### Chat and Agent Wiring

`src/components/Chat.tsx` mounts CopilotKit only after a successful upload, because it needs both:

- `threadId`
- initial recipe `state`

`ChatSidebar` uses CopilotKit's `useAgent()` with the backend agent id:

```ts
recipe_agent
```

It seeds the agent with the upload state, assigns the `threadId`, and subscribes to `OnStateChanged` updates. Valid agent state changes are written back into `RecipeContext`.

### CopilotKit Runtime Route

`src/app/api/copilotkit/[[...slug]]/route.ts` defines the local Next.js API route used by the browser:

```text
/api/copilotkit
```

That route creates a CopilotKit runtime with an `HttpAgent` that forwards agent traffic to the backend:

```text
http://localhost:8000/copilotkit
```

Set `BACKEND_URL` to override this in server-side environments. Docker Compose sets it to `http://backend:8000`.

This keeps the browser pointed at the Next app while the runtime proxies AG-UI traffic to the Python service.

## Backend Contract

The frontend depends on these backend endpoints:

- `POST http://localhost:8000/upload`
- `POST http://localhost:8000/copilotkit`

The expected backend agent name is:

```text
recipe_agent
```

The backend owns recipe extraction and agent tools such as scaling servings, substituting ingredients and updating cooking progress. The frontend displays the resulting state.

## Testing

Tests live next to the code they cover:

- `src/components/*.test.tsx`
- `src/lib/*.test.tsx`
- `src/lib/api/*.test.ts`

Run them with:

```bash
npm test
```

The test environment is Jest with jsdom and React Testing Library.
