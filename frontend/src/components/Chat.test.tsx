import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Chat } from "@/components/Chat";
import { RecipeContext, type RecipeContextState } from "@/lib/RecipeContext";

type MockAgentSubscriber = {
  onRunErrorEvent?: (params: { event: { message: string } }) => void;
  onRunFailed?: (params: { error: Error }) => void;
};

let mockAgentSubscriber: MockAgentSubscriber | null = null;

const mockAgent = {
  state: {},
  threadId: "",
  messages: [],
  isRunning: false,
  addMessage: jest.fn(),
  setState: jest.fn(),
  subscribe: jest.fn((subscriber: MockAgentSubscriber) => {
    mockAgentSubscriber = subscriber;

    return {
      unsubscribe: jest.fn(),
    };
  }),
};

const mockRunAgent = jest.fn();
const speechRecognitionInstances: MockSpeechRecognition[] = [];

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null = null;
  abort = jest.fn();
  start = jest.fn();
  stop = jest.fn();

  constructor() {
    speechRecognitionInstances.push(this);
  }
}

function mockBrowserSpeechRecognition() {
  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    value: MockSpeechRecognition,
  });
}

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
    mockAgent.subscribe.mockClear();
    mockAgentSubscriber = null;
    mockRunAgent.mockClear();
    speechRecognitionInstances.length = 0;
    Reflect.deleteProperty(window, "SpeechRecognition");
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });

  it("renders the chat input", () => {
    renderWithRecipeContext(<Chat />);

    expect(
      screen.getByPlaceholderText("Type a message..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start voice input" }),
    ).not.toBeInTheDocument();
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

  it("adds voice transcripts to the message input", async () => {
    const user = userEvent.setup();
    mockBrowserSpeechRecognition();
    renderWithRecipeContext(<Chat />);

    const voiceButton = await screen.findByRole("button", {
      name: "Start voice input",
    });
    await user.click(voiceButton);

    expect(speechRecognitionInstances[0].start).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Stop voice input" }),
    ).toHaveAttribute("aria-pressed", "true");

    act(() => {
      speechRecognitionInstances[0].onresult?.({
        results: [[{ transcript: "scale this for four people" }]],
      });
      speechRecognitionInstances[0].onend?.();
    });

    expect(screen.getByPlaceholderText("Type a message...")).toHaveValue(
      "scale this for four people",
    );
    expect(
      screen.getByRole("button", { name: "Start voice input" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("appends voice transcripts to existing typed input", async () => {
    const user = userEvent.setup();
    mockBrowserSpeechRecognition();
    renderWithRecipeContext(<Chat />);

    await user.type(screen.getByPlaceholderText("Type a message..."), "Please");
    await user.click(
      await screen.findByRole("button", { name: "Start voice input" }),
    );

    act(() => {
      speechRecognitionInstances[0].onresult?.({
        results: [[{ transcript: "substitute the butter" }]],
      });
    });

    expect(screen.getByPlaceholderText("Type a message...")).toHaveValue(
      "Please substitute the butter",
    );
  });

  it("displays agent run errors as chat messages", async () => {
    const user = userEvent.setup();
    mockRunAgent.mockRejectedValueOnce(new Error("backend unavailable"));
    renderWithRecipeContext(<Chat />);

    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Help me",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong: backend unavailable",
    );
  });

  it("displays streamed run error events as chat messages", async () => {
    const user = userEvent.setup();
    mockRunAgent.mockImplementationOnce(async () => {
      mockAgentSubscriber?.onRunErrorEvent?.({
        event: { message: "Could not reach recipe backend" },
      });
    });
    renderWithRecipeContext(<Chat />);

    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Help me",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong: Could not reach recipe backend",
    );
  });

  it("clears a previous error before sending another message", async () => {
    const user = userEvent.setup();
    mockRunAgent
      .mockRejectedValueOnce(new Error("backend unavailable"))
      .mockResolvedValueOnce(undefined);
    renderWithRecipeContext(<Chat />);

    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Help me",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Try again",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
