import { useRecipeContext, type RecipeContextState } from "@/lib/RecipeContext";
import type { RecipeAgentState } from "@/types/recipe";

import {
  CopilotKit,
  CopilotSidebar,
  useAgent,
  UseAgentUpdate,
} from "@copilotkit/react-core/v2";
import { useEffect, type Dispatch, type SetStateAction } from "react";

function isRecipeAgentState(state: unknown): state is RecipeAgentState {
  return (
    typeof state === "object" &&
    state !== null &&
    "document_text" in state &&
    "recipe" in state &&
    "current_step" in state &&
    "scaled_servings" in state &&
    "checked_ingredients" in state &&
    "cooking_started" in state
  );
}

export function ChatSidebar({
  context,
  setContext,
  threadId,
}: {
  context: RecipeContextState;
  setContext: Dispatch<SetStateAction<RecipeContextState>>;
  threadId: string;
}): React.JSX.Element | null {
  const { agent } = useAgent({
    agentId: "recipe_agent",
    updates: [UseAgentUpdate.OnStateChanged],
  });

  useEffect(() => {
    if (
      Object.keys(context.state || {}).length > 0 &&
      Object.keys(agent.state || {}).length === 0
    ) {
      agent.threadId = threadId;
      agent.setState(context.state);
    }
  }, [agent, context.state, threadId]);

  useEffect(() => {
    const subscription = agent.subscribe({
      onStateChanged: ({ state }) => {
        if (!isRecipeAgentState(state)) {
          return;
        }

        setContext((prevContext) => ({
          ...prevContext,
          state,
        }));
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [agent, setContext]);

  return (
    <CopilotSidebar
      agentId="recipe_agent"
      defaultOpen={window.innerWidth > 768}
    />
  );
}

export function ChatWrapper(): React.JSX.Element | null {
  const { context, setContext } = useRecipeContext();
  const { state, threadId } = context;

  if (!threadId || !state) {
    return null;
  }

  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="recipe_agent">
      <ChatSidebar
        context={context}
        setContext={setContext}
        threadId={threadId}
      />
    </CopilotKit>
  );
}
