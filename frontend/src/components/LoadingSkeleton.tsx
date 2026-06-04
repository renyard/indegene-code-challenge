export function LoadingSkeleton(): React.JSX.Element {
  const ingredientRows = [
    { id: "ingredient-1", width: "w-4/5" },
    { id: "ingredient-2", width: "w-2/3" },
    { id: "ingredient-3", width: "w-3/4" },
    { id: "ingredient-4", width: "w-4/5" },
    { id: "ingredient-5", width: "w-2/3" },
    { id: "ingredient-6", width: "w-3/4" },
  ];
  const instructionRows = [
    { id: "instruction-1", width: "w-5/6" },
    { id: "instruction-2", width: "w-2/3" },
    { id: "instruction-3", width: "w-5/6" },
    { id: "instruction-4", width: "w-2/3" },
    { id: "instruction-5", width: "w-5/6" },
  ];
  const messageRows = [
    { id: "message-1", align: "items-start", width: "w-3/4" },
    { id: "message-2", align: "items-end", width: "w-2/3" },
    { id: "message-3", align: "items-start", width: "w-4/5" },
    { id: "message-4", align: "items-end", width: "w-1/2" },
  ];

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row"
      aria-busy="true"
      aria-label="Loading recipe and chat"
    >
      <div className="card min-h-0 overflow-y-auto p-4 lg:basis-3/5">
        <div className="card-body">
          <div className="card mb-4 p-4">
            <div className="skeleton skeleton-animated mb-4 h-8 w-3/5" />
            <div className="mb-4 flex flex-wrap gap-2">
              <div className="skeleton skeleton-animated h-6 w-20 rounded-xl" />
              <div className="skeleton skeleton-animated h-6 w-24 rounded-xl" />
              <div className="skeleton skeleton-animated h-6 w-16 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="skeleton skeleton-animated h-4 w-full" />
              <div className="skeleton skeleton-animated h-4 w-11/12" />
              <div className="skeleton skeleton-animated h-4 w-3/4" />
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-4 md:flex-row">
            <div className="card flex-1 p-4">
              <div className="space-y-3">
                <div className="skeleton skeleton-animated h-5 w-24" />
                <div className="skeleton skeleton-animated h-4 w-10" />
                <div className="skeleton skeleton-animated h-5 w-36" />
                <div className="skeleton skeleton-animated h-4 w-24" />
                <div className="skeleton skeleton-animated h-5 w-32" />
                <div className="skeleton skeleton-animated h-4 w-24" />
              </div>
            </div>

            <div className="card flex-1 p-4">
              <div className="skeleton skeleton-animated mb-4 h-6 w-32" />
              <div className="space-y-3">
                {ingredientRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <div className="skeleton skeleton-animated h-2 w-2 rounded-full" />
                    <div
                      className={`skeleton skeleton-animated h-4 ${row.width}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="skeleton skeleton-animated mb-4 h-6 w-32" />
            <div className="space-y-4">
              {instructionRows.map((row) => (
                <div key={row.id} className="flex items-start gap-3">
                  <div className="skeleton skeleton-animated h-5 w-5 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton skeleton-animated h-4 w-full" />
                    <div
                      className={`skeleton skeleton-animated h-4 ${row.width}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card flex min-h-0 flex-1 flex-col lg:basis-2/5">
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
          <div className="flex h-full flex-col justify-end gap-4">
            {messageRows.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${message.align}`}
              >
                <div
                  className={`skeleton skeleton-animated h-16 rounded-2xl ${message.width}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 p-4">
          <div className="skeleton skeleton-animated h-11 grow rounded-lg" />
          <div className="skeleton skeleton-animated h-11 w-11 shrink-0 rounded-full" />
        </div>
      </div>
    </section>
  );
}
