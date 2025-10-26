# 全螢幕定格顯示與存圖功能色度模式支援

## 概述

本次更新為全螢幕定格顯示和存圖功能增加了色度演算模式支援，讓使用者在不同模式下都能看到對應的色彩資訊。

## 更新內容

### 1. 全螢幕定格顯示增強

#### 功能位置
- 全螢幕模式 → 定格畫面 → 自動顯示色彩資訊卡

#### 支援的顯示模式
- **RGB 模式**：顯示 RGB 數值和 HEX 色碼
- **HSV 模式**：顯示色相、飽和度、明度詳細資訊
- **HSL 模式**：顯示色相、飽和度、亮度詳細資訊
- **色溫模式**：顯示色溫值、描述和類別
- **全部顯示**：顯示所有色度資訊（RGB、HSV、HSL、色溫）

#### 顯示範例

**RGB 模式**：
```
RGB: 255, 128, 64
HEX: #FF8040
數據筆數: 15
```

**HSV 模式**：
```
HSV: 24°, 75%, 100%
色相: 24°
飽和度: 75%
明度: 100%
數據筆數: 15
```

**色溫模式**：
```
色溫: 3200K
暖白光
類別: Warm
數據筆數: 15
```

### 2. 存圖功能增強

#### 原圖存檔
- 保持原有功能，儲存未經處理的原始畫面

#### 標註圖存檔
- 根據當前選擇的色度演算模式顯示對應資訊
- 自動避開檢測框（ROI）位置
- 包含色塊預覽和詳細數值

#### 標註圖資訊內容

**RGB 模式標註**：
- HEX 色碼
- RGB 數值

**HSV 模式標註**：
- HSV 完整數值
- 分別顯示色相、飽和度、明度

**HSL 模式標註**：
- HSL 完整數值
- 分別顯示色相、飽和度、亮度

**色溫模式標註**：
- 色溫數值（Kelvin）
- 色溫描述（如「暖白光」）
- 色溫類別（如「Warm」）

**全部顯示標註**：
- 包含所有色度資訊
- 自動調整資訊卡大小

### 3. 技術實現

#### 核心函數

**CameraCapture.tsx**：
```typescript
// 格式化色彩資訊顯示
const formatColorInfo = useCallback((rgbData: RGBData, mode: ColorDisplayMode): string[] => {
  const lines: string[] = [];
  
  switch (mode) {
    case 'rgb':
      lines.push(`RGB: ${rgbData.r}, ${rgbData.g}, ${rgbData.b}`);
      lines.push(`HEX: ${rgbData.hex}`);
      break;
    case 'hsv':
      // HSV 詳細資訊
      break;
    // ... 其他模式
  }
  
  return lines;
}, []);
```

**exportUtils.ts**：
```typescript
// 標註圖格式化函數
const formatAnnotationInfo = (rgbData: RGBData, mode: ColorDisplayMode): string[] => {
  // 根據模式返回對應的顯示文字
};

// 更新的匯出函數
export const exportImages = async (
  canvas: HTMLCanvasElement,
  data: RGBData[],
  filename?: string,
  colorDisplayMode: ColorDisplayMode = 'rgb'
): Promise<void> => {
  // 傳遞色度模式到標註圖創建函數
};
```

#### 資料流

1. **模式選擇**：使用者在檢測控制面板選擇色度模式
2. **狀態傳遞**：`App.tsx` → `CameraCapture.tsx`
3. **顯示更新**：
   - 全螢幕定格：即時更新資訊卡內容
   - 存圖功能：根據當前模式生成標註

#### 位置計算

**智慧位置選擇**：
- 自動避開檢測框（ROI）區域
- 避開功能按鈕區域
- 優先選擇四個角落位置
- 確保資訊卡完全可見

### 4. 使用方式

#### 全螢幕定格顯示
1. 啟動攝影機
2. 點擊「全螢幕」按鈕
3. 在檢測控制面板選擇色度演算模式
4. 點擊「定格畫面」
5. 查看自動顯示的色彩資訊卡

#### 存圖功能
1. 選擇想要的色度演算模式
2. 點擊「保存標註圖」
3. 下載的圖片將包含對應模式的色彩資訊

### 5. 檔案更新清單

#### 主要修改
- `src/components/CameraCapture.tsx`
  - 新增 `colorDisplayMode` 參數
  - 新增 `formatColorInfo` 函數
  - 更新全螢幕定格顯示邏輯
  - 更新 `saveAnnotatedFrame` 函數

- `src/utils/exportUtils.ts`
  - 新增 `formatAnnotationInfo` 函數
  - 更新 `exportImages` 函數參數
  - 更新 `createAnnotatedImage` 函數

- `src/App.tsx`
  - 傳遞 `colorDisplayMode` 到 `CameraCapture`

#### 新增功能
- 智慧色彩資訊格式化
- 多模式標註圖生成
- 動態資訊卡大小調整

### 6. 效果展示

#### 全螢幕定格
- 📱 **手機端**：資訊卡自動調整大小和位置
- 💻 **桌面端**：高清晰度色彩資訊顯示
- 🎯 **智慧定位**：自動避開重要區域

#### 存圖品質
- 🖼️ **高解析度**：保持原始畫質
- 📊 **完整資訊**：包含所有選定的色度數據
- 🎨 **美觀排版**：專業的資訊卡設計

### 7. 相容性

#### 瀏覽器支援
- ✅ Chrome/Edge (推薦)
- ✅ Firefox
- ✅ Safari
- ✅ 行動裝置瀏覽器

#### 功能相容
- ✅ 與現有錄製功能完全相容
- ✅ 支援所有檢測設定
- ✅ 保持原有效能表現

### 8. 未來擴展

#### 可能的改進
1. **自訂標註樣式**：讓使用者選擇資訊卡樣式
2. **批量標註**：支援多個檢測點的標註
3. **匯出格式擴展**：支援 PDF、SVG 等格式
4. **標註位置記憶**：記住使用者偏好的位置

#### 效能優化
1. **Canvas 快取**：減少重複繪製
2. **非同步處理**：大圖片的非同步標註
3. **記憶體管理**：及時釋放臨時 Canvas

## 總結

本次更新大幅增強了全螢幕定格顯示和存圖功能的實用性，讓使用者能夠根據不同的分析需求獲得對應的色彩資訊。無論是進行 RGB 基礎分析、HSV 色彩研究、還是色溫檢測，都能獲得專業且直觀的視覺化結果。

所有功能都保持了系統的一致性和易用性，為專業色彩分析工作提供了更強大的工具支援。

