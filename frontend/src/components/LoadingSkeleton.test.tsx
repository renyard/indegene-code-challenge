import { render, screen } from "@testing-library/react";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

describe("LoadingSkeleton", () => {
  it("marks the loading layout as busy", () => {
    render(<LoadingSkeleton />);

    const loadingRegion = screen.getByLabelText("Loading recipe and chat");

    expect(loadingRegion).toHaveAttribute("aria-busy", "true");
    expect(loadingRegion.tagName.toLowerCase()).toBe("section");
  });

  it("renders placeholder blocks for recipe and chat content", () => {
    const { container } = render(<LoadingSkeleton />);

    expect(container.querySelectorAll(".skeleton")).toHaveLength(48);
  });
});
