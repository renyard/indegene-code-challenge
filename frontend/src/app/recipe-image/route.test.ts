/**
 * @jest-environment node
 */

const originalBackendUrl = process.env.BACKEND_URL;

function createRecipeImageRequest(body: unknown): Request {
  return new Request("http://localhost:3000/recipe-image", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function loadRoute() {
  jest.resetModules();
  const route = await import("./route");

  return route;
}

describe("recipe image route", () => {
  beforeEach(() => {
    process.env.BACKEND_URL = "http://backend:8000";
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.BACKEND_URL = originalBackendUrl;
  });

  it("proxies recipe image requests to the backend recipe-image endpoint", async () => {
    const requestBody = { recipe: { title: "Tomato Pasta" } };
    const backendBody = {
      dataUrl: "data:image/png;base64,abc123",
      mimeType: "image/png",
      prompt: "food photo",
    };
    const fetchMock = jest.fn().mockResolvedValue(Response.json(backendBody));
    globalThis.fetch = fetchMock;
    const { POST } = await loadRoute();

    const response = await POST(createRecipeImageRequest(requestBody));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://backend:8000/recipe-image");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual(requestBody);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(backendBody);
  });

  it("rejects requests without a recipe before calling the backend", async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    const { POST } = await loadRoute();

    const response = await POST(createRecipeImageRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No recipe provided",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a bad gateway response when the backend cannot be reached", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new Error("connection refused"));
    globalThis.fetch = fetchMock;
    const { POST } = await loadRoute();

    const response = await POST(
      createRecipeImageRequest({ recipe: { title: "Tomato Pasta" } }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Could not reach recipe backend: connection refused",
    });
  });
});
