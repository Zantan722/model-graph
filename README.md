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
- 「自動排列」依關係方向分層重排節點（桌面版亦在「檢視」選單或 Cmd/Ctrl+Shift+L）。同一份圖永遠得到同一種排列，可用復原還原。循序圖改為調整參與者左右順序以縮短訊息。
- 頂部「匯出」可存成 PNG、JPG、SVG 或 JSON，桌面版另有「檔案 → 匯出…」與 Cmd/Ctrl+S（PNG）、Cmd/Ctrl+Shift+S（SVG）。圖片匯出整張圖，不受目前縮放與捲動位置影響；PNG／JPG 以 2 倍解析度輸出，JPG 為白底，SVG 保持透明背景。連線圓點與選取、聚焦、滑鼠停留的高亮都不會被匯出。
- 頂部面板按鈕可分別收合上方工具列、左側助理與右側屬性；「專注模式」（桌面版亦在「檢視」選單）或 Cmd/Ctrl + \ 一次全收，再按一次還原成先前的組合。收合狀態保存在本機，畫布會自動重新符合畫面。
- 從「圖表類型」切換 Architecture、Workflow、Sequence、Data Flow、Lifecycle 與 C4 Model，每種圖保存獨立畫布。
- 工作流程支援處理步驟、條件判斷與分支；資料流支援來源、處理、資料庫與目的地；狀態圖支援事件與回到自身的重試轉移。
- 循序圖以生命線呈現參與者，可左右拖拉，訊息依順序排列；選取訊息可提前／延後、編輯名稱及切換請求／回傳樣式。
- 四個 C4 層級各有獨立畫布。JSON 包含圖表類型與目前畫布，請切換到對應類型／層級再匯入。
- 既有 v1 C4 本機資料會自動遷移到 v2，原始 v1 備份仍保留。
- Prompt 本機指令：`Browser → API → PostgreSQL` 取代目前圖，`新增 Redis` 加入節點。取代後可復原。

## 原型範圍

網頁版的本機規則不理解任意自然語言；Electron 桌面版可使用 Claude Code／Codex CLI（見下方說明）。各圖表類型提供可編輯的基礎表示法，可匯出 PNG／JPG／SVG，但尚未提供 Archify 的播放、路徑追蹤與動畫；循序圖尚無 alt/loop 分組及啟動條。四層視圖目前沒有跨層父子關聯、邊界容器或 C4 語義驗證；Code 是可編輯節點圖，非完整 UML。註解保存在本機，尚未支援多人協作。資料清除前請匯出各層 JSON。

桌面 AI 回傳的 PUML 經解析檢查後才套用並加入復原歷史；來源讀取與 CLI 執行在 Electron 主程序處理。

## 驗證

```sh
node tests/graph.test.mjs
node tests/svg-export.test.mjs
node tests/puml-format.test.mjs
node tests/layout.test.mjs
npx tsc --noEmit
npm run build
```

視覺方向參考 https://github.com/tt-a1i/archify ，此原型使用自行實作的 SVG 編輯器，未使用 Archify 渲染引擎。

## PlantUML（PUML）輸入／輸出

點選頂部「PUML」，即可編輯目前畫布的 PlantUML 原始碼、開啟 `.puml` / `.plantuml` 檔案、解析檢查與套用，或下載原始碼。一般「匯入」按鈕也接受 PUML。

- 套用前顯示辨識類型、節點／關係數、錯誤行號與轉換提醒；有不支援的結構時，不能取代畫布。套用後可復原。
- 支援 sequence 的 participant／actor 等參與者、正反向訊息與回傳箭頭；component／database／rectangle／cloud 等宣告、別名與有向關係；state 宣告與 `[*]` 起終點；單一節點的行內／多行 note。
- activity 支援 `start`、`:步驟;`、`stop` / `end`、巢狀 `if (...) then (...) / else (...) / endif`、`while (...) is (...) / endwhile (...)`。
- C4 支援 Person、System、Container、Component、Db／Ext 常見巨集與 Rel 的位置參數。`Enterprise_/System_/Container_Boundary` 與 `Boundary` 可解析並保留群組內元素，但畫布不呈現邊界框，重新匯出時群組會消失。自訂巨集與命名參數尚未支援。
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

桌面版資料存在 Electron 的使用者資料目錄，與瀏覽器的 localStorage 分開；既有網頁圖表請先匯出 PUML／JSON，再匯入 App。桌面「檔案 → 匯入圖檔」或 Cmd/Ctrl+O 可開啟匯入；「檔案 → 匯出…」可存成 PNG／JPG／SVG／JSON。圖片與 PUML／JSON 下載都會顯示系統存檔對話框；取消不視為錯誤，寫入未完成時會另外顯示儲存失敗訊息。

```sh
npm run test:desktop
npm run desktop:build
npm run desktop:smoke
```

Smoke test 使用獨立暫存使用者資料目錄，檢查真實 Electron renderer、六類圖表、PUML 視窗、localStorage、secure context 與 Node.js 隔離，不會更動平常的圖檔。桌面介面透過受限的 `modelgraph://app/` 本機協定載入，只允許打包後的介面資源，renderer 不具 Node.js／任意檔案存取能力。

## 0.1.1 檢查與修補

修正版加入損壞資料保護、備份後恢复儲存、匯入內容限制、保留重做紀錄、PUML 未套用文字的離開提醒，以及合併自動儲存。完整結果、剩餘風險與優化順序見 [檢查報告](docs/REVIEW-2026-09-11.md)。額外回歸測試：`node tests/audit.test.mjs`。

## 直接畫圖，或自行選擇候選圖

左側使用同一個需求輸入區：選擇圖表類型，輸入 Prompt 後按「送出需求」。CLI 提供者、模型與執行檔位於收合的「使用 Codex CLI · 設定」。資料夾是選用參考；選取資料夾不會啟動模型，也不會切換操作方式。指定資料夾後，只挑選需求相關來源繪圖。

輸入「有哪些流程」「列出候選圖」等探索需求時，會先列候選；也可自行按「先列出候選讓我選」。目前使用明確詞句判斷探索需求，不是任意自然語言意圖分類。資料夾已選但需求留白時提供「查看整體架構」與「找可畫的流程」入口：

1. 選擇圖表類型及 C4 層級，指定參考資料夾；Prompt 可用來限制範圍，也可以留白。
2. 按「先列出候選讓我選」。只讀檔案清單及根目錄 README／套件概覽，透過一次模型請求建議至多 12 張圖，不逐一追查實作。
3. 到「圖表清單」閱讀簡短描述，勾選要畫的圖。預設零勾選，候選描述尚未核對實作。
4. 按「產生所選 N 張圖」，才讀取每張所選圖的相關程式碼與文件、產生 PUML。未選項目不深入讀取、不產圖，完成項目不重跑。

架構圖以結構範圍拆分，不強制套用成功／失敗 Story。C4 固定所選層級；流程／循序圖以情境拆分，資料流圖以管線拆分，狀態圖以實體生命週期拆分。每張所選圖都驗證圖種與 PUML 語法。

主介面不再提供「分析缺口」或強制分析報告。候選不足或範圍需要補充時，可按「帶回 Prompt 修改」，由使用者補充需求再畫；沒有自動追加全 repo 調查。

### 參考來源與儲存

候選與完成圖保存在 Electron userData 的 `last-project-report.json` 及 `project-reports/<id>.json`。概覽快照保存在 `project-sources/<id>.json`，參考資料夾位置保存在主程序專用的 `project-contexts/<id>.json`。Renderer 不能指定任意來源路徑。所選圖每次產生時讀取該資料夾當下的相關內容，因此不同批次可能反映不同版本；每張圖可展開實際參考檔案。資料夾移除或位置變更時，需重新指定並列出候選。

舊版清單仍使用既有來源快照，已完成的圖保留。重新啟動預設留在畫布，可自行切到「圖表清單」繼續。取消會保留已完成圖；尚未開始的項目回到未產生。

沒有 240 KB 總量、64 KB 單檔、60 檔或目錄深度門檻；仍排除依賴／建置目錄、常見憑證、二進位、symlink 與 repo 外路徑。不解析自訂 `.gitignore`，不支援 PDF／DOCX／圖片內容。模型上下文與記憶體仍有限制。單次 CLI 等待上限 10 分鐘，沒有整批 30 分鐘強制中止；語法錯誤至多修正一次，CLI 執行錯誤不自動重試同一張圖。

### CLI 設定

Claude Code／Codex CLI 需自行安裝並登入。在 App 選提供者，按「檢查 CLI／登入」，必要時在模型設定指定執行檔及模型。提供者會記住；不會因 Claude 額度不足或 Codex 失敗而自動換提供者。模型留白使用 CLI 預設。

CLI 使用獨立暫存工作目錄及受限非互動模式，來源由 App 讀取。Codex 使用 `--ignore-user-config`、`--ignore-rules`、read-only sandbox 並關閉工具功能；依 CLI 的既有登入，忽略自訂 config 與 repo 指令。Windows 目前需要真正的 `.exe`，不執行 `.cmd` 包裝檔；Mac Apple Silicon 已驗證，Windows 尚未實機驗證。模型分析會使用所選服務的額度。

### 畫布與修正

每份所選圖通過 PUML 檢查後自動同步畫布，可用「已完成視圖」切換。手動編輯、復原、切換視圖或開啟 PUML 編輯器會暫停同步；可自行恢復。失敗草稿保留供修正。已完成的視圖可「帶回 Prompt 修改」，會帶入對應的結構或行為說明，走單張修改流程。

畫布編輯會成為該圖在圖表清單中的目前版本，選回同一張圖、從清單預覽或下載均使用目前版本。最近 10 次修改前版本可預覽及復原，版本保存於本機；原始生成報告仍保留於主程序。可另存流程庫或匯出 PUML／JSON。

選取節點後送出需求，只合併該節點及相關連線，其他原有節點的位置與內容保留。選取關係則只修改該條關係。若產圖期間畫布又有修改，不直接覆蓋，結果保留供預覽。新增节点位置與語意仍需檢查。

畫布上方「開啟 PUML」能連結 repo 內的檔案。「儲存 PUML」先顯示原檔與新內容比較，確認後才寫入；原檔若被其他程式修改會停止覆寫，需重開或另存。畫布沒有更動時保留開啟的原始文字；編輯後會標準化輸出，樣式與一般註解可能改變，並非任意 PlantUML 語法的無損編輯器。

選取節點或關係後，可在右側展開「來源摘錄」。模型提供的路徑與行號經 App 對本次讀取來源核對，再擷取原文；沒有有效引用時顯示尚未核對。引用並不保證推論正確，手動更改與來源檔案的新版本也可能使摘錄過時。來源摘錄保存在 PUML 的附加註解中，匯出時會包含程式片段。

### 驗證

```sh
npm run desktop:build
node tests/views.test.cjs
node tests/discovery.test.cjs
node tests/selected-ipc.test.cjs
node tests/report-canvas.test.mjs
npm run desktop:smoke -- --smoke-report
```

需要真實模型的驗證明確啟用，僅傳送合成測試 repo：

```sh
MODELGRAPH_LIVE_TEST=1 node scripts/test-live-views.cjs
```

此腳本保留 0.5.0 的深度分析回歸流程，不代表目前預設流程；新流程由 discovery 與 IPC 測試核對選前不讀實作、只產所選圖。模型語意仍需人工核對；測試不是任意生產 repo 的正確性保證。

0.5.0 的實際 Codex 選圖結果及桌面驗證紀錄見 [驗證紀錄](docs/validation/0.5.0-selective-views.md)。離線重驗實際輸出：`node tests/selective-live-report.test.cjs`。
