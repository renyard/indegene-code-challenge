"use client";

import { useCallback, useEffect, useRef } from "react";

export function WakeLock(): null {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if (
      !("wakeLock" in navigator) ||
      document.visibilityState !== "visible" ||
      (wakeLockRef.current && !wakeLockRef.current.released)
    ) {
      return;
    }

    try {
      const sentinel = await navigator.wakeLock.request("screen");
      wakeLockRef.current = sentinel;

      sentinel.addEventListener(
        "release",
        () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null;
          }
        },
        { once: true },
      );
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    void requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [requestWakeLock]);

  return null;
}
