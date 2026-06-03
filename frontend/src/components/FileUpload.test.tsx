import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { FileUpload } from "@/components/FileUpload";
import { upload } from "@/lib/api/upload";
import { RecipeContext, type RecipeContextState } from "@/lib/RecipeContext";
import type { RecipeAgentState, UploadResponse } from "@/types/recipe";

jest.mock("@/lib/api/upload", () => ({
  upload: jest.fn(),
}));

const mockSetAgentState = jest.fn();

jest.mock("@/lib/useRecipeAgent", () => ({
  useRecipeAgent: jest.fn(() => ({
    setAgentState: mockSetAgentState,
  })),
}));

const mockUpload = jest.mocked(upload);

const uploadedState: RecipeAgentState = {
  document_text: "Parsed recipe text",
  recipe: null,
  current_step: 1,
  scaled_servings: null,
  checked_ingredients: [],
  cooking_started: false,
};

const uploadResponse: UploadResponse = {
  threadId: "thread-1",
  runId: "run-1",
  state: uploadedState,
  tools: [],
  context: [],
  forwardedProps: {},
  messages: [],
};

const context: RecipeContextState = {
  pending: false,
  error: null,
  threadId: null,
  runId: null,
};

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const setContext: Dispatch<SetStateAction<RecipeContextState>> = jest.fn();

  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <RecipeContext.Provider value={{ context, setContext }}>
        {children}
      </RecipeContext.Provider>
    </QueryClientProvider>,
  );

  return { ...renderResult, setContext };
}

describe("FileUpload", () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockSetAgentState.mockReset();
  });

  it("renders the file upload form", () => {
    renderWithProviders(<FileUpload accept=".txt,.pdf" />);

    const fileInput = screen.getByLabelText(/file-input/i);
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute("accept", ".txt,.pdf");

    const uploadButton = screen.getByRole("button", { name: /upload/i });
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).toHaveAttribute("type", "submit");
  });

  it("uploads the selected file and stores backend ids and agent state", async () => {
    mockUpload.mockResolvedValue(uploadResponse);
    const user = userEvent.setup();
    const { setContext } = renderWithProviders(
      <FileUpload accept=".txt,.pdf" />,
    );

    const fileInput = screen.getByLabelText(/file-input/i);
    const testFile = new File(["test content"], "test-recipe.txt", {
      type: "text/plain",
    });

    await user.upload(fileInput, testFile);
    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledTimes(1);
    });
    expect(mockUpload.mock.calls[0][0]).toBeInstanceOf(FormData);
    expect(setContext).toHaveBeenLastCalledWith({
      pending: false,
      error: null,
      threadId: "thread-1",
      runId: "run-1",
    });
  });

  it("displays error message on upload failure", async () => {
    mockUpload.mockRejectedValue(new Error("Upload failed"));

    const user = userEvent.setup();
    renderWithProviders(<FileUpload accept=".txt,.pdf" />);

    const fileInput = screen.getByLabelText(/file-input/i);
    const testFile = new File(["test content"], "test-recipe.txt", {
      type: "text/plain",
    });

    await user.upload(fileInput, testFile);

    const uploadButton = screen.getByRole("button", { name: /upload/i });
    await user.click(uploadButton);

    const errorMessage = await screen.findByText(/upload failed/i);
    expect(errorMessage).toBeInTheDocument();
  });
});
