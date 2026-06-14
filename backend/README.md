# Backend

FastAPI + pydantic-ai. Parses recipes from uploaded files and runs a cooking agent over AG-UI / CopilotKit.

You don't need to change anything here to build the frontend. Read this to know what to call and what comes back.

## Run it

```bash
uv sync --extra test
cp .env.example .env   # or create one, see below
uv run uvicorn src.main:app --reload --port 8000
```

OpenAPI at http://localhost:8000/docs.

## Run it with Docker

From the repo root, create `.env` for Docker Compose:

```env
LLM_MODEL=gemini-2.0-flash
GEMINI_API_KEY=...
```

Then run the backend container:

```bash
docker compose up --build backend
```

To run the backend with the frontend container:

```bash
docker compose up --build
```

The backend is available at http://localhost:8000. The frontend is available at http://localhost:3000 when the full app is running.

### .env

Pick one provider. The model is chosen by the `LLM_MODEL` prefix (`gpt-*`, `o1`, `o3`, `o4` → OpenAI; `gemini-*` → Google).

```env
# Option A — Gemini (free tier works)
LLM_MODEL=gemini-2.0-flash
GEMINI_API_KEY=...

# Option B — OpenAI
LLM_MODEL=gpt-4o
OPENAI_API_KEY=...
```

Get a Gemini key at https://aistudio.google.com/apikey.

**Don't quote the values.** python-dotenv strips quotes but `docker-compose`'s `env_file` does not, so `LLM_MODEL="gpt-4o"` ends up as the literal string `"gpt-4o"` inside the container and breaks model routing.

## Endpoints

### `POST /upload`

Upload a PDF or plain text file. The backend extracts text, parses it into a `Recipe`, and returns the initial agent state.

```bash
curl -F "file=@recipe.pdf" http://localhost:8000/upload
```

Response:

```json
{
  "threadId": "uuid",
  "runId": "uuid",
  "state": {
    "document_text": "...",
    "recipe": { "title": "...", "ingredients": [...], "steps": [...] },
    "current_step": 0,
    "scaled_servings": null,
    "checked_ingredients": [],
    "cooking_started": false
  },
  "tools": [],
  "context": [],
  "forwardedProps": {},
  "messages": []
}
```

Store `threadId` and feed `state` into `useCoAgent` on the frontend.

### `POST /recipe-image`

Generate a browser-ready PNG data URL for a finished recipe image. This endpoint
uses OpenAI's Image API directly and requires `OPENAI_API_KEY`, regardless of
the `LLM_MODEL` chat provider.

```bash
curl -X POST http://localhost:8000/recipe-image \
  -H "Content-Type: application/json" \
  -d '{ "recipe": { "title": "Pasta", "servings": 4, "ingredients": [...], "steps": [...] } }'
```

Response:

```json
{
  "dataUrl": "data:image/png;base64,...",
  "mimeType": "image/png",
  "prompt": "Photorealistic food photography..."
}
```

### `POST /copilotkit`

AG-UI endpoint mounted by pydantic-ai. This is what CopilotKit talks to. Point your runtime here:

```ts
new CopilotRuntime({
  agents: {
    recipe_agent: new HttpAgent({ url: "http://localhost:8000/copilotkit" }),
  },
});
```

Then on the page:

```tsx
useCoAgent<RecipeContext>({ name: "recipe_agent", initialState });
```

### `GET /health`

Returns `{ "status": "healthy", "service": "recipe-companion" }`.

## State model

This is the shape shared between the frontend and the agent. The agent mutates it through tool calls.

```ts
interface RecipeContext {
  document_text: string | null;
  recipe: Recipe | null;
  current_step: number;
  scaled_servings: number | null;
  checked_ingredients: string[];
  cooking_started: boolean;
}
```

Full types live in `src/models.py`.

## Agent tools

The agent calls these in response to chat messages. Your UI should react to the resulting state changes.

| Tool                      | What it does                                         |
| ------------------------- | ---------------------------------------------------- |
| `scale_recipe`            | Scale ingredient quantities to `target_servings`.    |
| `substitute_ingredient`   | Replace an ingredient (fuzzy match against recipe).  |
| `update_cooking_progress` | Move to a step, mark cooking started/finished.       |

## Make targets

```bash
make test              # all tests
make test-unit         # fast, no API calls
make test-integration  # hits the real LLM, needs a key
make format            # ruff format
make lint              # ruff check
```

## Notes

- `starlette` is pinned `<1.0`. Starlette 1.0 dropped `on_startup`/`on_shutdown`, which pydantic-ai's AG-UI app still uses. Remove the pin once pydantic-ai catches up.
- Integration tests cost money on OpenAI and burn quota on Gemini's free tier. Run them sparingly.
