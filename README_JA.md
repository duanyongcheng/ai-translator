# AI Translator

[English](./README.md) | [中文](./README_CN.md) | 日本語

Gemini（デフォルト）または OpenAI を使用したモダンな Web 翻訳ツール。テキスト翻訳と音声合成に対応し、モデルと再生の設定が可能です。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/duanyongcheng/ai-translator&project-name=ai-translator&repository-name=ai-translator&env=GEMINI_API_KEY&envDescription=Gemini%20API%20key%20for%20translation%20and%20TTS)

## 機能

- 自動または手動でのソース言語選択、言語の入れ替え機能
- 翻訳結果のコピー、音声再生、ループ再生（回数・間隔設定可能）
- 翻訳履歴の永続化（最大 50 件）
- TTS 音声キャッシュ（IndexedDB）により、再生時の API 再リクエストが不要
- 設定モーダルでプロバイダー（Gemini/OpenAI）、モデル、ベース URL、API キーを切り替え可能。設定はローカルストレージに保存
- デバウンス翻訳、エラーメッセージ、React 19 + Vite + TypeScript + Tailwind CSS v4 によるミニマル UI

## クイックスタート

```bash
npm install
echo "GEMINI_API_KEY=<your_key>" > .env.local   # 環境変数ファイルを作成
npm run dev        # http://localhost:3000
```

### スクリプト

- `npm run dev` — Vite 開発サーバーをポート 3000 で起動（host `0.0.0.0`）
- `npm run build` — `dist/` に本番用バンドルを出力
- `npm run preview` — 本番ビルドをローカルでプレビュー

## 設定

- 環境変数：`.env.local`（gitignore 済み）に `GEMINI_API_KEY=<your_key>` を設定。Vite が `process.env.API_KEY` として公開
- ランタイム設定：設定モーダルで翻訳と TTS のプロバイダー、API キー、ベース URL、モデルを個別に設定可能。API キーを空にすると環境変数のデフォルト値を使用
- 音声処理：Gemini は PCM 形式でブラウザ内デコード、OpenAI は組み込みデコードを使用。再生は Web Audio API を利用

## プロジェクト構成

- `index.tsx` — React エントリーポイント、`App` をマウント
- `App.tsx` — メインレイアウト、翻訳フロー、言語切り替え、再生制御、履歴管理
- `components/` — UI コンポーネント（`LanguageSelector`、`TranslationBox`、`SettingsModal`、`HistoryPanel`）
- `services/aiService.ts` — Gemini/OpenAI の翻訳・TTS ロジック、音声再生ヘルパー
- `services/audioCache.ts` — TTS 音声の IndexedDB 永続キャッシュ（最大 50 件、LRU 削除）
- `services/audioUtils.ts` — PCM デコードヘルパー
- `constants.ts` — 対応言語リスト
- `types.ts` — 共有型と列挙型
- `vite.config.ts` — 環境変数読み込み、エイリアス、開発サーバー設定

## 使用上の注意

- ブラウザの音声出力権限を確認してください。各ペインに個別の再生/停止コントロールがあります
- ループ再生は翻訳結果に適用されます。出力パネルで回数と間隔を調整できます
- 時計アイコンをクリックして翻訳履歴にアクセス。履歴をクリックすると以前の翻訳を復元できます
- TTS 音声はローカルにキャッシュされます — 同じテキストの再生は API 呼び出し不要で即座に再生
- エラーはインラインバナーで表示されます。API キー/モデル/ベース URL を確認してください

## コントリビューション

- Conventional Commits に従ってください（例：`feat(scope): summary`、`fix(scope): …`）
- PR の説明は明確に、UI 変更にはスクリーンショットを添付し、環境/設定への影響を記載してください
- 手動テストチェックリスト：双方向翻訳、言語入れ替え、TTS 再生/停止、ループ再生、設定変更、リフレッシュして永続化を確認。自動テストを導入する場合は Vitest + React Testing Library を使用してください
