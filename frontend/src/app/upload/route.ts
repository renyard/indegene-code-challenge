const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0 || file.name === "") {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    const backendResponse = await fetch(
      `${backendUrl.replace(/\/$/, "")}/upload`,
      {
        method: "POST",
        body: formData,
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
