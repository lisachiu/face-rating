# 顏值審美大調查 — 專案規格書

## 一、專案概述

| 項目 | 說明 |
|------|------|
| **名稱** | 顏值審美大調查 |
| **類型** | 趣味性社群調查網站 |
| **核心概念** | 用 20 張 AI 生成的台灣男性照片，讓使用者依性別評分，揭露男女之間的審美觀差異 |
| **目標受眾** | 對審美差異好奇的一般使用者（娛樂性質，非學術研究） |
| **線上網址** | https://face-rating.onrender.com |
| **GitHub Repo** | https://github.com/lisachiu/face-rating |

## 二、核心動機

女生看男生與男生看男生的「好看標準」差異很大。例如男生覺得 60 分的長相，女生可能只覺得 20 分。本站讓使用者透過實際評分數據，直觀感受這個落差。

## 三、技術架構

| 層級 | 技術 |
|------|------|
| **前端** | 原生 HTML + CSS + JavaScript（SPA 單頁應用） |
| **後端** | Node.js + Express |
| **資料庫** | JSON 檔案（`data.json`） |
| **字型** | Google Fonts — Noto Sans TC |
| **照片來源** | DALL-E 生成的 20 張台灣男性大頭照（PNG） |
| **部署平台** | Render（免費方案） |
| **防休眠** | UptimeRobot 每 5 分鐘 ping `/api/stats` |

## 四、頁面流程

```
首頁（選擇性別）→ 評分頁（逐張評分 1~10）→ 結果頁（男女比較）
```

### 4.1 首頁（Welcome）
- 顯示標題「顏值審美大調查」與說明文案
- 兩個按鈕：「我是男生」/「我是女生」
- 顯示目前參與人數（N 位男生、N 位女生）
- 「直接查看目前結果」連結

### 4.2 評分頁（Rating）
- 頂部進度條 + 文字提示（N / 20）
- 中央顯示照片（3:4 比例卡片）
- 底部評分按鈕兩列排列（D4 Layout）：
  - 第一列 1~5 分，左右標籤「不行 / 還行」
  - 第二列 6~10 分，左右標籤「不錯 / 好看」
- 按鈕尺寸：桌面 58px / 手機 48px
- 鍵盤快捷鍵：按 `1`~`9` 對應分數，`0` = 10 分
- 選擇後自動進入下一張（280ms 延遲動畫）
- 評分即時送出至後端（non-blocking）
- **照片順序隨機打亂**（Fisher-Yates shuffle），避免順序效應影響評分
- 評完 20 張後自動標記完成並跳轉結果頁

### 4.3 結果頁（Results）
- **總覽統計**：男生參與人數、女生參與人數、平均差異分數
- **差異最大提示**：標出哪張照片男女評分差最多
- **逐張比較卡片**：
  - 照片縮圖 + 編號
  - 男生平均分（藍色長條）
  - 女生平均分（粉色長條）
  - 評分人數
  - 標籤系統：🔥 公認帥哥（男女皆 ≥7）、💔 差異超大（差 ≥3）、🤝 意見一致（差 <1）
  - 顯示自己的評分
- **排序**：可按照片順序 / 依差異大小排序
- 已完成評分的使用者不顯示「回首頁」按鈕（防止重複評分）
- 未評分而直接查看結果的使用者可按「回首頁」回去開始評分
- **分享按鈕**：
  - 手機：使用 Web Share API 彈出系統原生分享選單（LINE、IG 等）
  - 桌面：複製網址到剪貼簿，顯示「✅ 已複製連結！」提示（2 秒後消失）
- 結果頁照片固定依 01~20 順序顯示（不受評分時的隨機順序影響）

## 五、API 規格

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/photos` | 回傳照片檔名列表 `string[]` |
| `POST` | `/api/rate` | 提交評分 |
| `GET` | `/api/results` | 取得所有照片的男女平均分 |
| `GET` | `/api/stats` | 取得參與人數統計 |
| `GET` | `/api/export` | 下載完整 data.json（資料備份用） |

### POST `/api/rate` Request Body
```json
{
  "photoId": "01.png",
  "gender": "M",
  "score": 7,
  "sessionId": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
}
```

### 輸入驗證
- `gender`：僅接受 `"M"` 或 `"F"`
- `score`：1~10 整數
- `sessionId`：UUID 格式（30~40 字元 hex+dash）
- `photoId`：必須存在於 `public/photos/` 中
- 同一 session + 同一照片只保留一筆（可更新）

## 六、資料結構

### `data.json`
```json
{
  "ratings": [
    {
      "photoId": "01.png",
      "gender": "M",
      "score": 7,
      "sessionId": "uuid-here",
      "createdAt": "2026-04-19T12:00:00.000Z"
    }
  ]
}
```

## 七、使用者識別與防重複機制

- 以 `localStorage` 儲存隨機生成的 UUID 作為 session ID（`fr_session`）
- 同一瀏覽器視為同一使用者
- 評分完成後在 `localStorage` 設置：
  - `fr_completed`：標記已完成
  - `fr_ratings`：自己的評分紀錄（結果頁顯示「你的評分」用）
  - `fr_gender`：選擇的性別
- 已完成的使用者再次訪問時，自動跳轉結果頁，無法重新評分
- 清除瀏覽器資料或使用無痕模式可重新開始（前端限制，非絕對防護）
- 不提供「重新評分」按鈕，避免同一人產生多筆 session 污染數據

## 八、照片規格

| 項目 | 規格 |
|------|------|
| 數量 | 20 張 |
| 格式 | PNG |
| 命名 | `01.png` ~ `20.png` |
| 內容 | AI（DALL-E）生成的台灣男性大頭照，年齡 20~35 歲，多樣化外型 |
| 存放位置 | `public/photos/` |

## 九、檔案結構

```
face-rating/
├── server.js              # Express 後端 + API
├── package.json           # 專案設定
├── data.json              # 評分資料（自動生成）
├── setup.js               # 佔位圖片生成工具
├── download-faces.js      # 批次下載人臉工具
├── pick.js                # 互動式照片挑選工具
├── CODEX_PROMPT.txt       # Codex 生成照片用的 prompt
├── SPEC.md                # 本規格書
├── .gitignore             # Git 忽略規則
├── public/
│   ├── index.html         # 單頁應用 HTML
│   ├── style.css          # 響應式樣式
│   ├── app.js             # 前端邏輯
│   └── photos/
│       ├── 01.png ~ 20.png  # AI 生成照片
│       └── raw/             # 下載的原始照片（備份）
```

## 十、響應式設計

- 桌面與手機皆可使用
- 斷點 520px 以下：卡片改為直式排列、評分按鈕 48px、隱藏鍵盤提示與人數細節
- 評分頁照片尺寸使用 `clamp() + dvh` 自適應視窗高度，避免固定尺寸在不同手機上過大或過小
  - 一般手機：`clamp(180px, 42dvh, 300px)`
  - 小視窗 (≤660px 高，如 WebView)：`clamp(140px, 36dvh, 220px)`，按鈕縮至 42px
- 評分頁容器使用 `justify-content: center` 垂直置中，避免上方擠、下方留白
- 底部安全區域使用 `env(safe-area-inset-bottom)` 適配 iPhone Home Indicator
- 使用 `@media (hover: hover)` 防止手機觸控後 hover 狀態殘留
- 結果頁照片高度在手機上設為 `auto`，避免裁切

## 十一、啟動方式

### 本機開發
```bash
npm install
npm start        # http://localhost:3000
```

### 部署
- 程式碼推到 GitHub 後，Render 自動從 `main` 分支部署
- Build Command：`npm install`
- Start Command：`npm start`
- Region：Singapore

## 十二、部署架構

```
使用者瀏覽器
    ↓ HTTPS
https://face-rating.onrender.com  （Render 免費方案）
    ↓ 執行
Node.js + Express
    ↓ 讀寫
data.json（Render 暫存檔案系統）
```

### 注意事項
- Render 免費版檔案系統是暫存的，重新部署會以 Git 中的 `data.json` 覆蓋線上版本
- UptimeRobot 每 5 分鐘 ping 網站防止休眠（免費版閒置 15 分鐘會休眠）
- 結果計算僅包含完成 15 張以上的 session，未完成者的評分不影響平均分數
- 如需資料永久保存，未來可接 Supabase 等免費雲端資料庫

### 資料備份流程（每次 git push 前執行）
```powershell
# 1. 先把線上資料拉下來
Invoke-WebRequest -Uri https://face-rating.onrender.com/api/export -OutFile C:\Users\Ching\face-rating\data.json
# 2. 再 commit + push
git add -A
git commit -m "your message"
git push origin main
```
或直接在瀏覽器開啟 https://face-rating.onrender.com/api/export 下載備份
