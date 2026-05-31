"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RecipeContextProvider, useRecipeContext } from "@/lib/RecipeContext";
import { Chat } from "@/components/Chat";
import { FileUpload } from "@/components/FileUpload";
import { RecipeDetails } from "@/components/RecipeDetails";
import { Header } from "@/components/Header";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";

const queryClient = new QueryClient();

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <RecipeContextProvider>
        <CopilotKitProvider runtimeUrl="/copilotkit">
          <PageContent />
        </CopilotKitProvider>
      </RecipeContextProvider>
    </QueryClientProvider>
  );
}

function PageContent() {
  const { context } = useRecipeContext();

  return (
    <main className="flex min-h-screen max-h-screen flex-col gap-4 p-4">
      <Header className="w-full shrink-0" />
      {!context.threadId ? (
        <FileUpload accept=".txt,.pdf" className="w-full flex-1" />
      ) : (
        <section className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <RecipeDetails className="min-h-0 lg:basis-3/5" />
          <Chat className="min-h-0 lg:basis-2/5" />
        </section>
      )}
    </main>
  );
}
