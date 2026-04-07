# AGENTS.md

このアプリは「1画面で3タップ完結」が根底です。ホームの主導線を圧迫する固定UIは禁止します。

## 最上位ルール
- UI変更は参照必須。スクショ、既存画面、Figma なしで新しいUIパターンを発明しない。
- 大きいUI変更は、実装前に配置と開き方を確認する。
- 同期UIは主導線の外に置く。
- 固定UI、浮遊UI、overlay は本文、CTA、下部ナビ、safe area と干渉させない。

## 作業ルール
- 外部調査はまず公式と一次情報を優先する。
- コード変更は差分量より構造の明快さを優先する。
- UI変更後は `typecheck`、`build`、見た目確認を行う。

## 詳細ルール
- UI全般: [docs/design/ui-rules.md](/C:/Github/3-Taps/docs/design/ui-rules.md)
- 同期UI: [docs/design/sync-ui.md](/C:/Github/3-Taps/docs/design/sync-ui.md)
