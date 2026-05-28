import { createContext, useContext, useState } from "react";
import type { RecipeAgentState } from "@/types/recipe";

export interface RecipeContextValue {
  context: {
    pending: boolean;
    error: string | null;
    threadId: string | null;
    runId: string | null;
    state: RecipeAgentState | null;
  };
  setContext: (newContext: RecipeContextValue) => void;
}

const defaultContextValue: RecipeContextValue = {
  context: {
    pending: false,
    error: null,
    threadId: null,
    runId: null,
    state: null,
  },
  setContext: () => {},
};

export const RecipeContext = createContext<RecipeContextValue | undefined>(
  defaultContextValue,
);

export function useRecipeContext(): RecipeContextValue {
  const context = useContext(RecipeContext);

  if (!context) {
    throw new Error(
      "useRecipeContext must be used within a RecipeContext provider",
    );
  }

  return context;
}

export function RecipeContextProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [context, setContext] =
    useState<RecipeContextValue>(defaultContextValue);

  return (
    <RecipeContext.Provider value={{ ...context, setContext }}>
      {children}
    </RecipeContext.Provider>
  );
}
