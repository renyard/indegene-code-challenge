import { render, screen } from "@testing-library/react";
import { RecipeDetails } from "@/components/RecipeDetails";
import type { Recipe, RecipeAgentState } from "@/types/recipe";

const mockSetAgentState = jest.fn();
let mockAgentState: RecipeAgentState;

jest.mock("@/lib/useRecipeAgent", () => ({
  useRecipeAgent: jest.fn(() => ({
    agentState: mockAgentState,
    setAgentState: mockSetAgentState,
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
  dietary_tags: ["vegetarian"],
  ingredients: [
    {
      name: "tomatoes",
      quantity: 200,
      unit: "g",
      preparation: "chopped",
      category: "produce",
      substitutes: [],
    },
  ],
  steps: [
    {
      step_number: 1,
      instruction: "Cook the pasta until al dente.",
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

describe("RecipeDetails", () => {
  beforeEach(() => {
    mockAgentState = recipeState;
    mockSetAgentState.mockReset();
  });

  it("renders recipe details from context", () => {
    render(<RecipeDetails />);

    expect(
      screen.getByRole("heading", { name: "Tomato Pasta" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A quick weeknight pasta.")).toBeInTheDocument();
    expect(screen.getByText("vegetarian")).toBeInTheDocument();
    expect(screen.getByText("tomatoes (200 g)")).toBeInTheDocument();
    expect(
      screen.getByText("Cook the pasta until al dente."),
    ).toBeInTheDocument();
  });

  it("does not render a trailing space after ingredient quantity where no unit is specified", () => {
    mockAgentState = {
      ...recipeState,
      recipe: {
        ...recipe,
        ingredients: [
          {
            name: "Tomatoes",
            quantity: 1,
            unit: "",
            preparation: "boiled",
            category: "produce",
            substitutes: [],
          },
        ],
      },
    };

    render(<RecipeDetails />);

    expect(screen.getByText("Tomatoes (1)")).toBeInTheDocument();
  });

  it("strikes through completed steps", () => {
    mockAgentState = {
      ...recipeState,
      current_step: 1,
    };

    render(<RecipeDetails />);

    expect(screen.getByText("Cook the pasta until al dente.")).toHaveClass(
      "line-through",
    );
    expect(screen.getByText("Stir in the sauce.")).not.toHaveClass(
      "line-through",
    );
  });
});
