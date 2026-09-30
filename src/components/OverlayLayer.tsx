import { useEffect, useRef, useState } from "react";
import { containRect, boxToStyle } from "../lib/coords";
import type { MenuItem } from "../lib/types";
import { OverlayMarker } from "./OverlayMarker";

interface Props {
  capturedImage: string;
  items: MenuItem[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
}

export function OverlayLayer({
  capturedImage,
  items,
  activeIndex,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [containerSize, setContainerSize] = useState<{
    w: number;
    h: number;
  } | null>(null);

  // Track the container's size continuously (not just at image load) so
  // markers stay aligned after a phone rotation or window resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () =>
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rect =
    naturalSize && containerSize
      ? containRect(
          containerSize.w,
          containerSize.h,
          naturalSize.w,
          naturalSize.h,
        )
      : null;

  return (
    <div className="overlay-container" ref={containerRef}>
      <img
        src={capturedImage}
        alt="キャプチャした映像"
        className="overlay-frozen-image"
        onLoad={(e) => {
          const img = e.currentTarget;
          setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        }}
      />
      {rect &&
        items.map((item, i) => (
          <OverlayMarker
            key={`${item.name}-${i}`}
            index={i}
            style={boxToStyle(item.box, rect)}
            active={activeIndex === i}
            onSelect={() => onSelect(i)}
          />
        ))}
    </div>
  );
}
