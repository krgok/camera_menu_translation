# メニュー説明カメラ

海外のメニューにカメラをかざすと、文字/料理写真を認識して説明をその場に重ねて表示するWebアプリ。

## 構成

- フロントエンド: Vite + React + TypeScript
- バックエンド: Vercel Serverless Functions (`api/analyze.ts`・`explain.ts`・`explain-batch.ts`・`rates.ts`) — Google Cloud Vision / Gemini のAPIキーを隠蔽するプロキシ。ログイン必須・入力上限・1日の回数制限つき
- 認証・保存: Supabase (Auth: Google OAuth, Postgres + RLS)

## 事前準備

1. **Google Cloud**: プロジェクトを作成し Vision API を有効化、APIキーを発行
2. **Gemini**: [Google AI Studio](https://aistudio.google.com/) でAPIキーを発行
3. **Supabase**: 既存プロジェクトに以下を追加
   - Authentication → Providers → Google を有効化(Google CloudでOAuthクライアントIDを発行し設定)
   - SQL Editor で [`supabase/schema.sql`](supabase/schema.sql) を実行(新規構築のみ。既存の場合は [`supabase/migrations/`](supabase/migrations/) を番号順に)
   - 利用回数の上限を使う場合は `migrations/004_api_usage_quota.sql`(手順は PR/ファイル冒頭のコメント)、`saved_items` の追加防御は `005_saved_items_hardening.sql`(任意)

## ローカル開発

```bash
npm ci
cp .env.example .env   # 値を埋める(.env はコミットしない)
npm run dev            # フロントエンドのみ (http://localhost:5173)
npm run lint && npm test && npm run build   # CI(.github/workflows/ci.yml)と同じ確認
```

テストは外部API・Supabaseをモックしており、APIキーは不要です。

`/api/analyze` をローカルで動かして確認する場合は Vercel CLI を使う:

```bash
npm i -g vercel
vercel dev
```

## 環境変数

`.env.example` を参照。`VITE_` プレフィックスの変数はクライアントに埋め込まれる(Supabase anonキーはRLSで保護されるため公開して問題なし)。それ以外(Vision/Gemini APIキー、`QUOTA_SECRET`、`ALLOWED_EMAILS` 等)はサーバー(Vercel Functions)側のみで使用され、クライアントには一切渡さない。

**公開リポジトリです。** APIキー・`service_role` キー・`QUOTA_SECRET` などの秘密、撮影した写真や保存データをコミット・Issue・PRに書かないでください(`.env*` は `.gitignore` 済み)。費用・悪用対策の詳細は [`docs/audit-2026-11.md`](docs/audit-2026-11.md)。

## デプロイ (Vercel)

1. GitHubにリポジトリを作成しpush
2. Vercelでリポジトリをインポート(Framework Presetは自動でViteを検出)
3. Vercelの Environment Variables に `.env.example` の全項目を設定
4. デプロイ後、本番URLを Supabase の Auth → URL Configuration の Redirect URLs に追加
5. **Google Cloud 側で API キーを制限**(Vision と Generative Language API のみ)し、日次クォータと予算アラートを設定
6. Vercel に `ALLOWED_EMAILS`(利用を許可するメール)を設定(未設定だと Google アカウントがあれば誰でも利用可)
7. スマホ実機でHTTPSの本番URLにアクセスし、カメラ・ログイン・保存の動作を確認

## 使い方

1. Googleでログイン
2. 「文字を認識」「画像(料理写真)を認識」のチェックボックスでモードを選択
3. カメラをメニューに向けて「スキャン」をタップ(通信のため数秒待つ)
4. 映像がフリーズし、認識箇所に説明が重ねて表示される。タップで詳細を開き「保存」で保存
5. 「保存済み」タブから過去に保存した説明を確認・削除できる
