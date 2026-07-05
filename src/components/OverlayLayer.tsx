import { useRef, useState } from "react";
import { containRect, boxToStyle } from "../lib/coords";
import type { MenuItem } from "../lib/types";
import { OverlayItem } from "./OverlayItem";

interface Props {
  capturedImage: string;
  items: MenuItem[];
  onSave: (item: MenuItem) => void;
  savedNames: Set<string>;
}

export function OverlayLayer({
  capturedImage,
  items,
  onSave,
  savedNames,
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
    <div
      className="overlay-container"
      ref={containerRef}
      onLoad={undefined}
    >
      <img
        src={capturedImage}
        alt="キャプチャした映像"
        className="overlay-frozen-image"
        onLoad={(e) => {
          const img = e.currentTarget;
          setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
          setContainerSize({
            w: img.parentElement?.clientWidth ?? img.clientWidth,
            h: img.parentElement?.clientHeight ?? img.clientHeight,
          });
        }}
      />
      {rect &&
        items.map((item, i) => (
          <OverlayItem
            key={`${item.name}-${i}`}
            item={item}
            style={boxToStyle(item.box, rect)}
            onSave={onSave}
            saved={savedNames.has(item.name)}
          />
        ))}
    </div>
  );
}
