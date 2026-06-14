import type { Recipe, RecipeImageResponse } from "@/types/recipe";

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
      instruction: "Cook the pasta.",
      duration_minutes: 10,
      timer_label: "pasta",
      requires_attention: false,
      tips: [],
    },
  ],
};

const recipeImageResponse: RecipeImageResponse = {
  dataUrl: "data:image/png;base64,abc123",
  mimeType: "image/png",
  prompt: "food photo",
};

describe("generateRecipeImage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("posts the recipe to the local recipe image route", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(recipeImageResponse),
    });
    globalThis.fetch = fetchMock;
    const { generateRecipeImage } = await import("./recipeImage");

    await expect(generateRecipeImage(recipe)).resolves.toEqual(
      recipeImageResponse,
    );

    expect(fetchMock).toHaveBeenCalledWith("/recipe-image", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ recipe }),
    });
  });

  it("throws the backend error response when image generation fails", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue("missing key"),
    });
    globalThis.fetch = fetchMock;
    const { generateRecipeImage } = await import("./recipeImage");

    await expect(generateRecipeImage(recipe)).rejects.toThrow(
      "Recipe image generation failed with status 503: missing key",
    );
  });
});
