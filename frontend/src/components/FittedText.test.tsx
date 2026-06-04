import { act, render, screen } from "@testing-library/react";
import { FittedText } from "@/components/FittedText";

type ResizeObserverCallback = ConstructorParameters<typeof ResizeObserver>[0];

let containerWidth = 200;
let containerHeight = 120;
let resizeObserverCallback: ResizeObserverCallback | undefined;
let observeMock: jest.Mock;
let disconnectMock: jest.Mock;
let originalResizeObserver: typeof ResizeObserver | undefined;
let originalClientWidth: PropertyDescriptor | undefined;
let originalClientHeight: PropertyDescriptor | undefined;
let originalScrollWidth: PropertyDescriptor | undefined;
let originalScrollHeight: PropertyDescriptor | undefined;

const getFontSize = (element: HTMLElement) =>
  Number.parseInt(element.style.fontSize || "0", 10);

describe("FittedText", () => {
  beforeAll(() => {
    originalResizeObserver = global.ResizeObserver;
    originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    originalClientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight",
    );
    originalScrollWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollWidth",
    );
    originalScrollHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollHeight",
    );

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return this.tagName === "DIV" ? containerWidth : 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return this.tagName === "DIV" ? containerHeight : 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get() {
        return this.tagName === "P" ? getFontSize(this) * 4 : 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return this.tagName === "P" ? getFontSize(this) * 2 : 0;
      },
    });
  });

  beforeEach(() => {
    containerWidth = 200;
    containerHeight = 120;
    resizeObserverCallback = undefined;
    observeMock = jest.fn();
    disconnectMock = jest.fn();

    global.ResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
      resizeObserverCallback = callback;
      return {
        observe: observeMock,
        disconnect: disconnectMock,
        unobserve: jest.fn(),
      };
    }) as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    if (originalResizeObserver) {
      global.ResizeObserver = originalResizeObserver;
      return;
    }

    Reflect.deleteProperty(global, "ResizeObserver");
  });

  afterAll(() => {
    if (originalClientWidth) {
      Object.defineProperty(
        HTMLElement.prototype,
        "clientWidth",
        originalClientWidth,
      );
    }

    if (originalClientHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "clientHeight",
        originalClientHeight,
      );
    }

    if (originalScrollWidth) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollWidth",
        originalScrollWidth,
      );
    }

    if (originalScrollHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollHeight",
        originalScrollHeight,
      );
    }
  });

  it("renders the provided text", () => {
    render(<FittedText>Fold in the sauce.</FittedText>);

    expect(screen.getByText("Fold in the sauce.")).toBeInTheDocument();
  });

  it("sets the largest font size that fits inside the container", () => {
    render(<FittedText>Fold in the sauce.</FittedText>);

    expect(screen.getByText("Fold in the sauce.")).toHaveStyle({
      fontSize: "50px",
    });
  });

  it("refits text when the container is resized", () => {
    render(<FittedText>Fold in the sauce.</FittedText>);

    expect(observeMock).toHaveBeenCalledWith(
      screen.getByText("Fold in the sauce.").parentElement,
    );

    containerWidth = 500;
    containerHeight = 500;

    act(() => {
      resizeObserverCallback?.([], {} as ResizeObserver);
    });

    expect(screen.getByText("Fold in the sauce.")).toHaveStyle({
      fontSize: "96px",
    });
  });

  it("disconnects the resize observer on unmount", () => {
    const { unmount } = render(<FittedText>Fold in the sauce.</FittedText>);

    unmount();

    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it("still fits text when ResizeObserver is unavailable", () => {
    global.ResizeObserver = undefined as unknown as typeof ResizeObserver;

    render(<FittedText>Fold in the sauce.</FittedText>);

    expect(screen.getByText("Fold in the sauce.")).toHaveStyle({
      fontSize: "50px",
    });
  });
});
