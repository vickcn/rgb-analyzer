# 🚀 RGB 色光檢測器 - 部署指南

## 📋 專案概述

RGB 色光檢測器是一個基於 React + TypeScript + OpenCV.js 的網頁應用程式，可以透過手機攝影機即時檢測 RGB 色光值。支援 GitHub Pages 和 Vercel 免費部署。

## 🛠️ 技術棧

- **前端框架**: React 18 + TypeScript
- **圖像處理**: OpenCV.js
- **攝影機存取**: WebRTC API
- **部署平台**: GitHub Pages + Vercel
- **版本控制**: Git

## 📦 本地開發環境設置

### 1. Git 工作流程

在開始開發前，建議先了解基本的 Git 工作流程：

```bash
# 檢查當前狀態
git status

# 查看分支
git branch

# 切換到主分支
git checkout master

# 拉取最新代碼
git pull origin master

# 查看提交歷史
git log --oneline -10
```

### 2. 代碼提交與推送

```bash
# 添加修改的文件
git add .

# 或添加特定文件
git add src/components/CameraCapture.tsx

# 提交變更
git commit -m "feat: 新增全螢幕功能和定格時RGB資訊顯示"

# 推送到遠端倉庫
git push origin master

# 如果是首次推送新分支
git push -u origin feature-branch-name
```

### 3. 環境需求

```bash
# 檢查 Node.js 版本 (建議 16+)
node --version

# 檢查 npm 版本
npm --version
```

### 4. 安裝依賴

```bash
# 複製專案
git clone https://github.com/vickcn/rgb-analyzer.git
cd rgb-analyzer

# 安裝依賴
npm install
```

### 5. 本地開發

```bash
# 啟動開發伺服器 (預設 port 6007)
npm start

# 或指定其他 port
PORT=6007 npm start
```

### 6. 建置生產版本

```bash
# 建置優化版本
npm run build

# 檢查建置結果
ls -la build/
```

## 🔄 Git 工作流程與推送

### 1. 日常開發流程

```bash
# 1. 開始新功能前，先同步最新代碼
git checkout master
git pull origin master

# 2. 創建新分支（可選）
git checkout -b feature/new-feature

# 3. 進行開發和測試
npm start

# 4. 提交變更
git add .
git commit -m "feat: 描述你的變更"

# 5. 推送到遠端
git push origin master
# 或推送分支
git push origin feature/new-feature
```

### 2. 提交訊息規範

建議使用以下格式的提交訊息：

```bash
# 新功能
git commit -m "feat: 新增全螢幕功能"

# 修復問題
git commit -m "fix: 修復攝影機權限問題"

# 文檔更新
git commit -m "docs: 更新部署指南"

# 樣式調整
git commit -m "style: 調整按鈕樣式"

# 重構代碼
git commit -m "refactor: 重構圖像處理邏輯"

# 性能優化
git commit -m "perf: 優化圖像處理性能"
```

### 3. 推送前的檢查

```bash
# 檢查變更狀態
git status

# 查看變更內容
git diff

# 查看提交歷史
git log --oneline -5

# 確保沒有衝突
git pull origin master

# 最後推送
git push origin master
```

### 4. 處理推送錯誤

```bash
# 如果推送被拒絕，先拉取最新代碼
git pull origin master

# 如果有衝突，解決後重新提交
git add .
git commit -m "resolve: 解決合併衝突"

# 強制推送（謹慎使用）
git push --force origin master
```

## 🌐 GitHub Pages 部署

### 1. 準備 GitHub 倉庫

```bash
# 確保在正確的分支
git branch
git checkout master

# 確認遠端倉庫
git remote -v

# 如果沒有遠端倉庫，添加一個
git remote add origin https://github.com/your-username/rgb-analyzer.git

# 拉取最新代碼
git pull origin master
```

### 2. 安裝 GitHub Pages 部署工具

```bash
# 安裝 gh-pages
npm install --save-dev gh-pages
```

### 3. 配置 package.json

在 `package.json` 中添加：

```json
{
  "homepage": "https://vickcn.github.io/rgb-analyzer",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  }
}
```

### 4. 部署到 GitHub Pages

```bash
# 建置並部署
npm run deploy

# 或手動步驟
npm run build
npx gh-pages -d build
```

### 5. 啟用 GitHub Pages

1. 前往 GitHub 倉庫設定頁面
2. 選擇 `Settings` → `Pages`
3. 設定 `Source` 為 `gh-pages branch`
4. 等待幾分鐘後訪問：`https://vickcn.github.io/rgb-analyzer`

## ⚡ Vercel 部署

### 1. 安裝 Vercel CLI

```bash
# 全域安裝 Vercel CLI
npm install -g vercel

# 或使用 npx
npx vercel
```

### 2. 登入 Vercel

```bash
# 登入 Vercel 帳號
vercel login
```

### 3. 配置 vercel.json

專案已包含 `vercel.json` 配置：

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### 4. 部署到 Vercel

```bash
# 首次部署
vercel

# 生產環境部署
vercel --prod

# 或使用預設設定
vercel --prod --yes
```

### 5. 自動部署設定

1. 連接 GitHub 倉庫到 Vercel
2. 設定自動部署分支 (通常是 `master`)
3. 每次 push 到 master 分支會自動部署

## 🔧 部署配置說明

### 1. 環境變數

目前專案不需要額外的環境變數，所有配置都在代碼中。

### 2. 建置設定

```json
// package.json
{
  "scripts": {
    "start": "PORT=6007 react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

### 3. TypeScript 配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react"
  },
  "include": ["src"]
}
```

## 🚨 常見問題與解決方案

### 1. 攝影機權限問題

**問題**: 無法存取攝影機
**解決方案**:
- 確保使用 HTTPS (生產環境)
- 檢查瀏覽器權限設定
- 確認攝影機未被其他應用程式佔用

### 2. OpenCV.js 載入失敗

**問題**: OpenCV.js 無法載入
**解決方案**:
- 檢查網路連線
- 確認 CDN 連結正確
- 檢查瀏覽器控制台錯誤

### 3. 建置失敗

**問題**: `npm run build` 失敗
**解決方案**:
```bash
# 清理快取
npm run build -- --reset-cache

# 重新安裝依賴
rm -rf node_modules package-lock.json
npm install
```

### 4. 部署後頁面空白

**問題**: 部署後只看到空白頁面
**解決方案**:
- 檢查 `homepage` 設定是否正確
- 確認 `vercel.json` 路由配置
- 檢查瀏覽器控制台錯誤

### 5. 攝影機在手機上無法使用

**問題**: 手機瀏覽器無法存取攝影機
**解決方案**:
- 確保使用 HTTPS
- 檢查手機瀏覽器權限
- 嘗試不同的瀏覽器 (Chrome, Safari, Firefox)

### 6. Git 推送問題

**問題**: `git push` 失敗
**解決方案**:
```bash
# 檢查遠端倉庫設定
git remote -v

# 檢查認證狀態
git config --list | grep user

# 重新設定認證（如果使用 HTTPS）
git config --global credential.helper store

# 強制推送（謹慎使用）
git push --force-with-lease origin master
```

**問題**: 推送被拒絕
**解決方案**:
```bash
# 先拉取最新代碼
git pull origin master

# 如果有衝突，解決後重新提交
git add .
git commit -m "resolve: 解決合併衝突"
git push origin master
```

**問題**: 認證失敗
**解決方案**:
```bash
# 使用 Personal Access Token
git remote set-url origin https://username:token@github.com/username/repo.git

# 或使用 SSH
git remote set-url origin git@github.com:username/repo.git
```

## 📱 PWA 功能

專案支援 PWA (Progressive Web App) 功能：

### 1. 安裝到手機

- 在手機瀏覽器中打開網站
- 點擊「新增到主畫面」
- 像原生 App 一樣使用

### 2. 離線功能

- 基本功能可離線使用
- 圖像處理需要網路連線載入 OpenCV.js

## 🔄 更新部署

### 1. 代碼更新與推送

```bash
# 檢查當前狀態
git status

# 添加所有變更
git add .

# 或添加特定文件
git add src/components/CameraCapture.tsx src/components/CameraCapture.css

# 提交變更（使用有意義的訊息）
git commit -m "feat: 新增全螢幕功能和定格時RGB資訊顯示

- 新增全螢幕切換按鈕
- 在全螢幕模式下顯示浮動控制面板
- 定格時顯示RGB資訊覆蓋層
- 優化響應式設計"

# 推送到遠端倉庫
git push origin master

# 如果推送失敗，先拉取最新代碼
git pull origin master
git push origin master
```

### 2. 分支管理（可選）

```bash
# 創建功能分支
git checkout -b feature/fullscreen-support

# 在分支上開發
# ... 進行開發 ...

# 提交變更
git add .
git commit -m "feat: 實現全螢幕功能"

# 推送分支
git push origin feature/fullscreen-support

# 合併到主分支
git checkout master
git merge feature/fullscreen-support
git push origin master

# 刪除功能分支
git branch -d feature/fullscreen-support
git push origin --delete feature/fullscreen-support
```

### 3. 重新部署

**GitHub Pages**:
```bash
npm run deploy
```

**Vercel**:
```bash
vercel --prod
```

## 📊 監控與分析

### 1. Vercel 分析

- 訪問 Vercel Dashboard
- 查看部署狀態和訪問統計
- 監控錯誤和性能

### 2. GitHub 統計

- 查看 GitHub 倉庫統計
- 監控 Issues 和 Pull Requests
- 追蹤專案健康度

## 🎯 最佳實踐

### 1. 性能優化

- 使用 `npm run build` 建置優化版本
- 啟用 Gzip 壓縮
- 使用 CDN 載入 OpenCV.js

### 2. 安全性

- 使用 HTTPS
- 設定適當的 HTTP 標頭
- 定期更新依賴套件

### 3. 用戶體驗

- 提供載入狀態指示
- 處理錯誤情況
- 優化手機端體驗

## 📞 支援與聯絡

- **GitHub Issues**: [專案 Issues 頁面](https://github.com/vickcn/rgb-analyzer/issues)
- **線上演示**: [Vercel 部署](https://rgb-analyzer-n24bx2mzu-iankos-projects.vercel.app)
- **GitHub Pages**: [GitHub Pages 部署](https://vickcn.github.io/rgb-analyzer)

---

## 🎉 部署完成檢查清單

- [ ] 本地開發環境正常運行
- [ ] 建置成功無錯誤
- [ ] GitHub Pages 部署完成
- [ ] Vercel 部署完成
- [ ] 攝影機功能正常
- [ ] RGB 檢測功能正常
- [ ] 手機端測試通過
- [ ] PWA 功能正常

## 📚 Git 推送快速參考

### 常用命令

```bash
# 基本推送流程
git add .
git commit -m "feat: 描述變更"
git push origin master

# 檢查狀態
git status
git log --oneline -5

# 同步代碼
git pull origin master

# 創建並推送分支
git checkout -b feature-name
git push -u origin feature-name
```

### 提交訊息範例

```bash
git commit -m "feat: 新增全螢幕功能"
git commit -m "fix: 修復攝影機權限問題"
git commit -m "docs: 更新部署指南"
git commit -m "style: 調整按鈕樣式"
git commit -m "refactor: 重構圖像處理邏輯"
git commit -m "perf: 優化圖像處理性能"
```

**恭喜！您的 RGB 色光檢測器已成功部署！** 🎨✨
