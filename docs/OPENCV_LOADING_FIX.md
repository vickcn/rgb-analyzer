# OpenCV.js 重複載入問題修復

## 問題描述

在開發過程中可能遇到以下錯誤：

```
ERROR
Cannot register public name 'IntVector' twice
BindingError: Cannot register public name 'IntVector' twice
```

這個錯誤是由於 OpenCV.js 被重複載入導致的，通常發生在：

1. **開發模式熱重載**：React 開發伺服器熱重載時重複載入 OpenCV.js
2. **頁面刷新**：瀏覽器快取問題導致 OpenCV.js 重複初始化
3. **組件重新掛載**：React 組件重新掛載時重複調用載入函數

## 解決方案

### 1. 改進的載入邏輯

修改 `src/utils/opencvProcessor.ts` 中的 `loadOpenCV` 函數：

```typescript
// 全域載入狀態追蹤
let isOpenCVLoading = false;
let openCVLoadPromise: Promise<void> | null = null;

export const loadOpenCV = (): Promise<void> => {
  // 檢查是否已經載入完成
  if (window.cv && window.cv.Mat) {
    return Promise.resolve();
  }

  // 如果正在載入，返回現有的 Promise
  if (isOpenCVLoading && openCVLoadPromise) {
    return openCVLoadPromise;
  }

  // 檢查是否已經有 OpenCV script 標籤
  const existingScript = document.querySelector('script[src*="opencv.js"]');
  if (existingScript) {
    // 等待現有 script 初始化完成
    return waitForOpenCVInit();
  }

  // 開始新的載入過程
  return startNewLoad();
};
```

### 2. 防重複載入機制

- **狀態追蹤**：使用全域變數追蹤載入狀態
- **Promise 重用**：正在載入時返回同一個 Promise
- **Script 檢測**：檢查是否已存在 OpenCV script 標籤
- **超時處理**：載入超時時自動重試

### 3. 開發模式清理

```typescript
export const cleanupOpenCV = () => {
  if (typeof window !== 'undefined') {
    // 移除現有的 OpenCV script
    const existingScript = document.getElementById('opencv-script');
    if (existingScript) {
      existingScript.remove();
    }
    
    // 重置載入狀態
    isOpenCVLoading = false;
    openCVLoadPromise = null;
  }
};
```

## 使用方式

### 正常使用

```typescript
// 在需要使用 OpenCV 的地方
await loadOpenCV();
const cv = window.cv;
// 使用 OpenCV 功能...
```

### 開發模式清理（如需要）

```typescript
// 在組件卸載或熱重載時
useEffect(() => {
  return () => {
    if (process.env.NODE_ENV === 'development') {
      cleanupOpenCV();
    }
  };
}, []);
```

## 預防措施

### 1. 避免多次調用

```typescript
// ❌ 錯誤：多個組件同時載入
useEffect(() => {
  loadOpenCV();
}, []);

// ✅ 正確：統一載入管理
const { isLoaded } = useOpenCV(); // 自定義 hook
```

### 2. 適當的錯誤處理

```typescript
try {
  await loadOpenCV();
  // OpenCV 操作...
} catch (error) {
  console.error('OpenCV 載入失敗:', error);
  // 錯誤處理邏輯...
}
```

### 3. 記憶體管理

```typescript
// 使用完 Mat 物件後記得釋放
const mat = new cv.Mat();
try {
  // 使用 mat...
} finally {
  mat.delete(); // 釋放記憶體
}
```

## 故障排除

### 如果仍然遇到重複載入錯誤

1. **清除瀏覽器快取**
   - 開啟開發者工具
   - 右鍵重新整理按鈕
   - 選擇「清空快取並強制重新整理」

2. **重啟開發伺服器**
   ```bash
   # 停止開發伺服器 (Ctrl+C)
   npm start
   ```

3. **檢查控制台日誌**
   - 查看是否有 OpenCV 載入相關的日誌
   - 確認載入順序是否正確

4. **手動清理**
   ```javascript
   // 在瀏覽器控制台執行
   document.querySelectorAll('script[src*="opencv.js"]').forEach(s => s.remove());
   delete window.cv;
   location.reload();
   ```

## 技術細節

### OpenCV.js 載入過程

1. **Script 載入**：下載 OpenCV.js 檔案
2. **WASM 初始化**：初始化 WebAssembly 模組
3. **API 註冊**：註冊 OpenCV 函數和類別
4. **運行時準備**：`onRuntimeInitialized` 回調觸發

### 重複載入的根本原因

OpenCV.js 使用 Emscripten 編譯，會在全域範圍註冊 C++ 類別。重複載入時嘗試重新註冊相同的類別名稱（如 `IntVector`），導致 `BindingError`。

### 解決方案的核心思想

- **單例模式**：確保 OpenCV.js 只載入一次
- **狀態同步**：多個調用者共享同一個載入狀態
- **錯誤恢復**：載入失敗時能夠重試

## 相關檔案

- `src/utils/opencvProcessor.ts` - OpenCV 載入和處理邏輯
- `src/components/CameraCapture.tsx` - 主要使用 OpenCV 的組件
- `docs/RGB_DETECTION_ALGORITHM.md` - 演算法說明

## 更新日誌

- **v1.1.0**: 修復 OpenCV.js 重複載入問題
- **v1.0.0**: 初始實現 OpenCV.js 載入邏輯

---

**注意**：此修復主要針對開發環境。生產環境中，OpenCV.js 通常只載入一次，較少遇到此問題。

