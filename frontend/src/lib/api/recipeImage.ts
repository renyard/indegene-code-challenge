import type { Recipe, RecipeImageResponse } from "@/types/recipe";

export async function generateRecipeImage(
  recipe: Recipe,
): Promise<RecipeImageResponse> {
  const res = await fetch("/recipe-image", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ recipe }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Recipe image generation failed with status ${res.status}: ${errorText}`,
    );
  }

  const data = await res.json();

  return data;
}
