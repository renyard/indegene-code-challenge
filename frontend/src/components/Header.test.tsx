import { render, screen } from "@testing-library/react";
import { Header } from "@/components/Header";

describe("Header", () => {
  it("renders the title and modal launch buttons", () => {
    render(<Header />);

    expect(
      screen.getByRole("heading", { name: "Recipe Assistant" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "New Recipe" })).toHaveAttribute(
      "data-overlay",
      "#reload-modal",
    );
    expect(
      screen.getByRole("button", { name: "Start Cooking" }),
    ).toHaveAttribute("data-overlay", "#steps-modal");
  });

  it("keeps buttons in the DOM but visually hides them when requested", () => {
    render(<Header showButtons={false} />);

    expect(screen.getByRole("button", { name: "New Recipe" })).toHaveClass(
      "invisible",
    );
    expect(screen.getByRole("button", { name: "Start Cooking" })).toHaveClass(
      "invisible",
    );
  });

  it("renders the new recipe confirmation modal", () => {
    render(<Header />);

    expect(screen.getByRole("dialog", { hidden: true })).toBeInTheDocument();
    expect(screen.getByText("Start a New Recipe?")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" })[0]).toHaveAttribute(
      "data-overlay",
      "#reload-modal",
    );
    expect(
      screen.getByRole("button", { name: "Start New Recipe" }),
    ).toBeInTheDocument();
  });
});
