import { randomUUID, useCopilotKit } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRecipeContext } from "@/lib/RecipeContext";
import { useRecipeAgent } from "@/lib/useRecipeAgent";

function formatErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return `Something went wrong: ${message || "Unknown error"}`;
}

export function Chat({
  className = "",
}: {
  className?: string;
}): React.JSX.Element | null {
  const { agent } = useRecipeAgent();
  const { copilotkit } = useCopilotKit();
  const { context } = useRecipeContext();
  const { threadId } = context;
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesPaneRef = useRef<HTMLDivElement>(null);
  const messageCount = agent.messages.length;
  const isAgentRunning = agent.isRunning;

  useEffect(() => {
    if (threadId) {
      agent.threadId = threadId;
    }
  }, [agent, threadId]);

  useEffect(() => {
    const subscription = agent.subscribe({
      onRunErrorEvent: ({ event }) => {
        setErrorMessage(formatErrorMessage(event.message));
      },
      onRunFailed: ({ error }) => {
        setErrorMessage(formatErrorMessage(error));
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [agent]);

  useEffect(() => {
    if (messageCount === 0 && !isAgentRunning && !errorMessage) {
      return;
    }

    const messagesPane = messagesPaneRef.current;

    if (messagesPane) {
      const scrollTop = messagesPane.scrollHeight;

      if (typeof messagesPane.scrollTo === "function") {
        messagesPane.scrollTo({
          top: scrollTop,
          behavior: "smooth",
        });
      } else {
        messagesPane.scrollTop = scrollTop;
      }
    }
  }, [messageCount, isAgentRunning, errorMessage]);

  const sendMessage = useCallback(async () => {
    if (!input.trim()) {
      return;
    }
    setErrorMessage(null);
    try {
      agent.addMessage({
        id: randomUUID(),
        role: "user",
        content: input,
      });
      setInput("");
      await copilotkit.runAgent({ agent });
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    }
  }, [input, agent, copilotkit]);

  if (!threadId) {
    return null;
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col card ${className ?? ""}`}>
      <div
        ref={messagesPaneRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-lg p-4 bg-gray-100 dark:bg-gray-800"
      >
        <div className="flex min-h-full flex-col justify-end">
          {agent.messages.map((message) => {
            if (
              !message.content ||
              (message.role !== "user" && message.role !== "assistant")
            ) {
              return null;
            }

            return (
              <div key={message.id}>
                {message.content ? (
                  <div
                    className={`chat chat-${message.role === "user" ? "sender" : "receiver"}`}
                  >
                    <div className="chat-bubble">
                      {message.content as string}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {agent.isRunning && (
            <div className="chat chat-receiver">
              <div className="chat-bubble">
                <span className="loading loading-dots loading-sm" />
              </div>
            </div>
          )}
          {errorMessage ? (
            <div className="chat chat-receiver" role="alert">
              <div className="chat-bubble inline-flex gap-2">
                <span className="text-red-500">{errorMessage}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <form
        className="p-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
      >
        <input
          type="text"
          name="message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="grow shrink-0 resize-none overflow-hidden rounded-lg border px-3 py-2 leading-6"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!input.trim() || agent.isRunning}
          className="btn btn-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full  text-white"
        >
          {agent.isRunning ? (
            <span className="loading loading-spinner" />
          ) : (
            <span
              className="icon-[tabler--arrow-narrow-up]"
              aria-hidden="true"
            />
          )}
        </button>
      </form>
    </div>
  );
}
