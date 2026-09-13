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

網頁版的本機規則不理解任意自然語言；Electron 桌面版可使用 Claude Code／Codex CLI（見下方說明）。各圖表類型提供可編輯的基礎表示法，尚未提供 Archify 的播放、路徑追蹤、動畫或圖片匯出；循序圖尚無 alt/loop 分組及啟動條。四層視圖目前沒有跨層父子關聯、邊界容器或 C4 語義驗證；Code 是可編輯節點圖，非完整 UML。註解保存在本機，尚未支援多人協作。資料清除前請匯出各層 JSON。

桌面 AI 回傳的 PUML 經解析檢查後才套用並加入復原歷史；來源讀取與 CLI 執行在 Electron 主程序處理。

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

## 先分析說明，再勾選產圖

1. 在 Electron 左側選擇 Codex CLI 或 Claude Code，並確認已登入。
2. 選擇「Repo 分析 · 先敘述再選圖」、分析圖種及 C4 層級，再指定 repo 資料夾。
3. 輸入需求或留白，按「分析並列出視圖說明」。此階段只分析來源、提出說明與審查，不呼叫 PUML 產圖。
4. 在「分析報告」閱讀每張建議的目的、範圍、摘要、分析內容及引用，勾選需要的圖。預設沒有勾選。
5. 按「產生所選 N 張圖」。只產生所選項目，未選的保留，已完成的不重跑。可稍後補選或重試失敗項目。

架構圖依總覽、子系統與有證據的部署／整合範圍拆分，說明元素責任及依賴，不強制拆成功／失敗 Story。C4 固定所選層級。流程／循序圖分析情境、資料流圖分析管線、狀態圖分析實體生命週期。模型不能因為覺得另一種圖較適合，就更改所選圖種；Prompt 決定範圍，選單決定類型。

例如選架構圖並輸入：「分析整體模組、登入子系統和訂單整合的責任與依賴，先列出各視圖說明。」或選循序圖並輸入：「整理登入與結帳的不同呼叫情境，包含有實作的拒絕分支。」小專案可只建議一張，不為湊數捏造視圖。

### 分析與來源

模型會先閱讀概覽，規劃調查主題，再透過 App 限定在 repo 清單內的 read/search 追查呼叫、模組、設定、文件及測試，最後整理及審查視圖描述。參考 Archify 的圖種分類、清楚視圖範圍、語意關係及來源核對原則；仍使用本專案的 PUML／SVG 編輯器，沒有換成 Archify 渲染引擎。

描述及完成圖表逐步保存於 Electron userData 的 `last-project-report.json` 與 `project-reports/<id>.json`。分析结束時，實際讀取的原文保存於 `project-sources/<id>.json`，只留在本機，不送到 renderer。稍後勾選時，主程序核對快照 SHA-256，僅將所選視圖引用的原文交給所選模型，不重新掃描或偷偷改用新的 repo 內容。要納入程式變更請重新分析。匯出報告包含引用片段與 PUML，不包含整份原始碼快照。

取消分析會保留已整理的描述；取消產圖會保留完成圖，尚未開始的回到未產生，執行中失敗項可重新勾選。來源快照缺失或損壞會要求重新分析，不會任意讀取替代資料夾。舊版 v1 報告讀取時轉成 v2 顯示，原檔不改寫；舊圖可繼續預覽，沒有快照的舊建議需重新分析才能批次產圖。

不設 240 KB 總量、64 KB 單檔、60 檔、掃描數量或目錄深度門檻。仍排除依賴／建置目錄、常見憑證、二進位與 repo 外路徑；不讀 symlink、不解析自訂 `.gitignore`，不支援 PDF／DOCX／圖片內容。模型上下文與記憶體仍有限制。每次分析或所選批次上限 30 分鐘、每主題探索最多 12 輪、最多 12 主題及每主題 6 份建議（上限不是目標數）；來源搜尋每頁 40 筆，可分頁。

### CLI 設定

Claude Code／Codex CLI 需自行安裝並登入。在 App 選提供者，按「檢查 CLI／登入」，必要時在模型設定指定執行檔及模型。提供者會記住；不會因 Claude 額度不足或 Codex 失敗而自動換提供者。模型留白使用 CLI 預設。

CLI 使用獨立暫存工作目錄及受限非互動模式，來源由 App 讀取。Codex 使用 `--ignore-user-config`、`--ignore-rules`、read-only sandbox 並關閉工具功能；依 CLI 的既有登入，忽略自訂 config 與 repo 指令。Windows 目前需要真正的 `.exe`，不執行 `.cmd` 包裝檔；Mac Apple Silicon 已驗證，Windows 尚未實機驗證。模型分析會使用所選服務的額度。

### 畫布與修正

每份所選圖通過 PUML 檢查後自動同步畫布，可用「已完成視圖」切換。手動編輯、復原、切換視圖或開啟 PUML 編輯器會暫停同步；可自行恢復。失敗草稿保留供修正。已完成的視圖可「帶回 Prompt 修改」，會帶入對應的結構或行為說明，走單張修改流程。

畫布編輯不會回寫報告原始圖；可另存流程庫（最多 20 份／2 MB）或匯出 PUML／JSON。沒有背景自動重產，也沒有雲端多人同步。

### 驗證

```sh
npm run desktop:build
node tests/views.test.cjs
node tests/repo-analysis.test.cjs
node tests/selected-ipc.test.cjs
node tests/report-canvas.test.mjs
npm run desktop:smoke -- --smoke-report
```

需要真實模型的驗證明確啟用，僅傳送合成測試 repo：

```sh
MODELGRAPH_LIVE_TEST=1 node scripts/test-live-views.cjs
```

此測試分別以架構、循序圖分析同一份測試 repo，核對分析階段零產圖、只替選取的一張生成，其餘仍為未產生。模型語意仍需人工核對；測試不是任意生產 repo 的正確性保證。

0.5.0 的實際 Codex 選圖結果及桌面驗證紀錄見 [驗證紀錄](docs/validation/0.5.0-selective-views.md)。離線重驗實際輸出：`node tests/selective-live-report.test.cjs`。
