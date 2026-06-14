const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("recipe" in body) ||
    typeof body.recipe !== "object" ||
    body.recipe === null
  ) {
    return Response.json({ error: "No recipe provided" }, { status: 400 });
  }

  try {
    const backendResponse = await fetch(
      `${backendUrl.replace(/\/$/, "")}/recipe-image`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: {
        "content-type":
          backendResponse.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return Response.json(
      { error: `Could not reach recipe backend: ${message}` },
      { status: 502 },
    );
  }
}
