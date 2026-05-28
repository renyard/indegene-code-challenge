import { useMutation } from "@tanstack/react-query";
import * as Form from "@radix-ui/react-form";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { useId, useState } from "react";
import { useRecipeContext } from "@/lib/RecipeContext";
import { upload } from "@/lib/api/upload";

export function FileUpload({ accept }: { accept?: string }): React.JSX.Element {
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

  const { data, error, isError, isPending } = mutation;

  if (data) {
    return <></>;
  }

  return (
    <Form.Root
      className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md items-center justify-center"
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        await mutation.mutateAsync(formData).catch(() => {
          // Error handling is done in onError, so we can ignore it here
        });
      }}
    >
      <Flex direction="column" gap="3" className="text-center">
        <h1 className="text-4xl font-bold">Recipe Chat</h1>
        <p>
          Upload a recipe file to start chatting with the recipe agent.
          Supported formats: .txt, .pdf.
        </p>

        <Form.Field name="file" className="m-8 b-4">
          <Flex direction="column" gap="2">
            <Flex
              align="center"
              gap="3"
              wrap="wrap"
              className="rounded border border-gray-300 p-3"
            >
              <Button asChild variant="soft" disabled={isPending}>
                <label htmlFor={inputId}>Choose file</label>
              </Button>

              <Box minWidth="0">
                <Text as="p" size="2" color="gray" truncate>
                  {fileName}
                </Text>
              </Box>
            </Flex>

            <Form.Control asChild>
              <input
                id={inputId}
                type="file"
                name="file"
                className="sr-only"
                aria-label="file-input"
                accept={accept}
                disabled={isPending}
                onChange={(event) => {
                  setFileName(
                    event.currentTarget.files?.[0]?.name ?? "No file selected",
                  );
                }}
              />
            </Form.Control>
          </Flex>
        </Form.Field>

        {isError && <Text color="red">{error?.message}</Text>}

        <Form.Field name="submit">
          <Form.Control asChild>
            <Button
              name="submit"
              type="submit"
              loading={isPending}
              disabled={isPending}
              size="4"
            >
              Upload
            </Button>
          </Form.Control>
        </Form.Field>
      </Flex>
    </Form.Root>
  );
}
