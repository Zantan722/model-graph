# Model Graph

本機軟體工程圖編輯器原型，包含架構圖、工作流程圖、循序圖、資料流圖、狀態／生命週期圖，以及 C4 Model。React 19、TypeScript、SVG；使用 Vinext / Vite 開發伺服器。

## 啟動

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

開啟 http://localhost:5173 。資料僅儲存在目前瀏覽器的 localStorage，不含雲端同步。

## 操作

- 拖拉節點移動；右側圓點可拖到目標節點建立關係。也可按工具列連線按鈕，依序選起點、終點。
- 點選節點或連線，在屬性面板編輯。節點取得鍵盤焦點後，可用方向鍵移動。
- 選節點後切換「註解」，新增及解決討論。
- 使用移動畫布、縮放、符合畫面、復原及重做。
- 從「圖表類型」切換 Architecture、Workflow、Sequence、Data Flow、Lifecycle 與 C4 Model，每種圖保存獨立畫布。
- 工作流程支援處理步驟、條件判斷與分支；資料流支援來源、處理、資料庫與目的地；狀態圖支援事件與回到自身的重試轉移。
- 循序圖以生命線呈現參與者，可左右拖拉，訊息依順序排列；選取訊息可提前／延後、編輯名稱及切換請求／回傳樣式。
- 四個 C4 層級各有獨立畫布。JSON 包含圖表類型與目前畫布，請切換到對應類型／層級再匯入。
- 既有 v1 C4 本機資料會自動遷移到 v2，原始 v1 備份仍保留。
- Prompt 本機指令：`Browser → API → PostgreSQL` 取代目前圖，`新增 Redis` 加入節點。取代後可復原。

## 原型範圍

尚未接上 LLM，無法理解任意自然語言。各圖表類型提供可編輯的基礎表示法，尚未提供 Archify 的播放、路徑追蹤、動畫或圖片匯出；循序圖尚無 alt/loop 分組及啟動條。四層視圖目前沒有跨層父子關聯、邊界容器或 C4 語義驗證；Code 是可編輯節點圖，非完整 UML。註解保存在本機，尚未支援多人協作。資料清除前請匯出各層 JSON。

未來接 AI 時，可將 `applyPrompt` 替換為伺服器生成介面，將目前圖、選取節點及註解一併傳入；模型輸出必須經 `parseGraph` 驗證後才套用並加入復原歷史。API 密鑰應只在伺服器保存。

## 驗證

```sh
node tests/graph.test.mjs
npx tsc --noEmit
npm run build
```

視覺方向參考 https://github.com/tt-a1i/archify ，此原型使用自行實作的 SVG 編輯器，未使用 Archify 渲染引擎。

## PlantUML（PUML）輸入／輸出

點選頂部「PUML」，即可編輯目前畫布的 PlantUML 原始碼、開啟 `.puml` / `.plantuml` 檔案、解析檢查與套用，或下載原始碼。一般「匯入」按鈕也接受 PUML。

- 套用前顯示辨識類型、節點／關係數、錯誤行號與轉換提醒；有不支援的結構時，不能取代畫布。套用後可復原。
- 支援 sequence 的 participant／actor 等參與者、正反向訊息與回傳箭頭；component／database／rectangle／cloud 等宣告、別名與有向關係；state 宣告與 `[*]` 起終點；單一節點的行內／多行 note。
- activity 支援 `start`、`:步驟;`、`stop` / `end`、巢狀 `if (...) then (...) / else (...) / endif`、`while (...) is (...) / endwhile (...)`。
- C4 支援 Person、System、Container、Component、Db／Ext 常見巨集與 Rel 的位置參數。自訂巨集、命名參數與群組邊界尚未支援。
- 圖表類型可自動辨識，也能手動選擇。Data Flow 與一般 Architecture 常共用 PUML 語法，外部資料流檔案可手動指定 Data Flow。
- 匯出是標準化 PUML；工作流程使用 state 圖語法表示任意分支／迴圈。C4 使用 PlantUML 標準庫的 C4_Component（包含其他 C4 巨集），需使用含 C4 標準庫的 PlantUML。
- 名稱、箭頭與註解以真正的 PUML 語法輸出；節點座標、編輯器類型、ID 與註解已解決狀態附在 `' @modelgraph-*` 註解中，重新匯入可恢復。修改 PUML 的名称與關係會生效，附加資料不會覆蓋文字中的拓撲。
- 本機解析器不執行任何 include 或前處理程序。已知 C4 include 僅用來辨識類型；不讀取外部檔案或網址。
- 本版不是完整 PlantUML 編譯器：alt/loop/fork、巢狀 package／state／C4 boundary、任意 include、舊式 activity 等會阻擋套用。樣式／版面指令有明確提醒；原始一般註解、排版與樣式不保證保留。原始碼視窗可下載原文備份。

驗證 PUML 轉換：`node tests/puml.test.mjs`。測試覆蓋所有視圖往返、外部語法、分支迴圈、C4、字元跳脫、錯誤行號與手動修改。輸出的九份測試圖另以 PlantUML 1.2025.4 `-checkonly` 驗證。

語法參考：[PlantUML](https://plantuml.com/)、[C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML)。

## Electron 桌面版

桌面版與網頁版共用相同的 React 編輯器。介面與程式均打包在 App 裡，不需要 Node.js、Python、Java、網頁伺服器或網路才能執行已打包的 App。

開發者先安裝 Node.js 與依賴，再執行：

```sh
npm ci
npm run desktop:start
```

此指令會建置介面後啟動 Electron。修改原始碼後重新執行即可載入更新（目前不含桌面版 HMR）。網頁版仍使用 `npm run dev`。

打包目前作業系統：

```sh
npm run desktop:pack  # 產生可執行 App 目錄
npm run desktop:dist  # 產生安裝包／壓縮檔
```

輸出在 `release/`。macOS 預設產生 ZIP 與 DMG；Windows 設定為 NSIS、Linux 為 AppImage。建議分別在對應系統建置，其他系統的產物尚未在本專案實機驗證。macOS 若需明確指定架構：

```sh
npm run desktop:build
npx electron-builder --mac --arm64
# Intel Mac：npx electron-builder --mac --x64
```

目前為未簽署的本機測試版（mac.identity: null），沒有自動更新。要公開提供 macOS 安裝包，應另外設定自己的 Developer ID 簽署與 Apple 公證；Windows 也需另行設定發行者簽署。

桌面版資料存在 Electron 的使用者資料目錄，與瀏覽器的 localStorage 分開；既有網頁圖表請先匯出 PUML／JSON，再匯入 App。桌面「檔案 → 匯入圖檔」或 Cmd/Ctrl+O 可開啟匯入；PUML／JSON 下載會顯示系統存檔對話框。

```sh
npm run test:desktop
npm run desktop:build
npm run desktop:smoke
```

Smoke test 使用獨立暫存使用者資料目錄，檢查真實 Electron renderer、六類圖表、PUML 視窗、localStorage、secure context 與 Node.js 隔離，不會更動平常的圖檔。桌面介面透過受限的 `modelgraph://app/` 本機協定載入，只允許打包後的介面資源，renderer 不具 Node.js／任意檔案存取能力。

## 0.1.1 檢查與修補

修正版加入損壞資料保護、備份後恢复儲存、匯入內容限制、保留重做紀錄、PUML 未套用文字的離開提醒，以及合併自動儲存。完整結果、剩餘風險與優化順序見 [檢查報告](docs/REVIEW-2026-09-11.md)。額外回歸測試：`node tests/audit.test.mjs`。

## 0.4.0：有來源依據的主題式 Repo 分析

選擇 Codex CLI／Claude Code、選擇本機 repo 後，預設使用「主題式 Repo 分析 · 多 Story／Flow」。在同一個 Prompt 描述分析範圍，或留白交由模型探索。每個主題的 Story 會自動產生獨立圖表，不需要逐張重新下指令。

例如：「分析登入、訂單與背景同步，分別整理成功、失敗與重試情境。以循序圖為主，標註來源與未知事項。」

流程分成以下階段：

1. **專案地圖**：閱讀 README、入口設定與架構文件，再依 repo 內容建立具體主題與調查問題。
2. **主題探索**：模型可以反覆要求讀檔與文字搜尋，追查入口、被呼叫函式、文件與測試。App 執行限定在已選 repo 清單的 read/search 操作，CLI 不直接取得專案 shell 權限。
3. **Story 整理與審查**：按主題整理有依據的情境，再核對主題歸屬、重複與引用內容。每步都必須引用本次讀取的有效檔案行號，程式碼片段從來源快照擷取。
4. **多圖產生與修正**：每個 Story 自動產生一份 PUML，使用與畫布相同的解析器驗證。語法失敗會帶著診斷修正一次；仍失敗則保留草稿與錯誤，不丟掉其他已完成圖。
5. **主題報告**：主要工作區按主題展示多份 Flow，能直接預覽、下載 PUML，或將指定 Flow 帶回畫布與 Prompt 修改。

進度顯示目前主題、讀取檔案、搜尋與產圖階段。完成結果逐步寫入 Electron userData 的 `last-project-report.json`，並保留 `project-reports/<report-id>.json` 檔案。取消或中途中斷時保留已完成結果；下次啟動可恢復上次報告。可下載含全部主題、引用及 PUML 的 JSON 報告。

### 範圍與限制

分析不設 240 KB 總量、64 KB 單檔、60 檔、掃描數量或目錄深度門檻。模型按主題讀取來源，不把所有程式碼一次拼成同一張泛用圖；模型上下文與記憶體容量仍會限制實際可處理的資料。

為避免無限模型迴圈，單次專案分析最長 30 分鐘，每個主題最多 12 輪探索；無新增來源也會停止並標示缺口。搜尋以每頁 40 個命中回傳，可分頁或縮小範圍；這不是檔案總量限制。最多 12 個主題，每個主題最多 6 個可讀 Story；不為湊數捏造情境。未完成、無證據及失敗會明確標示，不宣稱完整 repo/runtime 覆蓋。

支援 UTF-8 程式碼、Markdown、TXT、JSON、YAML、PUML 等文字；不解析 PDF／Word／圖片。跳過依賴、建置產物、`.git` 等隱藏資料與常見憑證檔，允許 `.github` 工作流程文件。`token-service.ts` 等業務程式不會只因名稱含 token 就被忽略。路徑／符號連結驗證及憑證樣式檢查仍保留；固定排除規則尚未解析自訂 .gitignore，不能保證排除所有敏感內容。

來源指紋是讀取快照的 SHA-256。檔案與行號存在、語法可解析，不等於 AI 的業務解讀已被證明；主題報告保留不確定事項、分析缺口與略過來源供核對。

### CLI 設定與額度

首次預設 Codex，之後記住所選提供者，按鈕與進度標示實際使用者。先在終端機安裝與登入 CLI，再用模型設定檢查。路徑可自訂、模型可指定。切換提供者會清空另一套 CLI 的模型與路徑，不會在失敗時自動改用 Claude。

標準 Codex 登入可沿用；為隔離工具，Codex 忽略使用者 config.toml／規則並使用 read-only，Claude 使用 safe mode 與空工具清單。分析由 App 提供限定的讀取／搜尋迴圈，不是開放終端機執行。需要支援這些旗標的 CLI 版本。專案分析包含多次模型請求，使用所選 CLI 帳號額度。

瀏覽器版無本機 CLI 橋接。Windows 的 npm .cmd 啟動器尚未支援，本次打包及桌面驗證為 macOS Apple Silicon。

### 編輯、流程庫與其他模式

「修改／產生單張指定圖表」保留精準修改單一 Flow 的能力。「本機規則」是離線的箭頭文字模式，不分析 repo。圖表支援架構、工作流程、循序、資料流、狀態及 C4；PUML 匯入匯出保持相容，仍非完整 PlantUML AST。

流程庫可另存編輯快照（最多 20 份／2 MB）及匯入匯出備份，與自動保存的完整主題報告分開。畫布可逐步定位現有連線，不把清單順序當作真實執行時序。

本版參考 [Archify](https://github.com/tt-a1i/archify) 的來源依據与主題導覽概念，使用 Model Graph 自己的分析器、PUML 驗證與畫布，未嵌入 Archify renderer 或宣稱具備其所有動畫／分享能力。

### 驗證

`node tests/repo-analysis.test.cjs` 驗證多輪讀取／搜尋、主題審查、四份獨立 Flow、語法修正、取消保留與報告原子儲存。`node tests/source-limits.test.cjs` 驗證大型來源不截斷。

先執行 `npm run desktop:build`，再用 `npm run desktop:smoke` 驗證編輯器，或 `electron desktop-app --smoke-test --smoke-report` 驗證主題報告恢復、四張圖的預覽及帶回 Prompt。測試使用獨立 userData，不修改個人資料。

實際模型測試需明確開啟：`MODELGRAPH_LIVE_TEST=1 node scripts/test-live-analysis.cjs`。只會傳送已提交的合成測試 repo，會消耗所選 CLI 額度；驗證至少兩個主題、四份有效 Flow，且登入／結帳故事不混入另一主題。

本次實際 Codex 驗證完成 **2 個主題、5 份不同且可解析的 Flow**。收據在 [docs/validation/0.4.0-codex-live.json](docs/validation/0.4.0-codex-live.json)，可用 `node tests/live-report.test.cjs` 離線重播檢查來源指紋、引用片段與圖表。這是合成 repo 的實測，不等於所有專案的語意正確性保證。

## 畫布自動同步

主題分析中，每完成一份通過 PUML 檢查的 Flow，就會自動切到畫布顯示；不必等待整份報告結束。畫布的「已完成 Flow」選單可切換各主題的圖表，原始圖與來源仍保存在主題報告。單張產圖也會直接套用，未通過檢查的結果保留供修正。

手動編輯、復原、切換 Flow 或開啟 PUML 編輯器時會暫停自動同步，避免打斷修改。按「自動同步：暫停」可恢復並顯示最新完成的 Flow；每次套用都可復原。恢復上次報告時不會覆寫已保存的畫布。畫布編輯可另存流程庫，主題報告中的 AI 原始 Flow 不會隨手動編輯改寫。
