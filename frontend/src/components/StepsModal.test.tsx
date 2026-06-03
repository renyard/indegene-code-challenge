import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepsModal } from "@/components/StepsModal";
import type { Recipe, RecipeAgentState } from "@/types/recipe";

let mockAgentState: RecipeAgentState;

jest.mock("@/lib/useRecipeAgent", () => ({
  useRecipeAgent: jest.fn(() => ({
    agentState: mockAgentState,
  })),
}));

const recipe: Recipe = {
  title: "Tomato Pasta",
  description: "A quick weeknight pasta.",
  servings: 2,
  original_servings: null,
  prep_time_minutes: 10,
  cook_time_minutes: 15,
  difficulty: "easy",
  cuisine: "Italian",
  dietary_tags: [],
  ingredients: [],
  steps: [
    {
      step_number: 1,
      instruction: "Boil the pasta.",
      duration_minutes: 10,
      timer_label: "pasta",
      requires_attention: true,
      tips: [],
    },
    {
      step_number: 2,
      instruction: "Stir in the sauce.",
      duration_minutes: 2,
      timer_label: null,
      requires_attention: false,
      tips: [],
    },
  ],
};

const recipeState: RecipeAgentState = {
  document_text: "A simple recipe",
  current_step: 1,
  scaled_servings: null,
  checked_ingredients: [],
  cooking_started: false,
  recipe,
};

describe("StepsModal", () => {
  beforeEach(() => {
    mockAgentState = recipeState;
  });

  it("renders the current step and navigation controls", () => {
    render(<StepsModal />);

    expect(screen.getByRole("dialog", { hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Step 1 of 2" })).toBeVisible();
    expect(screen.getByText("Boil the pasta.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  it("moves between steps", async () => {
    const user = userEvent.setup();
    render(<StepsModal />);

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByRole("heading", { name: "Step 2 of 2" })).toBeVisible();
    expect(screen.getByText("Stir in the sauce.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /back/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByRole("heading", { name: "Step 1 of 2" })).toBeVisible();
  });

  it("handles recipes without steps", () => {
    mockAgentState = {
      ...recipeState,
      recipe: {
        ...recipe,
        steps: [],
      },
    };

    render(<StepsModal />);

    expect(screen.getByRole("heading", { name: "Step 1 of 0" })).toBeVisible();
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });
});
