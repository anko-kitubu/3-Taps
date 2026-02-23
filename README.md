# 3-Taps!

## GitHub Pages
- GitHub Pages: https://anko-kitubu.github.io/3-Taps/
- 依存関係のインストールは不要です。ブラウザで開くだけで利用できます。

## 概要
`3-Taps!` は、日付選択 -> 科目選択 -> 種別選択（課題 / 試験 / 補講）の 3 ステップで予定を登録できる学習タスク管理アプリです。

## 主要機能
- カレンダーで日付を選択し、予定を登録
- 予定種別（課題 / 試験 / 補講）を色付きドットで可視化
- 直近の予定（最大3件）を表示
- 科目の追加・削除（絵文字アイコン付き）
- 予定メモの追加・更新・削除
- `localStorage` への自動保存
- 2画面構成（`/` と `/friends`）

## 使い方（最短手順）
1. GitHub Pages の公開URLを開きます。  
   https://anko-kitubu.github.io/3-Taps/
2. `ホーム` 画面で日付を選び、科目ボタンを押して種別を選ぶと予定が追加されます。
3. 予定行をタップするとメモ編集、`削除` ボタンで予定削除ができます。

## 動作環境
- エンドユーザー: `localStorage` が有効なモダンブラウザ
- 開発者: Node.js 20 / npm

## 技術スタック
- Nuxt 4
- Vue 3
- TypeScript
- Vite
- Supabase JavaScript Client（`@supabase/supabase-js`）
- GitHub Actions（GitHub Pagesデプロイ）

## 注意点
- データ保存先はブラウザ `localStorage` のみです。ブラウザ変更・端末変更では引き継がれません。
- 共有機能はコード上に実装がありますが、現在は `shareEnabled = false` のため停止中です（UI表示のみ）。
- 科目を削除すると、その科目に紐づいた既存予定は残り、表示上は「（削除済み）」になります。

## ローカル開発（必要な場合のみ）
```bash
npm ci
npm run dev
```

## ライセンス
MIT License

## 作者
- GitHub: `anko-kitubu`
