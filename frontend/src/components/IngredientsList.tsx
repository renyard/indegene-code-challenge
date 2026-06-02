import { useRecipeAgent } from "@/lib/useRecipeAgent";

export function IngredientsList(): React.JSX.Element {
  const { agentState, setAgentState } = useRecipeAgent();
  const recipe = agentState.recipe;

  if (!recipe) {
    return <></>;
  }

  return (
    <div className="card flex-1 p-4">
      <div className="card-body">
        <h3 className="card-title">Ingredients:</h3>
        <ul className="list-disc list-inside flex flex-col gap-4">
          {recipe.ingredients.map((ingredient, index) => (
            <li key={index} className="flex items-center gap-1">
              <input
                type="checkbox"
                className="checkbox"
                id={`defaultCheckbox${index}`}
                aria-label={`Mark ${ingredient.name} as checked`}
                onChange={(e) => {
                  const checked = e.target.checked;
                  const checkedIngredients = new Set(
                    agentState.checked_ingredients || [],
                  );
                  const ingredientKey = ingredient.name;

                  if (checked) {
                    checkedIngredients.add(ingredientKey);
                  } else {
                    checkedIngredients.delete(ingredientKey);
                  }

                  setAgentState((prevState) => {
                    if (!prevState) {
                      return prevState;
                    }

                    return {
                      ...prevState,
                      ...prevState,
                      checked_ingredients: Array.from(checkedIngredients),
                    };
                  });
                }}
                checked={
                  agentState.checked_ingredients?.includes(ingredient.name) ||
                  false
                }
              />{" "}
              <label
                className="label-text text-base"
                htmlFor={`defaultCheckbox${index}`}
              >
                {ingredient.name}{" "}
                {ingredient.quantity &&
                  `(${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ""})`}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
