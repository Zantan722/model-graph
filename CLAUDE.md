# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概要

Model Graph：離線的軟體工程圖編輯器（架構／工作流程／循序／資料流／狀態／C4），React 19 + TypeScript + 手寫 SVG。
同一份 React 編輯器同時是網頁版與 Electron renderer；桌面版可透過 Claude Code／Codex CLI 讀專案資料夾產圖。

`package.json` 的 name 仍是 `site-creator-vinext-starter`，那是起始模板遺留，不是專案定位。

## 常用指令

```sh
npm ci                      # 或 npm run install:ci（需經 npm 啟動，會驗證 vinext 可執行）
npm run dev -- --host 127.0.0.1   # 網頁版 http://localhost:5173
npm run build               # vinext build
npm run lint                # 見下方說明：目前不是乾淨的 gate
npx tsc --noEmit            # 只涵蓋 .ts/.tsx/.mts；desktop/ tests/ scripts/ 的 .cjs/.mjs 不在內
```

`npm run lint` 目前**不會全綠**，不要把它當成通過／不通過的判準：

- 它只忽略 `dist` 與 `.next`，所以 `npm run desktop:build` 之後會連 gitignore 的 `desktop-app/` 建置產物一起 lint，多出約 1000 筆雜訊。
- `eslint-config-next/typescript` 禁止 `require()`，但 `desktop/`、`tests/`、`scripts/` 本來就是 CommonJS，因此有約 170 筆 `@typescript-eslint/no-require-imports` 既有錯誤。

實際可用的把關是 `npx tsc --noEmit`（乾淨）加上跑過 `tests/`。改動後請比對 lint 輸出有無**新增**問題，而不是看總數。

桌面版：

```sh
npm run desktop:build       # vite build + scripts/prepare-desktop.mjs → 產生 desktop-app/
npm run desktop:start       # build 後啟動 Electron（無 HMR，改碼要重跑）
npm run desktop:smoke                    # 真 renderer 操作測試
npm run desktop:smoke -- --smoke-report  # 含專案報告流程
npm run desktop:pack / npm run desktop:dist   # 輸出到 release/
```

### 測試

**沒有測試框架、沒有 runner、沒有彙總指令。** `tests/` 下 19 個檔案各自是 top-level script，使用 `node:assert/strict`，成功時 `console.log('... passed')`。
`package.json` 只有 `test:desktop`（= `node tests/desktop.test.cjs`）。

- 跑單一測試 = 跑單一檔案：`node tests/puml.test.mjs`。**沒有任何檔案讀 `process.argv`**，所以沒有 `--filter`、沒有測試名稱參數；「跑一個測試」的最小粒度就是一個檔案。
- 一定要在 repo root 執行（測試用 cwd 相對路徑）。
- 跑全部：`for f in tests/*.test.mjs tests/*.test.cjs; do node "$f" || break; done`
- **有 6 個 `.cjs` 測試需要先 `npm run desktop:build`**（`views`／`discovery`／`repo-analysis`／`selected-ipc`／`live-report`／`selective-live-report`）：它們 `require('../desktop-app/diagram-parser.cjs')`，而 `desktop-app/` 是 gitignore 的建置產物，乾淨 clone 上不存在。
- 只有明確啟用才會呼叫真實模型，且只送合成 repo：
  `MODELGRAPH_LIVE_TEST=1 node scripts/test-live-views.cjs`（可加 `MODELGRAPH_TEST_PROVIDER=claude`）

`.mjs` vs `.cjs` 的分界：`.mjs` 測 `lib/` 的 TypeScript（用 esbuild 在記憶體中打包後 `import()` data URL，因為 package 是 ESM 而 node 不能直接載 `.ts`）；`.cjs` 測 `desktop/` 的 CommonJS 主程序模組（可直接 `require`，部分還會 monkey-patch `Module._load` 來 stub `electron`）。

## 架構

### 資料模型（`lib/`）

`lib/graph.ts` 是畫布資料的唯一真相：`Graph = {nodes, edges, notes, evidence?}` — 註解與 AI 來源引用都放在 graph 內，所以會隨匯出／匯入一起來回。
`parseGraph()` 是**唯一驗證閘門**（referential integrity、長度上限、150 節點／500 關係／500 註解／1 MB）。所有變更路徑都要經過它：畫布編輯、PUML 匯入、JSON 匯入、AI 局部合併。

`lib/diagram-types.ts` 是圖表類型登錄表。`diagramKeys` 共 **9 個畫布 key**：五種圖各一個，C4 再依 `levels`（Context/Container/Component/Code）拆成四個獨立畫布。目前的畫布 key 是 `diagram === 'c4' ? level : diagram`；切換類型只換 key，不做任何轉換。

### PUML（`lib/puml.ts`）

手寫的 PlantUML 子集 parser／serializer，沒有相依 PlantUML。
**關鍵不變式：拓撲一律來自真正的 PUML 本文。** `importPuml` 會先濾掉所有 `'` 註解行才判斷圖種與解析；`' @modelgraph-node/-edge/-note/-evidence` 只作為 id、kind、座標等編輯器屬性的預設值。手動改文字中的名稱與箭頭會生效，附加註解不會蓋回去。

### 三個執行環境共用 `lib/`

`lib/` 是平台無關的純邏輯，是唯一被三處共用的程式碼：

1. 網頁 renderer — `app/layout.tsx` + `app/page.tsx`（vinext）
2. Electron renderer — `desktop/renderer.tsx`（6 行，`import Home from '../app/page'`）
3. Electron 主程序 — `scripts/prepare-desktop.mjs` 用 esbuild 把 `lib/puml.ts` 打包成 `desktop-app/diagram-parser.cjs`，讓 `views.cjs` 的 `validateDiagram` 用同一套 parser 檢查模型輸出

**編輯器 UI 在 `app/`，不在 `desktop/`。** 桌面能力是執行期特徵偵測（`Boolean(window.modelGraphAI)`），不是 build flag，所以同一份 bundle 兩邊都能跑。

### Electron（`desktop/`，全部 CommonJS）

| 檔案 | 角色 |
|---|---|
| `main.cjs` | 視窗、選單、`modelgraph` protocol handler、內建 smoke 測試驅動 |
| `protocol.cjs` | `resolveAsset()` — `modelgraph://app/` 的白名單，只放行 `index.html` 與 `assets/<name>.{js,css,woff2,png,svg}` |
| `preload.cjs` | 唯一的 `contextBridge` 出口：`window.modelGraphAI` |
| `ai-ipc.cjs` | 所有 `ai:*` IPC handler |
| `ai.cjs` | CLI 探測／spawn、資料夾掃描、檔案讀取、`attachEvidence` |
| `repo-analysis.cjs` / `generate-views.cjs` / `views.cjs` | 候選探索、逐圖產生、圖種與 PUML 檢核 |
| `report-store.cjs` / `puml-files.cjs` | userData 持久化、原生 PUML 開檔存檔 |

Renderer 鎖定：`contextIsolation`、`sandbox`、無 nodeIntegration、封鎖 navigation/window-open/webview、權限一律拒絕，且 CSP 的 `connect-src 'none'` 讓 renderer **完全不能發網路請求**——所有對外行為都走 IPC。
每個 IPC handler 都會檢查 sender 必須是目前視窗的 main frame 且 URL 恰為 `modelgraph://app/`，並在主程序重新驗證所有參數。

**信任模型**：repo 的檔名與內容一律當成不可信資料。CLI 以純文字轉換器方式使用——無工具權限、空的暫存 cwd（`claude` 用 `--safe-mode --tools ''`，`codex` 用 read-only sandbox 並關閉全部工具），檔案一律由 App 自己讀。模型回傳的路徑、行號、引用都會對照實際檔案內容重新驗證後才儲存。

### 改動時務必同步的清單

- **新增／修改 IPC channel** → 四處要一起改：`desktop/preload.cjs`、`desktop/ai-ipc.cjs`、`lib/desktop-ai.ts` 的 `declare global` 契約，必要時還有下一項。
- **新增 `desktop/*.cjs` 檔案** → 必須同時加進 `scripts/prepare-desktop.mjs` 的複製清單**與** `electron-builder.yml` 的 `files:` 清單。漏掉任一個會靜默出貨壞掉的 App。
- **`desktop-app/` 與 `release/` 是建置產物且已 gitignore，絕不直接編輯。**

### 持久化

瀏覽器與 Electron renderer 走同一份程式碼（renderer 在 `modelgraph://app` 這個 secure origin 上，localStorage 存在 Electron 的 userData profile，與瀏覽器不共用）。**沒有 storage 抽象層**，`lib/workspace.ts` 的 `Pick<Storage,'getItem'>` 參數只是為了測試。

localStorage keys：`model-graph-v2`（9 個畫布）、`model-graph-v1`（唯讀舊資料，惰性遷移且永不覆寫）、`model-graph-recovery-<uuid>`、`modelgraph-diagram-drafts-v1`、`modelgraph-flow-library-v1`、`modelgraph-ai-provider`。
存檔 debounce 300 ms，`pagehide`/`beforeunload` 時 flush；讀取失敗的 key 會進 `problems` 並**整體暫停自動儲存**，原始資料保留不覆寫。

Electron 另外以原子寫入（`.tmp` + rename、mode 0600）存在 `app.getPath('userData')`：`last-project-report.json`、`project-reports/<id>.json`、`project-sources/<id>.json`、`project-contexts/<id>.json`。**絕對路徑只存在主程序的 `project-contexts/`，renderer 永遠只傳 ID，不能指定任何路徑。**

Undo/redo 在 `app/page.tsx`，是 `useRef<Record<string, Graph[]>>` 的 history/future 堆疊，以 `activeFlow || key` 分開，上限 50 筆。沒有 store、沒有 context、沒有 reducer——所有狀態都在 `Home` 這一個元件內。

## 慣例

- **程式碼風格極度緊湊**：單行函式本體、運算子旁不留空白、一行塞多個宣告。新增程式碼請比照鄰近檔案，不要自行「排版美化」既有程式碼。
- **UI 字串一律繁體中文；程式碼註解用英文，且只寫 rationale**（例如 `lib/puml.ts` 的 "Comments carry editor-only properties, never replace parsed topology"），不寫「這行在做什麼」。
- **`app/` 與 `lib/` 一律用相對匯入（`'../lib/graph'`），不要用 `@/`。** `desktop/vite.config.ts` 沒有設定 alias，`@/` 會讓 Electron build 壞掉。`@/*` 只給未使用的 shadcn 腳手架用。
- **`aria-label` 是跨程序契約，不只是無障礙屬性。** Electron 選單透過 `webContents.executeJavaScript` 依 `aria-label` 點擊 renderer 的控制項（`desktop/main.cjs` 的 `clickControl`）：`匯入 JSON 或 PUML`、`匯出 PNG`／`匯出 JPG`／`匯出 SVG`／`匯出 JSON`、`專注模式`。改名會讓選單靜默失效。
- **smoke 測試同樣以中文按鈕文字與 `aria-label` 定位元素**（`產生圖表`、`圖表描述`、`產圖提供者`、`關閉 PUML 編輯器`、`Flow 關係` 等），且會 `.click()` 被 `display:none` 隱藏的元素——收合 UI 時只能隱藏，不能 unmount。改這些字串會弄壞 `npm run desktop:smoke`。
- **README 才是測試索引，不是 `package.json`。** 新增測試要把 `node tests/x.test.*` 加進 README 對應的「## 驗證」區塊；release notes 會記錄測試檔數（0.6.0 寫的「18 組」對應當時 `tests/` 的檔案數，新增測試時要一起更新）。
- 版本說明放 `docs/releases/<semver>.md`（`## 更新` / `## 安裝` / `## 驗證與限制`），驗證紀錄放 `docs/validation/<version>-<slug>.{md,json}`。文件慣例是**明確寫出沒驗證到什麼**（未簽章、未在 Windows 實機驗證、合成 repo 不代表任意生產 repo）。
- 記錄一次 live 執行 = 用 `MODELGRAPH_LIVE_TEST=1` 跑 `scripts/test-live-views.cjs` → 把輸出 JSON 存成 `tests/fixtures/` 的 fixture → 寫 `docs/validation/` → 確認離線重播測試仍通過。

## 未使用的 starter 腳手架（不要當成正式架構）

以下都是 vinext starter 遺留，實際 App **零引用**（`grep` 可確認）：

- `components/ui/**`（shadcn@4.17.0 原樣 vendored）、`hooks/use-mobile.ts`、`lib/utils.ts` 的 `cn()` — 編輯器完全沒用到。**UI 是 `app/globals.css` 的手寫 CSS**，Tailwind 雖然裝了且被 import，但畫面不靠它。
- `db/`（`schema.ts` 是空 stub）、`drizzle/`（`_journal.json` entries 為空，從未產生 migration）、`drizzle.config.ts`、`npm run db:generate`。
- `app/chatgpt-auth.ts`（OpenAI Sites header 認證）、`build/sites-vite-plugin.ts`。
- `npm start`（wrangler dev on Cloudflare Workers）、`examples/d1/`。`.openai/hosting.json` 是 `{"d1":null,"r2":null}`，所以連 binding 都沒註冊。
- `next.config.ts` 是空設定，也沒有 `next dev`／`next build`；`next` 只是 vinext/RSC 與 `eslint-config-next` 的相依。

出貨的是**完全離線的 Electron App**（`electron-builder.yml` 排除 `node_modules`，runtime 相依為零），沒有伺服器。
