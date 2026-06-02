import { useRecipeContext } from "@/lib/RecipeContext";

export function IngredientsList(): React.JSX.Element {
  const { context, setContext } = useRecipeContext();
  const recipe = context.state?.recipe;

  if (!recipe) {
    return <></>;
  }

  return (
    <div className="card flex-1 p-4">
      <div className="card-body">
        <h3 className="card-title">Ingredients:</h3>
        <ul className="list-disc list-inside flex flex-wrap gap-4">
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
                    context.state?.checked_ingredients || [],
                  );
                  const ingredientKey = ingredient.name;

                  if (checked) {
                    checkedIngredients.add(ingredientKey);
                  } else {
                    checkedIngredients.delete(ingredientKey);
                  }

                  setContext((prevState) => {
                    if (!prevState.state) {
                      return prevState;
                    }

                    return {
                      ...prevState,
                      state: {
                        ...prevState.state,
                        checked_ingredients: Array.from(checkedIngredients),
                      },
                    };
                  });
                }}
                checked={
                  context.state?.checked_ingredients?.includes(
                    ingredient.name,
                  ) || false
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
