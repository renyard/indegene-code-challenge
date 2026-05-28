import { UploadResponse } from "@/types/recipe";
import { createMockUploadResponse } from "../mockUpload";

const USE_MOCK_UPLOAD =
  process.env.NEXT_PUBLIC_MOCK_UPLOAD === "true" ||
  process.env.NEXT_PUBLIC_MOCK_UPLOAD === "1";

export async function upload(formData: FormData): Promise<UploadResponse> {
  const file = formData.get("file") as File | null;

  if (!(file instanceof File) || file.size === 0 || file.name === "") {
    throw new Error("No file uploaded");
  }

  if (USE_MOCK_UPLOAD) {
    return createMockUploadResponse(file);
  }

  const res = await fetch("http://localhost:8000/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Upload failed with status ${res.status}: ${errorText}`);
  }

  const data = await res.json();

  return data;
}
