interface Props {
  originalText: string;
  name: string;
  onClose: () => void;
}

/**
 * Fullscreen "point and order" view: shows the original-language dish name
 * huge so the user can hold their phone up to restaurant staff. Tap
 * anywhere to close.
 */
export function PointOrderModal({ originalText, name, onClose }: Props) {
  return (
    <div
      className="point-order-modal"
      role="dialog"
      aria-label="指差し注文表示"
      onClick={onClose}
    >
      <div className="point-order-original">{originalText}</div>
      <div className="point-order-name">{name}</div>
      <div className="point-order-hint">タップで閉じる</div>
    </div>
  );
}
