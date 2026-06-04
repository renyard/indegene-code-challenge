"use client";

import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Chat } from "@/components/Chat";
import { FileUpload } from "@/components/FileUpload";
import { Header } from "@/components/Header";
import { RecipeDetails } from "@/components/RecipeDetails";
import { StepsModal } from "@/components/StepsModal";
import { WakeLock } from "@/components/WakeLock";
import { RecipeContextProvider, useRecipeContext } from "@/lib/RecipeContext";

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
    <main className="flex h-dvh min-h-dvh max-h-dvh flex-col gap-4 p-4">
      <Header
        className="w-full shrink-0"
        showButtons={context.threadId !== null}
      />
      {!context.threadId ? (
        <FileUpload accept=".txt,.pdf" className="w-full flex-1" />
      ) : (
        <section className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className="-m-4 min-h-0 overflow-y-auto p-4 lg:basis-3/5">
            <RecipeDetails />
          </div>
          <Chat className="min-h-0 lg:basis-2/5" />
          <WakeLock />
        </section>
      )}
      <StepsModal />
    </main>
  );
}
