import { SPEECH_RATES, type SpeechRate } from "../lib/speech";

interface Props {
  rate: SpeechRate;
  onChange: (rate: SpeechRate) => void;
}

export function SpeechRateSwitch({ rate, onChange }: Props) {
  return (
    <div className="speech-rate-switch">
      {SPEECH_RATES.map((r) => (
        <button
          key={r}
          className={rate === r ? "active" : ""}
          onClick={(e) => {
            e.stopPropagation();
            onChange(r);
          }}
        >
          {r}x
        </button>
      ))}
    </div>
  );
}
