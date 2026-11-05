/** Turns a getUserMedia failure into an actionable Japanese message. */
export function cameraErrorMessage(e: unknown): string {
  const name = e instanceof DOMException || e instanceof Error ? e.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "カメラの使用が許可されていません。ブラウザのアドレスバー(または端末の設定)でカメラを許可するか、「写真を選択」から撮影済みの写真を使ってください";
    case "NotFoundError":
    case "OverconstrainedError":
      return "カメラが見つかりません。「写真を選択」から写真を使ってください";
    case "NotReadableError":
    case "AbortError":
      return "カメラを起動できません。他のアプリがカメラを使用中の可能性があります。閉じてからもう一度お試しください";
    default:
      return "カメラを起動できませんでした。「写真を選択」から写真を使ってください";
  }
}

/** Old browsers / non-HTTPS pages have no navigator.mediaDevices at all. */
export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export const CAMERA_UNSUPPORTED_MESSAGE =
  "このブラウザ/接続ではカメラを使えません(HTTPSのページで、新しいブラウザが必要です)。「写真を選択」から写真を使ってください";
