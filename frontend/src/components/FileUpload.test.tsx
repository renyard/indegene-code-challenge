import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { FileUpload } from "@/components/FileUpload";
import { upload } from "@/lib/api/upload";

jest.mock("@/lib/api/upload", () => ({
  upload: jest.fn(),
}));

const mockUpload = jest.mocked(upload);

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  );
}

describe("FileUpload", () => {
  beforeEach(() => {
    mockUpload.mockReset();
  });

  it("renders the file upload form", () => {
    renderWithQueryClient(<FileUpload accept=".txt,.pdf" />);

    const fileInput = screen.getByLabelText(/file-input/i);
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute("accept", ".txt,.pdf");

    const uploadButton = screen.getByRole("button", { name: /upload/i });
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).toHaveAttribute("type", "submit");
  });

  it("displays selected file name", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<FileUpload accept=".txt,.pdf" />);

    const fileInput = screen.getByLabelText(/file-input/i);
    const testFile = new File(["test content"], "test-recipe.txt", {
      type: "text/plain",
    });

    await user.upload(fileInput, testFile);

    expect(screen.getByText("test-recipe.txt")).toBeInTheDocument();
  });

  it("displays error message on upload failure", async () => {
    mockUpload.mockRejectedValue(new Error("Upload failed"));

    const user = userEvent.setup();
    renderWithQueryClient(<FileUpload accept=".txt,.pdf" />);

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
