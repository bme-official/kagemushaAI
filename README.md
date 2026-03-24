# B'Me 問い合わせチャットbot MVP

Next.js / TypeScript / Supabase / OpenAI API を使った、設定駆動型の問い合わせチャットbotテスト実装です。

## 現在の実装範囲

- `/contact` に「チャットで相談する」導線を追加
- モーダル起動のチャットUI
- 通常メッセージ入力 + 項目別 structured input（email/tel/textarea/confirm など）
- 問い合わせ分類・緊急度判定・要約生成（ルールベース + OpenAI任意連携）
- 問い合わせ保存（Supabase未設定時はメモリ保存）
- 通知処理の抽象化（config切替で console / supabase_only）
- 管理確認ページ `/admin/inquiries`

## セットアップ

1. Node.js LTS をインストール
2. 依存関係をインストール
   - `npm install`
3. 環境変数を作成
   - `.env.example` をコピーして `.env.local` を作成
4. 開発サーバー起動
   - `npm run dev`

## 必須ではないが推奨の環境変数

- `OPENAI_API_KEY`（設定するとAI応答を利用）
- `OPENAI_MODEL`（既定: `gpt-4.1-mini`）
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NOTIFICATION_PROVIDER`（`console` or `supabase_only`）
- `NOTIFICATION_DESTINATION`（通知先ラベル表示用）
- `ADMIN_API_TOKEN`（`GET /api/inquiry` を本番で使う場合）
- `ADMIN_BASIC_AUTH_USER`（`/admin` のBasic認証）
- `ADMIN_BASIC_AUTH_PASS`（`/admin` のBasic認証）

本番運用時は最低限以下を設定してください。

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NOTIFICATION_PROVIDER=supabase_only`（または運用方針に合わせて設定）

## 設定変更ポイント

- キャラクター設定: `src/config/character.config.ts`
- 企業情報: `src/config/company.config.ts`
- 問い合わせ分類/収集ルール: `src/config/inquiry.config.ts`
- UI文言: `src/config/ui.config.ts`
- 通知設定: `src/config/notification.config.ts`

## Supabase テーブル（MVP推奨）

`inquiries` テーブルを作成し、以下のカラムを用意してください。

- `id` (text or uuid)
- `createdAt` (timestamptz)
- `sourcePage` (text)
- `sessionId` (text)
- `inquiryIntent` (text, nullable)
- `businessCategory` (text, nullable)
- `summary` (text)
- `rawMessages` (jsonb or text)
- `organization` (text, nullable)
- `name` (text, nullable)
- `email` (text, nullable)
- `phone` (text, nullable)
- `inquiryBody` (text, nullable)
- `budget` (text, nullable)
- `deadline` (text, nullable)
- `urgency` (text)
- `needsHuman` (boolean)
- `status` (text)

## 注意

- 現在のワークスペースは新規作成前提のため、実サイトに統合する際は既存 `/contact` のフォーム部分を温存したまま `ChatLauncher` を差し込んでください。
- Node.js が未導入の環境では、`npm install` と `npm run dev` は実行できません。

## 本番デプロイ手順（Vercel）

1. VercelでプロジェクトをImport
2. Project Settings > Environment Variables で以下を登録
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`（任意）
   - `OPENAI_API_KEY`（AI応答を使う場合）
   - `OPENAI_MODEL`（任意）
   - `NOTIFICATION_PROVIDER`
   - `NOTIFICATION_DESTINATION`（任意）
   - `ADMIN_BASIC_AUTH_USER`
   - `ADMIN_BASIC_AUTH_PASS`
3. Supabase SQL Editorで `supabase/migrations/0001_create_inquiries.sql` を実行
4. Vercelを再デプロイ
5. `/contact` から送信し、`inquiries` テーブルへの保存を確認

## セキュリティ注意（本番）

- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用です。`NEXT_PUBLIC_` で公開しないでください。
- `/admin` は `ADMIN_BASIC_AUTH_USER/PASS` を設定するとBasic認証が有効になります。

## WordPress 固定ページへの埋め込み（ショートコード）

WordPress 側に `wordpress/bme-ai-chat-shortcode.php` を導入し、固定ページで以下を記述してください。

```text
[kagemusha_ai_chat app_url="https://kagemusha-ai.vercel.app"]
```

表示仕様:

- ページ右下に AI チャットボタンを固定表示
- クリックでモーダルを表示
- モーダル内 iframe で `/embed/chat` を開いて会話

ショートコード属性（任意）:

- `app_url`（VercelのURL）
- `button_label`
- `modal_title`
- `iframe_path`（既定: `/embed/chat`）

## VRoid / 音声チャット拡張方針（次ステップ）

- `components/avatar` に VRoid 表示層を追加
- 音声入出力は WebRTC またはリアルタイムAPI層を分離
- 現在の iframe に `allow="microphone *"` を設定済み（音声機能に備えた下準備）
- まずはテキストチャット運用を安定化し、次にアバター同期、最後に音声対話を統合
