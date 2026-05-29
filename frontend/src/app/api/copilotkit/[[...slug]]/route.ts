import { HttpAgent } from "@ag-ui/client";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";

const basePath = "/api/copilotkit";
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const runtime = new CopilotRuntime({
  agents: {
    recipe_agent: new HttpAgent({
      url: `${backendUrl.replace(/\/$/, "")}/copilotkit`,
    }),
  },
});

const singleRouteHandler = createCopilotRuntimeHandler({
  runtime,
  basePath,
  mode: "single-route",
});

const multiRouteHandler = createCopilotRuntimeHandler({
  runtime,
  basePath,
});

function handler(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/$/, "");

  if (path === basePath) {
    return singleRouteHandler(request);
  }

  return multiRouteHandler(request);
}

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
export const PATCH = handler;
export const DELETE = handler;
