import type { UploadResponse } from "@/types/recipe";

const originalMockUploadEnv = process.env.NEXT_PUBLIC_MOCK_UPLOAD;

const uploadResponse: UploadResponse = {
  threadId: "thread-1",
  runId: "run-1",
  state: {
    document_text: "Parsed recipe text",
    recipe: null,
    current_step: 0,
    scaled_servings: null,
    checked_ingredients: [],
    cooking_started: false,
  },
  tools: [],
  context: [],
  forwardedProps: {},
  messages: [],
};

function createRecipeFormData(file = new File(["recipe"], "recipe.txt")) {
  const formData = new FormData();
  formData.append("file", file);

  return formData;
}

async function loadUpload() {
  jest.resetModules();
  const { upload } = await import("./upload");

  return upload;
}

describe("upload", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MOCK_UPLOAD = originalMockUploadEnv;
    jest.restoreAllMocks();
    jest.dontMock("../mockUpload");
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_MOCK_UPLOAD = originalMockUploadEnv;
  });

  it("throws when no file is provided", async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    const upload = await loadUpload();

    await expect(upload(new FormData())).rejects.toThrow("No file uploaded");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the file is empty", async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    const upload = await loadUpload();
    const formData = createRecipeFormData(new File([], "empty.txt"));

    await expect(upload(formData)).rejects.toThrow("No file uploaded");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the file to the backend and returns the parsed response", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(uploadResponse),
    });
    globalThis.fetch = fetchMock;
    const upload = await loadUpload();
    const formData = createRecipeFormData();

    await expect(upload(formData)).resolves.toEqual(uploadResponse);
    expect(fetchMock).toHaveBeenCalledWith("/upload", {
      method: "POST",
      body: formData,
    });
  });

  it("throws the backend error response when upload fails", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: jest.fn().mockResolvedValue("Unsupported file type"),
    });
    globalThis.fetch = fetchMock;
    const upload = await loadUpload();

    await expect(upload(createRecipeFormData())).rejects.toThrow(
      "Upload failed with status 422: Unsupported file type",
    );
  });

  it("uses the mock upload response when mock uploads are enabled", async () => {
    process.env.NEXT_PUBLIC_MOCK_UPLOAD = "true";
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    const createMockUploadResponse = jest
      .fn()
      .mockResolvedValue(uploadResponse);

    jest.doMock("../mockUpload", () => ({
      createMockUploadResponse,
    }));

    const upload = await loadUpload();
    const file = new File(["recipe"], "mock-recipe.txt");

    await expect(upload(createRecipeFormData(file))).resolves.toEqual(
      uploadResponse,
    );
    expect(createMockUploadResponse).toHaveBeenCalledWith(file);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
