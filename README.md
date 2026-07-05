# メニュー説明カメラ

海外のメニューにカメラをかざすと、文字/料理写真を認識して説明をその場に重ねて表示するWebアプリ。

## 構成

- フロントエンド: Vite + React + TypeScript
- バックエンド: Vercel Serverless Functions (`api/analyze.ts`) — Google Cloud Vision / Gemini のAPIキーを隠蔽するプロキシ
- 認証・保存: Supabase (Auth: Google OAuth, Postgres + RLS)

## 事前準備

1. **Google Cloud**: プロジェクトを作成し Vision API を有効化、APIキーを発行
2. **Gemini**: [Google AI Studio](https://aistudio.google.com/) でAPIキーを発行
3. **Supabase**: 既存プロジェクトに以下を追加
   - Authentication → Providers → Google を有効化(Google CloudでOAuthクライアントIDを発行し設定)
   - SQL Editor で [`supabase/schema.sql`](supabase/schema.sql) を実行

## ローカル開発

```bash
npm install
cp .env.example .env   # 値を埋める
npm run dev            # フロントエンドのみ (http://localhost:5173)
```

`/api/analyze` をローカルで動かして確認する場合は Vercel CLI を使う:

```bash
npm i -g vercel
vercel dev
```

## 環境変数

`.env.example` を参照。`VITE_` プレフィックスの変数はクライアントに埋め込まれる(Supabase anonキーはRLSで保護されるため公開して問題なし)。それ以外(Vision/Gemini APIキー等)はサーバー(Vercel Functions)側のみで使用され、クライアントには一切渡さない。

## デプロイ (Vercel)

1. GitHubにリポジトリを作成しpush
2. Vercelでリポジトリをインポート(Framework Presetは自動でViteを検出)
3. Vercelの Environment Variables に `.env.example` の全項目を設定
4. デプロイ後、本番URLを Supabase の Auth → URL Configuration の Redirect URLs に追加
5. スマホ実機でHTTPSの本番URLにアクセスし、カメラ・ログイン・保存の動作を確認

## 使い方

1. Googleでログイン
2. 「文字を認識」「画像(料理写真)を認識」のチェックボックスでモードを選択
3. カメラをメニューに向けて「スキャン」をタップ(通信のため数秒待つ)
4. 映像がフリーズし、認識箇所に説明が重ねて表示される。タップで詳細を開き「保存」で保存
5. 「保存済み」タブから過去に保存した説明を確認・削除できる
