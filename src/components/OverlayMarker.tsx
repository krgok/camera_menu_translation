interface Props {
  index: number;
  style: { left: number; top: number; width: number; height: number };
  active: boolean;
  onSelect: () => void;
}

export function OverlayMarker({ index, style, active, onSelect }: Props) {
  return (
    <>
      {active && (
        <div
          className="overlay-box"
          style={{
            left: style.left,
            top: style.top,
            width: style.width,
            height: style.height,
          }}
        />
      )}
      <button
        type="button"
        className={`overlay-marker ${active ? "active" : ""}`}
        style={{ left: style.left, top: style.top }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {index + 1}
      </button>
    </>
  );
}
