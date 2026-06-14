import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { generateRecipeImage } from "@/lib/api/recipeImage";
import { formatStep } from "@/lib/formatStep";
import { useRecipeAgent } from "@/lib/useRecipeAgent";
import { IngredientsList } from "./IngredientsList";

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) {
    return "Not specified";
  }

  return `${minutes} min${minutes !== 1 ? "s" : ""}`;
}

export function RecipeDetails({
  className = "",
}: {
  className?: string;
}): React.JSX.Element | null {
  const { agentState } = useRecipeAgent();
  const { current_step: currentStep, recipe } = agentState;

  const recipeImageQuery = useQuery({
    queryKey: ["recipe-image", recipe],
    queryFn: () => {
      if (!recipe) {
        throw new Error("No recipe available");
      }

      return generateRecipeImage(recipe);
    },
    enabled: recipe !== null,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (!recipe) {
    return null;
  }

  console.log({ recipeImageQuery });

  return (
    <div className={className}>
      <div className="card mb-4 p-4">
        <div className="card-body">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="size-28 shrink-0 overflow-hidden rounded-md bg-base-200 sm:size-32">
              {recipeImageQuery.data ? (
                <Image
                  src={recipeImageQuery.data.dataUrl}
                  alt={`Finished ${recipe.title}`}
                  width={128}
                  height={128}
                  unoptimized
                  className="size-full object-cover"
                />
              ) : (
                <>
                  {recipeImageQuery.isPending ? (
                    <div
                      className="size-full skeleton skeleton-animated"
                      aria-label="Generating recipe image"
                      role="img"
                    />
                  ) : null}
                </>
              )}
            </div>
            <div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="card-title min-w-0 flex-1">{recipe.title}</h2>
              </div>
              <div className="flex flex-wrap gap-4 py-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {recipe.servings !== null && (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <dt>
                        <span className="sr-only">Servings</span>
                        <span
                          className="icon-[tabler--users] size-4"
                          aria-hidden
                        />
                      </dt>
                      <dd>
                        {recipe.servings} serving
                        {recipe.servings !== 1 ? "s" : ""}
                      </dd>
                    </div>
                  )}
                  {recipe.prep_time_minutes !== null && (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <dt>
                        <span className="sr-only">Preparation Time</span>
                        <span
                          className="icon-[tabler--clock] size-4"
                          aria-hidden
                        />
                      </dt>
                      <dd>{formatMinutes(recipe.prep_time_minutes)}</dd>
                    </div>
                  )}
                  {recipe.cook_time_minutes !== null && (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <dt>
                        <span className="sr-only">Cooking Time</span>
                        <span
                          className="icon-[tabler--cooker] size-4"
                          aria-hidden
                        />
                      </dt>
                      <dd>{formatMinutes(recipe.cook_time_minutes)}</dd>
                    </div>
                  )}
                  {recipe.difficulty && (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <dt>
                        <span className="sr-only">Difficulty</span>
                        <span
                          className="icon-[tabler--antenna-bars-5] size-4"
                          aria-hidden
                        />
                      </dt>
                      <dd>{capitalizeFirstLetter(recipe.difficulty)}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div>
                {recipe.dietary_tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block bg-blue-100 text-blue-800 text-sm font-medium mr-2 mb-2 px-2 rounded-xl"
                  >
                    {tag}
                  </span>
                ))}
                {recipe.cuisine && (
                  <span className="inline-block bg-green-100 text-green-800 text-sm font-medium mr-2 mb-2 px-2 rounded-xl">
                    {recipe.cuisine}
                  </span>
                )}
              </div>
            </div>
          </div>
          {recipe.description && <p className="pt-4">{recipe.description}</p>}
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <IngredientsList />
        <div className="card flex-1 p-4">
          <div className="card-body">
            <h3 className="card-title">Steps:</h3>
            <ol className="list-decimal list-inside flex flex-col gap-4">
              {recipe.steps.map((step, index) => (
                <li
                  key={step.step_number}
                  value={step.step_number}
                  className={`${index < currentStep ? "line-through" : ""}`}
                >
                  {formatStep(step.instruction)}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
