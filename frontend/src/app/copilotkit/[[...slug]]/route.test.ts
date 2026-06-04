/**
 * @jest-environment node
 */

const originalBackendUrl = process.env.BACKEND_URL;
const originalTelemetryDisabled = process.env.COPILOTKIT_TELEMETRY_DISABLED;
const mockSingleRouteHandler = jest.fn(async () =>
  Response.json({ handler: "single-route" }),
);
const mockMultiRouteHandler = jest.fn(async () =>
  Response.json({ handler: "multi-route" }),
);

jest.mock("@ag-ui/client", () => ({
  HttpAgent: jest.fn(function HttpAgent(this: object, config: object) {
    Object.assign(this, config);
  }),
}));

jest.mock("@copilotkit/runtime/v2", () => ({
  CopilotRuntime: jest.fn(function CopilotRuntime(
    this: object,
    config: object,
  ) {
    Object.assign(this, config);
  }),
  createCopilotRuntimeHandler: jest.fn(({ mode }: { mode?: string }) =>
    mode === "single-route" ? mockSingleRouteHandler : mockMultiRouteHandler,
  ),
}));

function createRequest(path = "/copilotkit", init: RequestInit = {}): Request {
  return new Request(`http://localhost:3000${path}`, init);
}

async function loadRoute() {
  jest.resetModules();
  const route = await import("./route");

  return route;
}

describe("copilotkit route", () => {
  beforeEach(() => {
    process.env.BACKEND_URL = "http://backend:8000/";
    process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
    jest.restoreAllMocks();
    mockSingleRouteHandler.mockClear();
    mockMultiRouteHandler.mockClear();
  });

  afterAll(() => {
    process.env.BACKEND_URL = originalBackendUrl;
    process.env.COPILOTKIT_TELEMETRY_DISABLED = originalTelemetryDisabled;
  });

  it("routes CopilotKit info calls through the multi-route runtime handler", async () => {
    const { GET } = await loadRoute();

    const response = await GET(createRequest("/copilotkit/info"));

    expect(mockSingleRouteHandler).not.toHaveBeenCalled();
    expect(mockMultiRouteHandler).toHaveBeenCalledTimes(1);
    expect(mockMultiRouteHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://localhost:3000/copilotkit/info",
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      handler: "multi-route",
    });
  });

  it("routes base CopilotKit calls through the single-route runtime handler", async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      createRequest("/copilotkit", { method: "POST" }),
    );

    expect(mockMultiRouteHandler).not.toHaveBeenCalled();
    expect(mockSingleRouteHandler).toHaveBeenCalledTimes(1);
    expect(mockSingleRouteHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://localhost:3000/copilotkit",
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      handler: "single-route",
    });
  });

  it("configures the recipe agent with the backend AG-UI mount", async () => {
    const { HttpAgent } = await import("@ag-ui/client");

    await loadRoute();

    expect(HttpAgent).toHaveBeenCalledWith({
      url: "http://backend:8000/copilotkit",
    });
  });
});
