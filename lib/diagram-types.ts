import type { NodeKind } from './graph';

export type DiagramType = 'architecture' | 'workflow' | 'sequence' | 'dataflow' | 'lifecycle' | 'c4';
export const levels = ['Context', 'Container', 'Component', 'Code'];
export const kindNames = {
  person: 'Person', system: 'Software System', container: 'Container', component: 'Component', code: 'Code', database: 'Database',
  service: '服務', external: '外部系統', step: '處理步驟', decision: '條件判斷', start: '起點', end: '終點',
  participant: '參與者', source: '資料來源', process: '資料處理', sink: '資料目的地', state: '狀態',
};
export const diagramTypes: Record<DiagramType, { name: string; english: string; description: string; sample: string; prompt: string; kinds: NodeKind[]; relation: string }> = {
  architecture: { name: '架構圖', english: 'Architecture', description: '系統、服務與基礎設施之間的依賴關係。', sample: 'Web 應用架構', prompt: 'Browser → API Gateway → Order Service → PostgreSQL', kinds: ['person','service','database','external'], relation: '呼叫' },
  workflow: { name: '工作流程圖', english: 'Workflow', description: '串接步驟與條件分支；在關係標籤填入通過、失敗等條件。', sample: 'CI / CD 部署流程', prompt: '開始 → 執行測試 → 測試通過？ → 部署 → 結束', kinds: ['start','step','decision','end'], relation: '下一步' },
  sequence: { name: '循序圖', english: 'Sequence', description: '參與者沿水平方向排列，訊息由上而下。選取訊息可調整順序或標為回傳。', sample: '登入請求時序', prompt: 'Browser → API → Database → API → Browser', kinds: ['participant'], relation: '請求' },
  dataflow: { name: '資料流圖', english: 'Data Flow', description: '追蹤資料來源、轉換、儲存與目的地；關係標籤可描述傳遞資料。', sample: '事件資料管線', prompt: 'Event Source → 清理事件 → Data Warehouse → Dashboard', kinds: ['source','process','database','sink'], relation: '資料' },
  lifecycle: { name: '狀態／生命週期圖', english: 'Lifecycle', description: '描述狀態、觸發事件、重試與終止。可從狀態連回自身，建立重試轉移。', sample: '訂單生命週期', prompt: '開始 → 待付款 → 已付款 → 配送中 → 已完成 → 結束', kinds: ['start','state','end'], relation: '事件' },
  c4: { name: 'C4 Model', english: 'C4 Model', description: '四個層級由全貌走向細節；目前為獨立畫布，尚未建立跨層父子關聯。', sample: '電商系統', prompt: 'Browser → API Service → PostgreSQL', kinds: ['person','system','container','component','code','database'], relation: '使用' },
};
export const diagramKeys = ['architecture','workflow','sequence','dataflow','lifecycle',...levels];
