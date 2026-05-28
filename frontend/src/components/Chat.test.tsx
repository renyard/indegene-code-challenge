import { render, screen } from "@testing-library/react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ChatWrapper } from "@/components/Chat";
import { RecipeContext, type RecipeContextState } from "@/lib/RecipeContext";

type MockAgentSubscription = {
  onStateChanged: ({ state }: { state: unknown }) => void;
};

const mockAgent = {
  state: {},
  threadId: "",
  setState: jest.fn(),
  subscribe: jest.fn((_subscription: MockAgentSubscription) => ({
    unsubscribe: jest.fn(),
  })),
};

jest.mock("@copilotkit/react-core/v2", () => ({
  CopilotKit: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CopilotSidebar: jest.fn(() => <div>Mocked CopilotSidebar</div>),
  UseAgentUpdate: {
    OnStateChanged: "OnStateChanged",
  },
  useAgent: jest.fn(() => ({
    agent: mockAgent,
  })),
}));

const context: RecipeContextState = {
  pending: false,
  error: null,
  threadId: "thread-1",
  runId: "run-1",
  state: {
    document_text: "A simple recipe",
    recipe: null,
    current_step: 1,
    scaled_servings: null,
    checked_ingredients: [],
    cooking_started: false,
  },
};

function renderWithRecipeContext(children: ReactNode) {
  const setContext: Dispatch<SetStateAction<RecipeContextState>> = jest.fn();

  const renderResult = render(
    <RecipeContext.Provider value={{ context, setContext }}>
      {children}
    </RecipeContext.Provider>,
  );

  return { ...renderResult, setContext };
}

describe("ChatWrapper component", () => {
  beforeEach(() => {
    mockAgent.state = {};
    mockAgent.threadId = "";
    mockAgent.setState.mockClear();
    mockAgent.subscribe.mockClear();
  });

  it("renders the CopilotSidebar", () => {
    renderWithRecipeContext(<ChatWrapper />);

    expect(screen.getByText("Mocked CopilotSidebar")).toBeInTheDocument();
  });

  it("initializes agent state and threadId from context", () => {
    renderWithRecipeContext(<ChatWrapper />);

    expect(mockAgent.threadId).toBe("thread-1");
    expect(mockAgent.setState).toHaveBeenCalledWith(context.state);
  });

  it("subscribes to agent state changes and updates context", () => {
    const updatedState = {
      document_text: "Updated recipe text",
      recipe: null,
      current_step: 2,
      scaled_servings: null,
      checked_ingredients: [],
      cooking_started: false,
    };
    const mockSubscribe = jest.fn(({ onStateChanged }) => {
      onStateChanged({ state: updatedState });
      return { unsubscribe: jest.fn() };
    });
    mockAgent.subscribe = mockSubscribe;

    const { setContext } = renderWithRecipeContext(<ChatWrapper />);

    expect(mockSubscribe).toHaveBeenCalled();
    expect(setContext).toHaveBeenCalledWith(expect.any(Function));

    const updateContext = jest.mocked(setContext).mock.calls[0][0];

    expect(typeof updateContext).toBe("function");
    if (typeof updateContext === "function") {
      expect(updateContext(context)).toEqual({
        ...context,
        state: updatedState,
      });
    }
  });
});
