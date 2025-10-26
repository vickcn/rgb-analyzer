# Google Sheets API 設定指南

本文檔說明如何設定 Google Cloud Platform 專案，以啟用 Google Sheets 整合功能。

## 前置需求

- Google 帳號
- 網際網路連線
- 可存取 Google Cloud Console

## 步驟 1: 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點擊頂部的專案選擇器
3. 點擊「新增專案」
4. 輸入專案名稱（例如：`RGB Analyzer`）
5. 點擊「建立」

## 步驟 2: 啟用 API

### 2.1 啟用 Google Sheets API

1. 在 Google Cloud Console 中，導航至「API 和服務」>「程式庫」
2. 搜尋「Google Sheets API」
3. 點擊「Google Sheets API」
4. 點擊「啟用」

### 2.2 啟用 Google Drive API

1. 同樣在「API 程式庫」中搜尋「Google Drive API」
2. 點擊「Google Drive API」
3. 點擊「啟用」

### 2.3 啟用 Google People API

1. 搜尋「Google People API」（用於取得用戶資訊）
2. 點擊「啟用」

## 步驟 3: 建立 OAuth 2.0 憑證

### 3.1 設定 OAuth 同意畫面

1. 導航至「API 和服務」>「OAuth 同意畫面」
2. 選擇「外部」（External）用戶類型
3. 點擊「建立」
4. 填寫必要資訊：
   - **應用程式名稱**：`RGB Analyzer`
   - **使用者支援電子郵件**：您的電子郵件地址
   - **開發人員聯絡資訊**：您的電子郵件地址
5. 點擊「儲存並繼續」

### 3.2 設定 OAuth 範圍

1. 在「範圍」頁面，點擊「新增或移除範圍」
2. 選擇以下範圍：
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/userinfo.email`
3. 點擊「更新」
4. 點擊「儲存並繼續」

### 3.3 新增測試使用者（開發階段）

1. 在「測試使用者」頁面，點擊「新增使用者」
2. 輸入您的 Google 帳號電子郵件
3. 點擊「儲存並繼續」

### 3.4 建立 OAuth 2.0 Client ID

1. 導航至「API 和服務」>「憑證」
2. 點擊「建立憑證」>「OAuth 用戶端 ID」
3. 選擇應用程式類型：「網頁應用程式」
4. 輸入名稱：`RGB Analyzer Web Client`
5. 設定「已授權的 JavaScript 來源」：
   - 開發環境：`http://localhost:6007`
   - 生產環境：`https://your-vercel-domain.vercel.app`
6. 設定「已授權的重新導向 URI」：
   - 開發環境：`http://localhost:6007`
   - 生產環境：`https://your-vercel-domain.vercel.app`
7. 點擊「建立」
8. **重要**：複製並儲存 `Client ID`（稍後會用到）

## 步驟 4: 建立 API Key

1. 在「憑證」頁面，點擊「建立憑證」>「API 金鑰」
2. 系統會建立一個 API 金鑰
3. 點擊「限制金鑰」（建議）
4. 選擇「API 限制」
5. 選取：
   - Google Sheets API
   - Google Drive API
6. 點擊「儲存」
7. **重要**：複製並儲存此 `API Key`

## 步驟 5: 設定環境變數

### 5.1 建立 `.env.local` 檔案

在專案根目錄建立 `.env.local` 檔案：

```bash
# Google OAuth 設定
REACT_APP_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
REACT_APP_GOOGLE_API_KEY=YOUR_API_KEY_HERE

# Google Sheets 設定（可選）
REACT_APP_DEFAULT_SPREADSHEET_ID=
```

### 5.2 填入憑證

將步驟 3.4 和步驟 4 取得的憑證填入：

```bash
REACT_APP_GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
REACT_APP_GOOGLE_API_KEY=AIzaSyAbc123Def456Ghi789
```

## 步驟 6: 測試設定

1. 啟動開發伺服器：
   ```bash
   npm start
   ```

2. 開啟瀏覽器前往 `http://localhost:6007`

3. 點擊「使用 Google 帳號登入」按鈕

4. 完成 OAuth 授權流程

5. 確認能夠看到您的 Google 帳號資訊

## 步驟 7: Vercel 部署設定

### 7.1 在 Vercel Dashboard 設定環境變數

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的專案
3. 點擊「Settings」>「Environment Variables」
4. 新增以下環境變數：
   - `REACT_APP_GOOGLE_CLIENT_ID`
   - `REACT_APP_GOOGLE_API_KEY`

### 7.2 更新 OAuth 設定

1. 回到 Google Cloud Console
2. 在 OAuth Client ID 設定中，新增生產環境 URI：
   - **已授權的 JavaScript 來源**：`https://your-project.vercel.app`
   - **已授權的重新導向 URI**：`https://your-project.vercel.app`

### 7.3 重新部署

```bash
git add .
git commit -m "Add Google Sheets integration"
git push origin master
```

## 常見問題

### Q: 出現「redirect_uri_mismatch」錯誤

**A**: 確認 OAuth Client ID 設定中的「已授權的重新導向 URI」包含您當前使用的 URL（包含 http/https 和 port）。

### Q: 無法存取 Google Sheets

**A**: 檢查以下項目：
1. Google Sheets API 是否已啟用
2. OAuth 範圍是否包含 `https://www.googleapis.com/auth/spreadsheets`
3. Access token 是否過期（需要重新登入）

### Q: API Key 無效

**A**: 確認：
1. API Key 是否正確複製到 `.env.local`
2. API Key 限制是否設定正確
3. 專案是否已啟用相關 API

## 安全性建議

1. **不要將 `.env.local` 提交到 Git**
   - 已包含在 `.gitignore` 中

2. **限制 API Key 使用範圍**
   - 設定 API 限制（僅限 Sheets 和 Drive API）
   - 設定應用程式限制（HTTP referrer）

3. **定期輪換憑證**
   - 建議每 3-6 個月更換一次 API Key

4. **監控 API 使用量**
   - 定期檢查 Google Cloud Console 的配額使用情況

## 相關連結

- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Sheets API 文檔](https://developers.google.com/sheets/api)
- [Google OAuth 2.0 文檔](https://developers.google.com/identity/protocols/oauth2)
- [Vercel 環境變數文檔](https://vercel.com/docs/environment-variables)

## 支援

如有問題，請參考：
- 專案 README.md
- GitHub Issues
- Google API 支援論壇

