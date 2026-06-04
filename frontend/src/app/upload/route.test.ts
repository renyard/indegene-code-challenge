/**
 * @jest-environment node
 */

const originalBackendUrl = process.env.BACKEND_URL;

function createUploadRequest(formData: FormData): Request {
  return new Request("http://localhost:3000/upload", {
    method: "POST",
    body: formData,
  });
}

function createRecipeFormData(file = new File(["recipe"], "recipe.txt")) {
  const formData = new FormData();
  formData.append("file", file);

  return formData;
}

async function loadRoute() {
  jest.resetModules();
  const route = await import("./route");

  return route;
}

describe("upload route", () => {
  beforeEach(() => {
    process.env.BACKEND_URL = "http://backend:8000";
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.BACKEND_URL = originalBackendUrl;
  });

  it("proxies uploaded files to the backend upload endpoint", async () => {
    const backendBody = { threadId: "thread-1", runId: "run-1", state: {} };
    const fetchMock = jest.fn().mockResolvedValue(
      Response.json(backendBody, {
        status: 201,
        statusText: "Created",
      }),
    );
    globalThis.fetch = fetchMock;
    const { POST } = await loadRoute();
    const formData = createRecipeFormData();

    const response = await POST(createUploadRequest(formData));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://backend:8000/upload");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("file")).toBeInstanceOf(File);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(backendBody);
  });

  it("rejects requests without a file before calling the backend", async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    const { POST } = await loadRoute();

    const response = await POST(createUploadRequest(new FormData()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No file uploaded",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a bad gateway response when the backend cannot be reached", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new Error("connection refused"));
    globalThis.fetch = fetchMock;
    const { POST } = await loadRoute();

    const response = await POST(createUploadRequest(createRecipeFormData()));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Could not reach recipe backend: connection refused",
    });
  });
});
