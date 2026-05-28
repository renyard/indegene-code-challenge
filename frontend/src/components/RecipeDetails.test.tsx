import { render, screen } from "@testing-library/react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { RecipeDetails } from "@/components/RecipeDetails";
import { RecipeContext, type RecipeContextState } from "@/lib/RecipeContext";

const context: RecipeContextState = {
  pending: false,
  error: null,
  threadId: "thread-1",
  runId: "run-1",
  state: {
    document_text: "A simple recipe",
    current_step: 1,
    scaled_servings: null,
    checked_ingredients: [],
    cooking_started: false,
    recipe: {
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
      ],
    },
  },
};

function renderWithRecipeContext(children: ReactNode) {
  const setContext: Dispatch<SetStateAction<RecipeContextState>> = jest.fn();

  return render(
    <RecipeContext.Provider value={{ context, setContext }}>
      {children}
    </RecipeContext.Provider>,
  );
}

describe("RecipeDetails", () => {
  it("renders recipe details from context", () => {
    renderWithRecipeContext(<RecipeDetails />);

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
});
