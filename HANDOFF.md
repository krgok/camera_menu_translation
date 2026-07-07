# メニュー説明カメラ — 引き継ぎ資料

海外旅行中、読めない言語のメニューにカメラをかざすと、料理の説明(と発音)がその場に表示されるWebアプリ。

## 本番環境

- **アプリURL**: https://camera-menu-translation.vercel.app/ (Vercelの固定ドメイン)
- **GitHubリポジトリ**: https://github.com/krgok/camera_menu_translation (main ブランチ、Vercelと連携済み。pushすると自動デプロイ)
- **ホスティング**: Vercel(Hobbyプラン想定)。Deployment Protection(Vercel Authentication)はOFFにしてある(公開アクセス可)
- **DB/認証**: Supabase(ユーザーの既存プロジェクトに相乗り。project-ref: `uimdgwgrsfivklvbqllf`)。Google OAuthログイン設定済み

## アーキテクチャ

```
ブラウザ(Vite+React SPA)
  ├─ カメラ映像 or 写真アップロード → canvasで1024px以下にリサイズしJPEG化
  ├─ POST /api/analyze (要ログイン, Supabaseアクセストークン付き)
  │    → Vercel Serverless Function がGoogle Cloud Vision(OCR) / Gemini(画像認識) を呼び出し
  │    → 料理名+原文+発音記号(IPA)+位置(box)だけを高速に返す(説明文はまだ生成しない)
  ├─ 結果を静止画の上にマーカー表示(番号の丸)。タップで詳細パネルを開く
  ├─ タップ時に POST /api/explain (要ログイン) → その項目だけ説明文をGeminiで生成
  └─ 保存ボタン → Supabase Postgres の saved_items テーブルに書き込み(RLSで本人のみ閲覧可)
```

APIキー(Google Vision/Gemini)はサーバー側(Vercel環境変数)のみに置き、クライアントには一切渡さない。

## 技術スタック

- フロントエンド: Vite + React + TypeScript(SPA、ルーティングなし、タブ切替のみ)
- バックエンド: Vercel Serverless Functions(`api/` ディレクトリ、`@vercel/node`)
- 認証・DB: Supabase(Auth: Google OAuth、Postgres + RLS)
- AI: Google Cloud Vision API(`TEXT_DETECTION`)、Gemini API(`gemini-2.5-flash`、`thinkingConfig.thinkingBudget: 0`で高速化)

## 主要ファイル

```
api/
  analyze.ts         POST /api/analyze — 認証チェック→Vision/Gemini並列実行→items+warningsを返す
  explain.ts         POST /api/explain — 単一項目の説明文を遅延取得
  _lib/
    auth.ts          Supabaseアクセストークン検証(requireUser)
    vision.ts        Cloud Vision TEXT_DETECTION呼び出し、座標を0-1000に正規化
    gemini.ts        groupMenuItems(文字グループ化+翻訳+IPA) / identifyDishes(画像認識) / explainDish(説明生成)
    fetchWithTimeout.ts  AbortController付きfetch(各呼び出しにタイムアウトを設定しハング防止)

src/
  App.tsx                     画面全体の状態管理(ログイン、タブ、履歴、保存)
  hooks/
    useCamera.ts               getUserMedia管理、フレームキャプチャ
    useAnalyze.ts               /api/analyze呼び出し、経過秒数、warnings管理
    useExplain.ts               /api/explain呼び出し(タップ時の遅延取得)
  components/
    CameraView.tsx              カメラ/写真選択/スキャン/履歴ボタンなどの操作UI
    OverlayLayer.tsx / OverlayMarker.tsx   静止画上の番号マーカー表示(座標変換はlib/coords.ts)
    ItemList.tsx                 マーカー下の詳細リスト(原文+IPA+説明+保存ボタン)
    HistoryPanel.tsx             localStorage履歴の一覧
    AuthButton.tsx / SavedList.tsx   Googleログイン、保存済み一覧
  lib/
    types.ts     MenuItem等の型定義(explanationは任意=遅延取得のため)
    coords.ts     box(0-1000正規化)→画面座標への変換(object-fit: containを前提)
    image.ts      写真リサイズ、保存用サムネイル切り出し
    history.ts    localStorageへのスキャン履歴保存(直近5件)
    supabase.ts   Supabaseクライアント初期化、SavedItem型

supabase/
  schema.sql                新規構築時に実行するDDL一式
  migrations/
    001_add_thumbnail.sql       thumbnail_url列追加(実行済み)
    002_add_pronunciation.sql   pronunciation列追加(実行済み)
```

## 環境変数(値は書きません。VercelとSupabaseダッシュボードで確認)

`.env.example` 参照。Vercelの「Settings → Environment Variables」に設定済み。

| 変数名 | 用途 | 公開可否 |
|---|---|---|
| `VITE_SUPABASE_URL` | クライアントのSupabase接続先 | 公開OK(RLSで保護) |
| `VITE_SUPABASE_ANON_KEY` | クライアントのSupabase anonキー | 公開OK |
| `SUPABASE_URL` | サーバー側トークン検証用 | 非公開 |
| `SUPABASE_ANON_KEY` | サーバー側トークン検証用 | 非公開 |
| `GOOGLE_VISION_API_KEY` | Cloud Vision呼び出し | 非公開(絶対にクライアントに出さない) |
| `GEMINI_API_KEY` | Gemini呼び出し | 非公開(同上) |

## Supabase設定の注意点

- Google OAuthのクライアントID/シークレットは**Supabase Auth Providerの設定を変更しない**(既存プロジェクトの他アプリと共有のため)
- 新しいドメインを追加する場合は **Supabase → Authentication → URL Configuration → Redirect URLs** に追加する(Google Cloud Console側の変更は不要)
- `saved_items` テーブルはRLS有効。本人の行のみselect/insert/delete可能

## 実装済み機能

- カメラのライブプレビュー→タップでフレームキャプチャ、または写真ライブラリから選択
- 「文字を認識」「画像(料理写真)を認識」のチェックボックスで認識モード切替(両方同時も可、並列実行)
- スキャン結果を静止画上に番号マーカーで表示、タップで詳細(原文表記+IPA発音記号+タップ時に取得する説明文)
- 解析中の経過秒数表示、失敗時は同じ写真での再解析ボタン
- 直近5件のスキャン結果をlocalStorageに保持し「履歴」から復元
- Googleログイン(Supabase Auth)
- 保存機能: 料理名・原文・IPA・説明・言語・該当箇所のサムネイル画像をSupabaseに保存、「保存済み」タブで一覧・削除
- **博物館モード**(アプリモード `menu | museum`、ヘッダー下のセグメントコントロールで切替、localStorage `app-mode` に永続化):
  - Geminiプロンプトを分岐(展示物・解説パネルのグループ化/展示物・美術品の画像認識/翻訳でなく歴史的背景の要約説明)
  - 参照リンク: Geminiには**Wikipedia記事名だけ**返させ、サーバー側でWikipedia検索URL(`Special:Search?...&go=Go`)を組み立てる(URL直接生成はリンク切れを幻覚するため)
  - 音声読み上げ: Web Speech API(`src/lib/speech.ts`、ja-JP)。ItemList/SavedListに🔊ボタン
  - 保存に `mode` / `reference_links` 列を追加(`supabase/migrations/003_add_mode_references.sql`。**デプロイ前にSupabase SQL editorで実行必須**——未実行だと保存insertが失敗する)
  - 履歴エントリにも `appMode` を記録、復元時にモードも復元

## これまでに踏んだ地雷(同じ轍を踏まないためのメモ)

1. **`createClient("", "")` は同期的に例外を投げる** → Reactツリー全体が空白になる。`src/lib/supabase.ts` でプレースホルダー値にフォールバックして回避済み
2. **`package.json` の `"type": "module"`** により、Vercel Node Functionsは相対importに `.js` 拡張子が必須(`ERR_MODULE_NOT_FOUND`で発覚)。`api/` 配下は全て `./foo.js` 形式で統一済み
3. **Vercel Deployment Protection** がデフォルトでONだと外部から一切アクセスできない(WebFetchも失敗)。Settings → Deployment Protectionで解除済み
4. **Gemini 2.5-flashはデフォルトでthinkingを使い遅い** → `thinkingConfig: {thinkingBudget: 0}` で解消
5. **`Promise.all`は1つ失敗すると全部失敗** → `Promise.allSettled`に変更し、部分成功を返すように
6. **Google OAuthの自動化ログインは弾かれる**(Google側のbot対策でブラウザ自動操作からのログインがハングする)。動作確認は必ず実機/手動で

## 未実装・提案止まりの項目

fable5によるレビューで提案されたが未着手:
- **苦手食材/アレルギーの警告フラグ**(ローカル設定→プロンプトに追加するだけの小規模タスク)

検討済みだが意図的に見送り:
- 非同期ジョブ化/ポーリング(Vercel Hobby + 共有Supabaseでは過剰)
- Gemini単独への一本化(Vision併用の座標精度の方が優れるため見送り)
- 全画像のSupabase Storage常時保存(無料枠を圧迫するためサムネイルのみに限定)

## ローカル開発

```bash
npm install
cp .env.example .env   # 値を埋める
npm run dev             # http://localhost:5173 (フロントのみ、/apiは動かない)
vercel dev               # /api込みで動作確認する場合
```

型チェック: `npx tsc -b` / ビルド: `npm run build` / Lint: `npx oxlint`
