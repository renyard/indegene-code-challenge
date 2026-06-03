import { formatStep } from "@/lib/formatStep";

describe("formatStep", () => {
  it("removes leading step numbers", () => {
    expect(formatStep("1. Preheat the oven.")).toBe("Preheat the oven.");
    expect(formatStep("12. Serve immediately.")).toBe("Serve immediately.");
  });

  it("leaves unnumbered steps unchanged", () => {
    expect(formatStep("Stir until smooth.")).toBe("Stir until smooth.");
  });

  it("only removes numbering at the start of the step", () => {
    expect(formatStep("Cook for 2.5 minutes.")).toBe("Cook for 2.5 minutes.");
  });
});
