import { UseAgentUpdate, useAgent } from "@copilotkit/react-core/v2";
import type { RecipeAgentState } from "@/types/recipe";

type RecipeAgentStateResult = {
  agent: ReturnType<typeof useAgent>["agent"];
  agentState: RecipeAgentState;
  setAgentState: (
    updateFn: (prevState: RecipeAgentState) => RecipeAgentState,
  ) => void;
};

export function useRecipeAgent(): RecipeAgentStateResult {
  const { agent } = useAgent({
    agentId: "recipe_agent",
    updates: [
      UseAgentUpdate.OnMessagesChanged,
      UseAgentUpdate.OnRunStatusChanged,
      UseAgentUpdate.OnStateChanged,
    ],
  });

  return {
    agent,
    agentState: agent.state,
    setAgentState: (
      updateFn: (prevState: RecipeAgentState) => RecipeAgentState,
    ) => {
      agent.setState(updateFn(agent.state));
    },
  };
}
