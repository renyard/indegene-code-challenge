import { render, waitFor } from "@testing-library/react";
import { FlyonInit } from "@/components/FlyonInit";

jest.mock("flyonui/flyonui", () => ({}));

describe("FlyonInit", () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

  beforeEach(() => {
    window.HSStaticMethods = {
      autoInit: jest.fn(),
    };
    globalThis.requestAnimationFrame = jest.fn(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    );
  });

  afterEach(() => {
    window.HSStaticMethods = undefined;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    jest.restoreAllMocks();
  });

  it("initialises Flyon overlays after the client module loads", async () => {
    render(<FlyonInit />);

    await waitFor(() => {
      expect(window.HSStaticMethods?.autoInit).toHaveBeenCalledWith("overlay");
    });
  });
});
