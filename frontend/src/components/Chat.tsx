import { randomUUID, useCopilotKit } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRecipeContext } from "@/lib/RecipeContext";
import { useRecipeAgent } from "@/lib/useRecipeAgent";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadId) {
      agent.threadId = threadId;
    }
  }, [agent, threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "end",
    });
  });

  const sendMessage = useCallback(async () => {
    if (!input.trim()) {
      return;
    }
    agent.addMessage({
      id: randomUUID(),
      role: "user",
      content: input,
    });
    setInput("");
    await copilotkit.runAgent({ agent });
  }, [input, agent, copilotkit]);

  if (!threadId) {
    return null;
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col card ${className ?? ""}`}>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg p-4 bg-gray-100 dark:bg-gray-800">
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
          <div ref={messagesEndRef} />
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
