import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Chat } from "@/components/Chat";
import { RecipeContext, type RecipeContextState } from "@/lib/RecipeContext";

const mockAgent = {
  state: {},
  threadId: "",
  messages: [],
  isRunning: false,
  addMessage: jest.fn(),
  setState: jest.fn(),
};

const mockRunAgent = jest.fn();

jest.mock("@copilotkit/react-core/v2", () => ({
  CopilotKit: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  UseAgentUpdate: {
    OnMessagesChanged: "OnMessagesChanged",
    OnRunStatusChanged: "OnRunStatusChanged",
    OnStateChanged: "OnStateChanged",
  },
  randomUUID: jest.fn(() => "message-1"),
  useAgent: jest.fn(() => ({
    agent: mockAgent,
  })),
  useCopilotKit: jest.fn(() => ({
    copilotkit: {
      runAgent: mockRunAgent,
    },
  })),
}));

const context: RecipeContextState = {
  pending: false,
  error: null,
  threadId: "thread-1",
  runId: "run-1",
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

describe("Chat component", () => {
  beforeEach(() => {
    mockAgent.state = {};
    mockAgent.threadId = "";
    mockAgent.messages = [];
    mockAgent.isRunning = false;
    mockAgent.addMessage.mockClear();
    mockAgent.setState.mockClear();
    mockRunAgent.mockClear();
  });

  it("renders the chat input", () => {
    renderWithRecipeContext(<Chat />);

    expect(
      screen.getByPlaceholderText("Type a message..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("initializes the agent threadId from context", () => {
    renderWithRecipeContext(<Chat />);

    expect(mockAgent.threadId).toBe("thread-1");
    expect(mockAgent.setState).not.toHaveBeenCalled();
  });

  it("does not render without a threadId", () => {
    const emptyContext: RecipeContextState = {
      ...context,
      threadId: null,
    };
    const setContext: Dispatch<SetStateAction<RecipeContextState>> = jest.fn();

    render(
      <RecipeContext.Provider value={{ context: emptyContext, setContext }}>
        <Chat />
      </RecipeContext.Provider>,
    );

    expect(
      screen.queryByPlaceholderText("Type a message..."),
    ).not.toBeInTheDocument();
  });

  it("adds a user message and runs the agent on submit", async () => {
    const user = userEvent.setup();
    renderWithRecipeContext(<Chat />);

    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Scale it",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(mockAgent.addMessage).toHaveBeenCalledWith({
      id: "message-1",
      role: "user",
      content: "Scale it",
    });
    expect(mockRunAgent).toHaveBeenCalledWith({ agent: mockAgent });
  });
});
