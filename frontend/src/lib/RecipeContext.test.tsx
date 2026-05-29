import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Dispatch, SetStateAction } from "react";
import {
  RecipeContext,
  RecipeContextProvider,
  type RecipeContextState,
  useRecipeContext,
} from "@/lib/RecipeContext";

const populatedContext: RecipeContextState = {
  pending: false,
  error: null,
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
};

function ContextConsumer() {
  const { context, setContext } = useRecipeContext();

  return (
    <div>
      <p>Pending: {context.pending ? "yes" : "no"}</p>
      <p>Error: {context.error ?? "none"}</p>
      <p>Thread: {context.threadId ?? "none"}</p>
      <p>Run: {context.runId ?? "none"}</p>
      <p>Document: {context.state?.document_text ?? "none"}</p>

      <button
        type="button"
        onClick={() => {
          setContext((currentContext) => ({
            ...currentContext,
            pending: true,
            error: "Upload failed",
          }));
        }}
      >
        Set error
      </button>

      <button
        type="button"
        onClick={() => {
          setContext(populatedContext);
        }}
      >
        Load recipe
      </button>
    </div>
  );
}

describe("RecipeContext", () => {
  it("provides the default context state", () => {
    render(
      <RecipeContextProvider>
        <ContextConsumer />
      </RecipeContextProvider>,
    );

    expect(screen.getByText("Pending: no")).toBeInTheDocument();
    expect(screen.getByText("Error: none")).toBeInTheDocument();
    expect(screen.getByText("Thread: none")).toBeInTheDocument();
    expect(screen.getByText("Run: none")).toBeInTheDocument();
    expect(screen.getByText("Document: none")).toBeInTheDocument();
  });

  it("updates context with functional state updates", async () => {
    const user = userEvent.setup();

    render(
      <RecipeContextProvider>
        <ContextConsumer />
      </RecipeContextProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Set error" }));

    expect(screen.getByText("Pending: yes")).toBeInTheDocument();
    expect(screen.getByText("Error: Upload failed")).toBeInTheDocument();
  });

  it("updates context with replacement state", async () => {
    const user = userEvent.setup();

    render(
      <RecipeContextProvider>
        <ContextConsumer />
      </RecipeContextProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Load recipe" }));

    expect(screen.getByText("Thread: thread-1")).toBeInTheDocument();
    expect(screen.getByText("Run: run-1")).toBeInTheDocument();
    expect(
      screen.getByText("Document: Parsed recipe text"),
    ).toBeInTheDocument();
  });

  it("uses an explicit RecipeContext.Provider value", () => {
    const setContext: Dispatch<SetStateAction<RecipeContextState>> = jest.fn();

    render(
      <RecipeContext.Provider value={{ context: populatedContext, setContext }}>
        <ContextConsumer />
      </RecipeContext.Provider>,
    );

    expect(screen.getByText("Thread: thread-1")).toBeInTheDocument();
    expect(
      screen.getByText("Document: Parsed recipe text"),
    ).toBeInTheDocument();
  });
});
