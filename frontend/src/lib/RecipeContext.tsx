import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { RecipeAgentState } from "@/types/recipe";

export interface RecipeContextState {
  pending: boolean;
  error: string | null;
  threadId: string | null;
  runId: string | null;
  state: RecipeAgentState | null;
}

export interface RecipeContextValue {
  context: RecipeContextState;
  setContext: Dispatch<SetStateAction<RecipeContextState>>;
}

const defaultContextState: RecipeContextState = {
  pending: false,
  error: null,
  threadId: null,
  runId: null,
  state: null,
};

const defaultContextValue: RecipeContextValue = {
  context: defaultContextState,
  setContext: () => {},
};

export const RecipeContext =
  createContext<RecipeContextValue>(defaultContextValue);

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
  const [context, setContext] = useState<RecipeContextState>(
    defaultContextState,
  );

  return (
    <RecipeContext.Provider value={{ context, setContext }}>
      {children}
    </RecipeContext.Provider>
  );
}
