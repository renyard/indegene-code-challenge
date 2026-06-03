import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IngredientsList } from "@/components/IngredientsList";
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
    {
      name: "salt",
      quantity: null,
      unit: null,
      preparation: null,
      category: "spice",
      substitutes: [],
    },
  ],
  steps: [],
};

const recipeState: RecipeAgentState = {
  document_text: "A simple recipe",
  current_step: 1,
  scaled_servings: null,
  checked_ingredients: ["salt"],
  cooking_started: false,
  recipe,
};

describe("IngredientsList", () => {
  beforeEach(() => {
    mockAgentState = recipeState;
    mockSetAgentState.mockReset();
  });

  it("renders ingredients from agent state", () => {
    render(<IngredientsList />);

    expect(
      screen.getByRole("heading", { name: "Ingredients:" }),
    ).toBeInTheDocument();
    expect(screen.getByText("tomatoes (200 g)")).toBeInTheDocument();
    expect(screen.getByText("salt")).toBeInTheDocument();
    expect(screen.getByLabelText("Mark salt as checked")).toBeChecked();
  });

  it("updates checked ingredients when an ingredient is selected", async () => {
    const user = userEvent.setup();
    render(<IngredientsList />);

    await user.click(screen.getByLabelText("Mark tomatoes as checked"));

    expect(mockSetAgentState).toHaveBeenCalledWith(expect.any(Function));

    const updateAgentState = mockSetAgentState.mock.calls[0][0];
    expect(updateAgentState(recipeState)).toEqual({
      ...recipeState,
      checked_ingredients: ["salt", "tomatoes"],
    });
  });

  it("renders nothing when there is no recipe", () => {
    mockAgentState = {
      ...recipeState,
      recipe: null,
    };

    const { container } = render(<IngredientsList />);

    expect(container).toBeEmptyDOMElement();
  });
});
