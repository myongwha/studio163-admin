# studio163 — 管理画面 (studio163-admin)

公開サイト `studio163` のコンテンツ（単元・単語・文章・楽曲・歌詞行）を
追加/編集する管理画面です。同じ Supabase プロジェクトを参照します。

## 機能
- 🗂 **単元** … 追加/編集/削除、並び順
- 📒 **単語** … 単元に紐づけて登録（発音・意味・例文・カテゴリ）
- 💬 **文章** … 並べ替えクイズ用トークン付きで登録
- 🎵 **楽曲** … YouTube ID 登録、サムネ自動表示
- 🎬 **歌詞行** … 開始/終了秒・歌詞・意味・クイズ（穴埋め/意味）を行単位で設定
- 🔐 **認証** … Supabase Auth（管理者ログイン）。書き込みは RLS で `authenticated` のみ許可

## セットアップ
```bash
npm install
cp .env.local.example .env.local   # URL と anon キーを設定
npm run dev                         # http://localhost:6005
```

## 前提
1. 公開サイト側の `supabase/schema.sql` を実行済みであること（RLS ポリシー含む）
2. Supabase の **Authentication → Users** で管理者ユーザーを作成しておくこと
   - メール/パスワードでログインします

## 注意
- このアプリは anon キー + ログインユーザー（authenticated）で書き込みます。
  サービスロールキーはブラウザに置きません。
- 書き込み権限は `schema.sql` の RLS ポリシー「auth write」に依存します。

## ポート
- 管理画面: **6005**
- 公開サイト: 7778
