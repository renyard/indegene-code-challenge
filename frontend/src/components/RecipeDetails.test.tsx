import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { RecipeDetails } from "@/components/RecipeDetails";
import { generateRecipeImage } from "@/lib/api/recipeImage";
import type { Recipe, RecipeAgentState } from "@/types/recipe";

const mockSetAgentState = jest.fn();
let mockAgentState: RecipeAgentState;

jest.mock("@/lib/api/recipeImage", () => ({
  generateRecipeImage: jest.fn(),
}));

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

const mockGenerateRecipeImage = jest.mocked(generateRecipeImage);

function renderRecipeDetails() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RecipeDetails />
    </QueryClientProvider>,
  );
}

describe("RecipeDetails", () => {
  beforeEach(() => {
    mockAgentState = recipeState;
    mockSetAgentState.mockReset();
    mockGenerateRecipeImage.mockResolvedValue({
      dataUrl: "data:image/png;base64,abc123",
      mimeType: "image/png",
      prompt: "food photo",
    });
  });

  it("renders recipe details from context", () => {
    renderRecipeDetails();

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

  it("renders the generated recipe image next to the title", async () => {
    renderRecipeDetails();

    expect(
      screen.getByRole("heading", { name: "Tomato Pasta" }),
    ).toBeInTheDocument();
    const image = await screen.findByRole("img", {
      name: "Finished Tomato Pasta",
    });

    expect(image).toHaveAttribute("src", "data:image/png;base64,abc123");
    expect(mockGenerateRecipeImage).toHaveBeenCalledWith(recipe);
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

    renderRecipeDetails();

    expect(screen.getByText("Tomatoes (1)")).toBeInTheDocument();
  });

  it("strikes through completed steps", () => {
    mockAgentState = {
      ...recipeState,
      current_step: 1,
    };

    renderRecipeDetails();

    expect(screen.getByText("Cook the pasta until al dente.")).toHaveClass(
      "line-through",
    );
    expect(screen.getByText("Stir in the sauce.")).not.toHaveClass(
      "line-through",
    );
  });

  it("omits timing fields when timing data is missing", () => {
    mockAgentState = {
      ...recipeState,
      recipe: {
        ...recipe,
        prep_time_minutes: null,
        cook_time_minutes: null,
      },
    };

    renderRecipeDetails();

    expect(
      screen.queryByText("Preparation Time", { selector: ".sr-only" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Cooking Time", { selector: ".sr-only" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("2 servings")).toBeInTheDocument();
    expect(screen.getByText("Easy")).toBeInTheDocument();
  });
});
