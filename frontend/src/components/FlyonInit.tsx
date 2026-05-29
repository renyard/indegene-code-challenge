"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    HSStaticMethods?: {
      autoInit: (collection?: string | string[]) => void;
    };
  }
}

export function FlyonInit() {
  useEffect(() => {
    import("flyonui/flyonui").then(() => {
      requestAnimationFrame(() => {
        window.HSStaticMethods?.autoInit("overlay");
      });
    });
  }, []);

  return null;
}
