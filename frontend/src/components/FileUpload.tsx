import { useMutation } from "@tanstack/react-query";
import * as Form from "@radix-ui/react-form";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { useId, useState } from "react";
import { useRecipeContext } from "@/lib/RecipeContext";
import { upload } from "@/lib/api/upload";
import { LoadingSkeleton } from "./LoadingSkeleton";

export function FileUpload({
  accept,
  className,
}: {
  accept?: string;
  className?: string;
}): React.JSX.Element {
  const inputId = useId();
  const [fileName, setFileName] = useState("No file selected");
  const { context, setContext } = useRecipeContext();

  const mutation = useMutation({
    onError: (error) => {
      setContext((currentContext) => ({
        ...currentContext,
        pending: false,
        error: error.message,
      }));
    },
    onMutate: () => {
      setContext((currentContext) => ({
        ...currentContext,
        pending: true,
        error: null,
      }));
    },
    onSuccess: (result) => {
      setContext({
        pending: false,
        error: null,
        threadId: result.threadId,
        runId: result.runId,
        state: result.state,
      });
    },
    mutationFn: async (formData: FormData) => {
      return upload(formData);
    },
  });

  const { error, isError, isPending } = mutation;

  if (isPending) {
    return <LoadingSkeleton />;
  }

  return (
    <form
      className={`flex flex-col items-center justify-center ${className}`}
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        await mutation.mutateAsync(formData).catch(() => {
          // Error handling is done in onError, so we can ignore it here
        });
      }}
    >
      <h1 className="text-4xl font-bold m-8">Recipe Assistant</h1>
      <p className="text-center text-lg text-gray-600">
        Upload a recipe file to start chatting with the recipe agent. Supported
        formats: .txt, .pdf.
      </p>

      <div className="m-8 b-4">
        <input
          id={inputId}
          type="file"
          name="file"
          className="input max-w-sm"
          aria-label="file-input"
          accept={accept}
          onChange={(event) => {
            setFileName(
              event.currentTarget.files?.[0]?.name ?? "No file selected",
            );
          }}
        />
      </div>

      {isError && <Text color="red">{error?.message}</Text>}

      <button name="submit" type="submit" className="btn btn-primary">
        Upload
      </button>
    </form>
  );
}
