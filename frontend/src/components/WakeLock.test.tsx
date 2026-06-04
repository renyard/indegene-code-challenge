import { render, waitFor } from "@testing-library/react";
import { WakeLock } from "@/components/WakeLock";

function setVisibilityState(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: visibilityState,
  });
}

describe("WakeLock", () => {
  const originalWakeLock = navigator.wakeLock;
  const originalVisibilityState = document.visibilityState;

  beforeEach(() => {
    setVisibilityState("visible");
  });

  afterEach(() => {
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: originalWakeLock,
    });
    setVisibilityState(originalVisibilityState);
    jest.restoreAllMocks();
  });

  it("requests a screen wake lock while mounted and releases it on unmount", async () => {
    const sentinel = {
      released: false,
      addEventListener: jest.fn(),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const request = jest.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });

    const { unmount } = render(<WakeLock />);

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("screen");
    });
    expect(sentinel.addEventListener).toHaveBeenCalledWith(
      "release",
      expect.any(Function),
      { once: true },
    );

    unmount();

    expect(sentinel.release).toHaveBeenCalled();
  });

  it("does not request a wake lock when the page is hidden", async () => {
    const request = jest.fn();
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });
    setVisibilityState("hidden");

    render(<WakeLock />);

    await waitFor(() => {
      expect(request).not.toHaveBeenCalled();
    });
  });
});
