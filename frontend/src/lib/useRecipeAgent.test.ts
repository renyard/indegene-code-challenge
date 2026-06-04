import { useAgent } from "@copilotkit/react-core/v2";
import { renderHook } from "@testing-library/react";
import { useRecipeAgent } from "@/lib/useRecipeAgent";
import type { RecipeAgentState } from "@/types/recipe";

const mockAgentState: RecipeAgentState = {
  document_text: "Parsed recipe text",
  recipe: null,
  current_step: 1,
  scaled_servings: null,
  checked_ingredients: [],
  cooking_started: false,
};

const mockSetState = jest.fn();
const mockAgent = {
  state: mockAgentState,
  setState: mockSetState,
};

jest.mock("@copilotkit/react-core/v2", () => ({
  UseAgentUpdate: {
    OnMessagesChanged: "OnMessagesChanged",
    OnRunStatusChanged: "OnRunStatusChanged",
    OnStateChanged: "OnStateChanged",
  },
  useAgent: jest.fn(() => ({
    agent: mockAgent,
  })),
}));

describe("useRecipeAgent", () => {
  beforeEach(() => {
    mockSetState.mockReset();
  });

  it("subscribes to the recipe agent with message, run and state updates", () => {
    renderHook(() => useRecipeAgent());

    expect(useAgent).toHaveBeenCalledWith({
      agentId: "recipe_agent",
      updates: ["OnMessagesChanged", "OnRunStatusChanged", "OnStateChanged"],
    });
  });

  it("returns the agent and current agent state", () => {
    const { result } = renderHook(() => useRecipeAgent());

    expect(result.current.agent).toBe(mockAgent);
    expect(result.current.agentState).toBe(mockAgentState);
  });

  it("applies functional state updates to the agent", () => {
    const { result } = renderHook(() => useRecipeAgent());

    result.current.setAgentState((previousState) => ({
      ...previousState,
      current_step: 2,
    }));

    expect(mockSetState).toHaveBeenCalledWith({
      ...mockAgentState,
      current_step: 2,
    });
  });
});
