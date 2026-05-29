import { useRecipeContext } from "@/lib/RecipeContext";
import { Recipe } from "@/types/recipe";

export function RecipeDetails(): React.JSX.Element {
  const { context } = useRecipeContext();
  const recipe: Recipe | null = context.state?.recipe || null;

  if (!recipe) {
    return <></>;
  }

  return (
    <div className="p-4 overflow-y-auto">
      <h2 className="text-2xl font-bold mb-4">{recipe.title}</h2>
      <div className="mb-4">
        <span className="inline-block bg-green-100 text-green-800 text-sm font-medium mr-2 mb-2 px-2 rounded-xl">
          {recipe.difficulty}
        </span>
        {recipe.dietary_tags.length > 0 && (
          <>
            {recipe.dietary_tags.map((tag, index) => (
              <span
                key={index}
                className="inline-block bg-blue-100 text-blue-800 text-sm font-medium mr-2 mb-2 px-2 rounded-xl"
              >
                {tag}
              </span>
            ))}
          </>
        )}
      </div>
      <p className="mb-4">{recipe.description}</p>
      <dl>
        <dt className="font-bold">Servings:</dt>
        <dd className="mb-2">{recipe.servings}</dd>
        <dt className="font-bold">Preparation Time:</dt>
        <dd className="mb-2">{recipe.prep_time_minutes} minutes</dd>
        <dt className="font-bold">Cooking Time:</dt>
        <dd className="mb-2">{recipe.cook_time_minutes} minutes</dd>
      </dl>
      <h3 className="text-xl font-semibold mb-2">Ingredients:</h3>
      <ul className="list-disc list-inside mb-4">
        {recipe.ingredients.map((ingredient, index) => (
          <li key={index}>
            {ingredient.name}{" "}
            {ingredient.quantity &&
              `(${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ""})`}
          </li>
        ))}
      </ul>
      <h3 className="text-xl font-semibold mb-2">Instructions:</h3>
      <ol className="list-decimal list-inside">
        {recipe.steps.map((step, index) => (
          <li key={index} value={step.step_number}>
            {step.instruction}
          </li>
        ))}
      </ol>
    </div>
  );
}
