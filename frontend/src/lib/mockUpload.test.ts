import { createMockUploadResponse } from "@/lib/mockUpload";

const originalCrypto = globalThis.crypto;

describe("createMockUploadResponse", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        randomUUID: jest
          .fn()
          .mockReturnValueOnce("thread-id")
          .mockReturnValueOnce("run-id"),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });

  it("returns mock upload data for the selected file", async () => {
    const responsePromise = createMockUploadResponse(
      new File(["recipe"], "pasta.txt"),
    );

    await jest.advanceTimersByTimeAsync(500);

    await expect(responsePromise).resolves.toMatchObject({
      threadId: "thread-id",
      runId: "run-id",
      state: {
        document_text: "Mock recipe parsed from pasta.txt",
        current_step: 0,
        scaled_servings: null,
        checked_ingredients: [],
        cooking_started: false,
      },
      tools: [],
      context: [],
      forwardedProps: {},
      messages: [],
    });
  });

  it("includes the bundled mock recipe in the response state", async () => {
    const responsePromise = createMockUploadResponse(
      new File(["recipe"], "cake.txt"),
    );

    await jest.advanceTimersByTimeAsync(500);
    const response = await responsePromise;

    expect(response.state.recipe).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        ingredients: expect.any(Array),
        steps: expect.any(Array),
      }),
    );
  });
});
