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
        aria-label={`${index + 1}番の項目${active ? "を閉じる" : "を開く"}`}
        aria-pressed={active}
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
