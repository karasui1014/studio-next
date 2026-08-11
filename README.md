# AI音楽部 Studio Next（Version 2）

AI音楽クリエイターが毎日最初に開くホーム画面。
「読む場所」ではなく「作る場所」として設計しています。

> **📘 仕様の正は [PROJECT_SPEC.md](./PROJECT_SPEC.md) です。**
> 開発を引き継ぐときは、まずそちらを読んでください。
> 実装を変更したら PROJECT_SPEC.md も同じコミットで更新します。

> 既存の Studio（Version 1、`~/AI Music Studio`）とは**別のプロジェクト**です。
> V1 は一切変更していません。数か月の並行運用を経て切り替える想定です。

---

## できること

| 画面 | 内容 |
|---|---|
| ホーム | 「今日は何を作りますか？」＋続きから＋今日のおすすめ |
| AI音楽ニュース | 28の情報源から自動収集・海外記事は日本語訳・注目ランキング5件 |
| カラスイ Picks | Substackの記事を自動取得。ホームは1本だけ／一覧はPicksページ |
| AIツール図鑑 | 実際に使ったAIツールの一覧 |
| 曲一覧・曲詳細 | 制作中の曲の管理（自動保存） |
| 制作ツール | 歌詞レビュー／MVアイデア／AIプロデューサー／プロンプト工房 |
| データ管理 | JSONで書き出し・読み込み（**無料のまま**） |
| プラン | Roleで管理（free / premium / master）。Studio直販とYouTubeメンバーシップの両方から |

---

## 開発

```bash
npm install
npm run dev     # http://localhost:5180
npm test        # 141件（V1から移植したロジックのテスト）
npm run build
npm run news    # ニュースを集めて public/content/news.json を更新
npm run picks   # Substackの記事を取り込んで public/content/picks.json を更新
```

---

## 設計の要：アプリとコンテンツの分離

```
src/                    アプリ（滅多に変わらない）
├── app/                ルーティング・シェル
├── core/               全機能が使う土台
│   ├── content/        コンテンツ取得・検証
│   ├── entitlement/    権限判定（useRole）
│   ├── storage/        曲・行動履歴・連続日数
│   └── ui/             cn / テーマ
└── features/           機能ごとに縦割り
    ├── home/ news/ picks/ songs/ tools/ tools-guide/ data/ plans/

public/content/         コンテンツ（毎日変わる）
├── news.json           GitHub Actions が1日4回更新（ニュース）
├── picks.json          GitHub Actions が1日4回更新（Substackの記事）
└── home.json           手で書く（今日のおすすめ・プロンプト・ツール図鑑・制作メモ）

scripts/collect-news.mjs   ニュース収集（外部ライブラリ0）
scripts/collect-picks.mjs  Substack記事の取り込み
```

**コンテンツ更新にアプリのビルドは要りません。** `public/content/home.json` を
編集するだけで、Picks・今日のおすすめ・プロンプト・ツール図鑑が変わります。

「今日のおすすめ」は `date` を書けばその日に必ず出て、書かなければ日替わりで
巡回します。毎日書かなくても毎日変わるので、運営が止まりません。

### Substack連携（カラスイ Picks）

```
Substackに記事を書く
   ↓  GitHub Actions が1日4回 RSS を取得
public/content/picks.json
   ↓
Studioのホームと「カラスイ Picks」に自動で出る
```

**ホームには「今日の1本」だけ出します。** 一覧は Picks ページに置き、
ホームからは「もっと見る」で移動します。ホームで迷わせないためです。

**Studioに本文は載せません。** 冒頭300文字までで、全文は Substack で読んでもらいます。
本文を写すと Substack の読者が育たず、YouTube・Substack・Studio が
一緒に育たなくなるためです。

Premium の価値は「本文の続き」ではなく、記事ごとの **制作メモ** に置いています。
`public/content/home.json` の `pickNotes` に、記事URLの `/p/` 以降をキーにして書きます。

```json
"pickNotes": {
  "aiip": {
    "note": "この記事のIPの考え方は、Studioの曲管理と相性が良いです。…",
    "prompts": ["p-lofi-drive"]
  }
}
```

`npm run picks` を実行すると、メモがまだ無い記事を教えてくれます。
別の刊行物を使う場合は環境変数 `SUBSTACK_FEED` で切り替えられます。

---

## 公開のしかた（GitHubのWeb画面から。ターミナルのpushは使いません）

公開後のURL: `https://karasui1014.github.io/studio-next/`

### ステップ1 — リポジトリを作る

1. GitHub にログインし、右上の **＋ → New repository**
2. リポジトリ名に `studio-next` と入力
3. **Public** を選ぶ（Pagesを無料で使うため）
4. **Create repository**

### ステップ2 — 中身をアップロードする

1. **uploading an existing file** をクリック
2. Finderで `AI音楽部 Studio Next` フォルダを開き、**中身をすべて選んでドラッグ＆ドロップ**
   - `src` `public` `scripts` `docs` `prototype` フォルダ
   - `index.html` `package.json` `package-lock.json` `postcss.config.js`
     `tailwind.config.js` `tsconfig.json` `tsconfig.app.json` `tsconfig.node.json`
     `vite.config.ts` `README.md` **`PROJECT_SPEC.md`**
   - **`node_modules` フォルダと `dist` フォルダは含めない**（自動生成されるため）
3. `.gitignore` は先頭がドットで隠しファイルのため、Finderからは見えません。
   無くても動作に支障はないので省いて構いません
4. 下の **Commit changes** を押す

### ステップ3 — 自動化の設定ファイルを作る

`.github` も隠しフォルダなので、GitHubの画面上で直接作ります。

1. **Add file → Create new file**
2. ファイル名の欄に、そのまま次を入力
   ```
   .github/workflows/deploy.yml
   ```
3. Macの `.github/workflows/deploy.yml` をテキストエディタで開き、**中身を全部コピーして貼り付け**
4. **Commit changes**
5. 同じ手順をもう一度、今度は `.github/workflows/update-content.yml` で繰り返す

### ステップ4 — 書き込み権限を与える

ここを飛ばすと自動更新が失敗します。

1. リポジトリの **Settings → Actions → General**
2. 一番下の **Workflow permissions**
3. **Read and write permissions** を選んで **Save**

### ステップ5 — ページを公開する

1. **Settings → Pages**
2. Source を **GitHub Actions** にする
3. **Actions** タブ → 左の **公開** → 右の **Run workflow**
4. 緑のチェックが付けば成功。数分後 `https://karasui1014.github.io/studio-next/` で開けます

### ステップ6 — ニュース自動更新を確認する

1. **Actions** タブ → 左の **コンテンツ自動更新** → 右の **Run workflow**
2. 緑のチェックが付けば成功です

以降は、コードを変更したときは **公開** ワークフローが、
ニュースは日本時間 **6:00 / 12:00 / 18:00 / 22:00** に **コンテンツ自動更新** が、
それぞれ自動で動きます。

ワークフローは2つに分かれています。

- `deploy.yml` … アプリのビルドと公開（コードを変更してアップロードしたとき）
- `update-content.yml` … ニュース・カラスイ Picksの収集（1日4回）

この2つを分けているので、**ニュースが更新されるたびにアプリを作り直す必要はありません**。

---

## データの扱い

- 制作データ（曲・歌詞・プロンプト・お気に入り・履歴）は**端末内のみ**に保存します
- 外部へ送信しません。アカウント登録もログインもありません
- **書き出しはいつでも無料でできます**。データを人質にする設計にはしません

Version 1 の開発憲章（サーバー・DB・ログイン禁止／データはユーザーのもの）を
そのまま引き継いでいます。

## 権限（Role）

権限は**価格ではなく Role** で管理します（`src/core/entitlement/role.ts`）。

| 入手経路 | 価格 | Role |
|---|---|---|
| Studio Premium（直販） | 980円 / 月 | `premium` |
| YouTube「Studio Premium利用権付き」 | 1,290円 / 月 | `premium` |
| Studio Master（直販） | 5,600円 / 月 | `master` |
| YouTube「Studio Master利用権付き」 | 5,600円 / 月 | `master` |
| YouTube「AI大好き部」 | 690円 / 月 | なし（応援用の段） |
| YouTube「『企業様向け』Aiで曲作りしたい部」 | 35,000円 / 月 | **なし**（Studioとは無関係の別商品） |

入手経路が違っても、最終的に同じ Role になります。加入プランに応じたキーを
貼るだけで権限が付き、**Studioで別途登録し直す必要はありません**。
画面側は必ず `useRole()` を通すので、将来サーバー方式へ移行しても
差し替えるのは `role.ts` だけです。

**価格の高さでRoleを決めません。** 35,000円の「企業様向け」は企業向け相談窓口という
別商品で、Studioの権限体系とは無関係です（→ `PROJECT_SPEC.md` §6）。

Discordは **Master のときだけ** 案内します。
**招待URLはこのリポジトリに書きません**（2026-08-08決定）。ここは Public なので、
書いた時点で誰でも入れてしまい、少人数制（30名）の前提が崩れます。
プラン画面には「公式LINEからご案内します」という文言だけを出し、
実際のURLはライセンスキーと同じく公式LINEから手動でお送りします。
