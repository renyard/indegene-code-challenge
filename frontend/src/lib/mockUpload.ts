import type { Recipe, UploadResponse } from "@/types/recipe";
import mockRecipe from "./mockRecipe.json";

const recipe = mockRecipe as Recipe;

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now().toString(36)}`;
}

export async function createMockUploadResponse(
  file: File,
): Promise<UploadResponse> {
  const recipeText = `Mock recipe parsed from ${file.name}`;

  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    threadId: createId("mock-thread"),
    runId: createId("mock-run"),
    state: {
      document_text: recipeText,
      recipe,
      current_step: 0,
      scaled_servings: null,
      checked_ingredients: [],
      cooking_started: false,
    },
    tools: [],
    context: [],
    forwardedProps: {},
    messages: [],
  };
}
