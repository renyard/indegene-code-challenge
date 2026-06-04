import { useLayoutEffect, useRef, useState } from "react";

export function FittedText({ children }: { children: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [fontSize, setFontSize] = useState(48);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;

    if (!container || !text) return;
    if (text.textContent !== children) return;

    const fitText = () => {
      let low = 24;
      let high = 96;
      let best = low;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        text.style.fontSize = `${mid}px`;

        const fits =
          text.scrollHeight <= container.clientHeight &&
          text.scrollWidth <= container.clientWidth;

        if (fits) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      setFontSize(best);
    };

    fitText();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(fitText);
    observer.observe(container);

    return () => observer.disconnect();
  }, [children]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center"
    >
      <p
        ref={textRef}
        className="text-center leading-relaxed"
        style={{ fontSize }}
      >
        {children}
      </p>
    </div>
  );
}
