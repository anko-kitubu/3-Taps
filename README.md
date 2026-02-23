# 3-Taps! 課題管理アプリ（Nuxt版）

大学の授業・レポート・テストなど「やること」を日付ベースで管理するプロトタイプです。
Figmaで設計したUIを元に、Nuxt + Vue 3で実装しています。

---

## 主な機能

- 月間カレンダー（曜日見出し/前後月移動/当日強調）
- 日付選択でその日の予定を表示
- 科目アイコン → 種別（課題 / 試験 / 補講）で予定追加
- 予定の種類をカレンダーに色付きドットで表示
- 直近の予定を最大3件表示（今日の予定はハイライト）
- 科目の追加/削除（アイコン選択）
- `localStorage` に自動保存
  - `task-manager-tasks`
  - `task-manager-subjects`
- 2画面構成：ホーム(`/`) / 友だち(`/friends`)
  - 共有機能は現在未実装（表示のみ）

---

## 技術スタック

- Nuxt 4
- Vue 3
- TypeScript
- Vite
- @supabase/supabase-js（共有機能の試作に利用）

---

## 動作環境

- Node.js 18+

---

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev
```


---

## GitHub Pages デプロイ

- `master` ブランチへ push すると GitHub Actions で自動公開されます。
- GitHub 側で `Settings > Pages > Source` を `GitHub Actions` に設定してください。
- 公開URLは `https://anko-kitubu.github.io/3-Taps/` です。
- リポジトリ名を変更した場合、公開パス（`/3-Taps/` 部分）も変わります。
---

## ライセンス

このプロジェクトは `MIT License` のもとで公開しています。詳細は `LICENSE` を参照してください。
