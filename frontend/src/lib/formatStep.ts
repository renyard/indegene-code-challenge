export function formatStep(step: string): string {
  // Remove leading numbering (e.g., "1. ", "2. ", etc.)
  const formattedStep = step.replace(/^\d+\.\s*/, "");
  return formattedStep;
}
