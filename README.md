# 敬語禁止交流会 点数表（keigo counter）

交流会で「敬語を使ってしまった回数」を、参加者全員の端末でリアルタイムに共有するカウンターです。
同じルーム名（またはリンク）を開いた人の画面に、ニックネームとカウントが数秒で反映されます。

## 構成

| ファイル | 役割 |
| --- | --- |
| `public/index.html` | アプリ本体（ビルド不要の 1 ファイル） |
| `netlify/functions/room.mjs` | ルーム状態 API（Netlify Functions） |
| `netlify/functions/lib/handle.mjs` | API の本体。保存先を差し替えられる純粋なハンドラ |
| `netlify/functions/lib/state.mjs` | 受信データの検証・正規化 |
| `netlify.toml` | Netlify の配信設定 |
| `test/` | API のテストとローカル確認用サーバ |

保存先は **Netlify Blobs**（ストア名 `keigo-rooms`、キーはルーム名）。データベースの用意や環境変数の設定は不要です。

## API

| メソッド | パス | 内容 |
| --- | --- | --- |
| `GET` | `/api/room?room=MERIT` | ルームの現在の状態を返す（未作成なら `{"state":null}`） |
| `PUT` | `/api/room?room=MERIT` | 状態を保存する。`rev` が既存以下なら `409` で最新状態を返す |

書き込みは `rev`（版番号）による楽観ロックです。複数人が同時に押しても、クライアントが最新版を読み直して操作を当て直すため、カウントが消えません。ルーム名は `A-Z 0-9 -` の 10 文字までに正規化され、参加者は 8 人・名前 14 文字・カウント 9999 までをサーバ側で丸めます。

## Netlify へのデプロイ

1. Netlify にログインし、**Add new site → Import an existing project → GitHub** を選ぶ
2. このリポジトリと、公開したいブランチを選択する
3. ビルド設定は `netlify.toml` が読まれるのでそのまま進める
   - Build command: `npm ci --omit=dev || npm install --omit=dev`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. **Deploy site** を押す

Netlify Blobs は追加設定なしで有効になります。CLI から出す場合は次の通りです。

```bash
npm install -g netlify-cli
netlify login
netlify init      # 既存サイトに繋ぐ場合は netlify link
netlify deploy --build --prod
```

## ローカルで動かす

```bash
npm install
npm run dev       # http://localhost:8888
npm test          # API のテスト
```

`npm run dev` は本番と同じ API ハンドラを、保存先だけメモリに差し替えて動かします。ブラウザのタブを 2 つ開くと同期の挙動を確認できます。

## 使い方

- 上部の「ルーム」欄にイベントごとの合言葉（例: `MERIT`、`0829`）を入れる
- 「リンクをコピー」で `?room=...` 付きの URL を配り、参加者に開いてもらう
- 敬語が出たら「＋」、押し間違いは「−」か「ひとつ戻す」
- 会が終わったら「全員リセット」

通信できないときは端末内に保存して動き続け、復帰すると同期を再開します。

### 同期 ON / OFF

上部の「同期 ON」ボタンで、この端末の共有を切り替えられます。設定は端末ごとに保存され、再読み込みしても維持されます。

- **OFF**: 通信を完全に止め、この端末だけで数えます（他の端末の操作も入ってきません）。内容はブラウザに保存されるので、再読み込みしても残ります
- **ON に戻すとき**: オフの間にこの端末で変更していた場合だけ確認が出ます
  - OK → この端末の内容を共有ルームに反映する
  - キャンセル → 共有ルーム側の内容に合わせる（この端末の変更は破棄）
- オフの間は共有されないため、「リンクをコピー」は押せません

## 注意

ルームの中身はそのルーム名を知っている人なら誰でも見られます。名前欄は当日のニックネームだけにしてください。イベントごとにルーム名を変えると記録が混ざりません。
