"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RecipeContextProvider } from "@/lib/RecipeContext";
import { Chat } from "@/components/Chat";
import { FileUpload } from "@/components/FileUpload";

const queryClient = new QueryClient();

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <RecipeContextProvider>
        <main className="flex-1 p-4">
          <FileUpload accept=".txt,.pdf" />
        </main>
      </RecipeContextProvider>
    </QueryClientProvider>
  );
}
