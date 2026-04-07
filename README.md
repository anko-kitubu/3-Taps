# 3-Taps!

## GitHub Pages
- GitHub Pages: https://anko-kitubu.github.io/3-Taps/
- 依存関係のインストールは不要です。ブラウザで開くだけで利用できます。

## 概要
`3-Taps!` は、日付選択 -> 科目選択 -> 種別選択（課題 / 試験 / 補講）の 3 ステップで予定を登録できる学習タスク管理アプリです。未ログインでも使用端末に保存して使えます。必要なときだけメールログインを有効化すると、スマホとPCで予定と科目を自動同期できます。

## 主要機能
- カレンダーで日付を選択し、予定を登録
- 予定種別（課題 / 試験 / 補講）を色付きドットで可視化
- 直近の予定を全件表示
- 科目の追加・削除（絵文字アイコン付き）
- 予定メモの追加・更新・削除
- 任意ログインによるスマホ/PC自動同期
- `IndexedDB` へのローカルキャッシュ
- ログアウト後も端末にデータを残して継続利用
- 2画面構成（`/` と `/friends`）

## 使い方
1. GitHub Pages の公開URLを開きます。  
   https://anko-kitubu.github.io/3-Taps/
2. そのまま予定を登録すれば、この端末の `IndexedDB` に保存されます。
3. 同期したいときだけ、`ホーム` 画面でメールログインを有効化します。
4. ログイン後は、同じメールアドレスでスマホとPCの予定・科目が自動同期されます。
5. 予定行をタップするとメモ編集、`削除` ボタンで予定削除ができます。

## 動作環境
- エンドユーザー: `IndexedDB` とメール受信が使えるモダンブラウザ
- 開発者: Node.js 20 / npm

## 技術スタック
- Nuxt 4
- Vue 3
- TypeScript
- Vite
- Supabase JavaScript Client（`@supabase/supabase-js`）
- GitHub Actions（GitHub Pagesデプロイ）

## 注意点
- 未ログイン時のデータはブラウザ `IndexedDB` に保存されます。
- ログイン後のデータは Supabase とブラウザ `IndexedDB` に保存されます。
- ログアウト後も、その端末では直前のデータを表示したまま利用できます。
- 同期には `NUXT_PUBLIC_SUPABASE_URL` と `NUXT_PUBLIC_SUPABASE_ANON_KEY` の設定が必要です。
- 友だち共有は個人同期とは分離しており、現在は案内ページのみです。
- 科目を削除すると、その科目に紐づいた既存予定は残り、表示上は「（削除済み）」になります。

## ローカル開発（必要な場合のみ）
```bash
npm ci
npm run dev
```

### Supabase セットアップ
1. `.env.example` を参考に `.env` を作成します。
2. Supabase SQL Editor で `docs/supabase-sync.sql` を実行します。
3. `NUXT_PUBLIC_SUPABASE_URL` と `NUXT_PUBLIC_SUPABASE_ANON_KEY` を設定します。

## ライセンス
MIT License

## 作者
- GitHub: `anko-kitubu`
