import { useRecipeContext } from "@/lib/RecipeContext";
import type { RecipeAgentState } from "@/types/recipe";

import {
  CopilotKit,
  CopilotSidebar,
  useAgent,
} from "@copilotkit/react-core/v2";
import { useEffect } from "react";

function RecipeAgentStateBridge({
  state,
}: {
  state: RecipeAgentState;
}): null {
  const { agent } = useAgent({ agentId: "recipe_agent" });

  useEffect(() => {
    agent.setState(state);
  }, [agent, state]);

  return null;
}

export function Chat(): React.JSX.Element | null {
  const { context } = useRecipeContext();
  const { state, threadId } = context;

  if (!threadId || !state) {
    return null;
  }

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="recipe_agent"
      threadId={threadId}
    >
      <RecipeAgentStateBridge state={state} />
      <CopilotSidebar agentId="recipe_agent" threadId={threadId} />
    </CopilotKit>
  );
}
