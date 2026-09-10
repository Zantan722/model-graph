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
