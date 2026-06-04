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

  if (!recipe) {
    return null;
  }

  return (
    <div className={className}>
      <div className="card mb-4 p-4">
        <div className="card-body">
          <h2 className="card-title">{recipe.title}</h2>
          <div className="flex flex-wrap gap-4">
            <dl className="flex flex-row items-center gap-2">
              {recipe.servings !== null && (
                <>
                  <dt>
                    <span className="sr-only">Servings</span>
                    <span className="icon-[tabler--users] size-4" aria-hidden />
                  </dt>
                  <dd className="mb-2 mr-4">
                    {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
                  </dd>
                </>
              )}
              {recipe.prep_time_minutes !== null && (
                <>
                  <dt>
                    <span className="sr-only">Preparation Time</span>
                    <span className="icon-[tabler--clock] size-4" aria-hidden />
                  </dt>
                  <dd className="mb-2 mr-4">
                    {formatMinutes(recipe.prep_time_minutes)}
                  </dd>
                </>
              )}
              {recipe.cook_time_minutes !== null && (
                <>
                  <dt>
                    <span className="sr-only">Cooking Time</span>
                    <span
                      className="icon-[tabler--cooker] size-4"
                      aria-hidden
                    />
                  </dt>
                  <dd className="mb-2 mr-4">
                    {formatMinutes(recipe.cook_time_minutes)}
                  </dd>
                </>
              )}
              {recipe.difficulty && (
                <>
                  <dt>
                    <span className="sr-only">Difficulty</span>
                    <span
                      className="icon-[tabler--antenna-bars-5] size-4"
                      aria-hidden
                    />
                  </dt>
                  <dd className="mb-2">
                    {capitalizeFirstLetter(recipe.difficulty)}
                  </dd>
                </>
              )}
            </dl>
          </div>
          <div className="mb-4">
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
          {recipe.description && <p>{recipe.description}</p>}
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
