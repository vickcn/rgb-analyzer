# 色度演算模式功能說明

## 概述

本次更新為 RGB 色光檢測器增加了多種色度演算模式，讓使用者可以在不同的色彩空間中查看檢測結果。所有計算都在前端瀏覽器中完成，無需後端支援，完全相容 Vercel 免費部署方案。

## 新增功能

### 1. 多種色度演算模式

系統現在支援以下五種顯示模式：

#### RGB 模式（預設）
- 顯示紅、綠、藍三原色數值（0-255）
- 提供 HEX 色碼顯示
- 包含色彩長條圖視覺化

#### HSV 模式
- **H (Hue / 色相)**：0-360°，表示色彩的種類
- **S (Saturation / 飽和度)**：0-100%，表示色彩的純度
- **V (Value / 明度)**：0-100%，表示色彩的明暗程度
- 色相長條圖使用彩虹漸層顯示

#### HSL 模式
- **H (Hue / 色相)**：0-360°，與 HSV 相同
- **S (Saturation / 飽和度)**：0-100%，在 HSL 中的定義略有不同
- **L (Lightness / 亮度)**：0-100%，0% 為黑色，50% 為純色，100% 為白色
- 亮度長條圖顯示從黑到純色到白的漸層

#### 色溫模式
- 顯示色溫值（Kelvin）
- 提供色溫描述（如「暖白光」、「日光」、「冷白光」等）
- 包含色溫類別分類（Warm、Neutral、Cool、Daylight）
- 視覺化色溫條顯示從暖光（1000K）到冷光（25000K）的位置

#### 全部顯示模式
- 同時顯示所有色度資訊
- 每個模式可獨立展開/收合
- 提供完整的色彩分析視圖

### 2. 色溫計算演算法

使用 **McCamy's approximation** 標準色溫計算方法：

#### 步驟 1：RGB → XYZ 轉換
使用 sRGB 標準進行轉換，並應用 gamma 校正：

$$R_{linear} = \begin{cases}
\frac{R_{norm}}{12.92} & \text{if } R_{norm} \leq 0.04045 \\[2ex]
\left(\frac{R_{norm} + 0.055}{1.055}\right)^{2.4} & \text{if } R_{norm} > 0.04045
\end{cases}$$

（G 和 B 同理）

然後使用 D65 illuminant 矩陣轉換為 XYZ：

$$\begin{bmatrix}
X \\
Y \\
Z
\end{bmatrix}
=
\begin{bmatrix}
0.4124564 & 0.3575761 & 0.1804375 \\
0.2126729 & 0.7151522 & 0.0721750 \\
0.0193339 & 0.1191920 & 0.9503041
\end{bmatrix}
\begin{bmatrix}
R_{linear} \\
G_{linear} \\
B_{linear}
\end{bmatrix}$$

#### 步驟 2：計算色度坐標
$$x = \frac{X}{X + Y + Z}, \quad y = \frac{Y}{X + Y + Z}$$

#### 步驟 3：McCamy 公式
$$n = \frac{x - 0.3320}{0.1858 - y}$$

$$CCT = 449n^3 + 3525n^2 + 6823.3n + 5520.33$$

#### 色溫範圍與描述

| 色溫範圍 | 描述 | 類別 |
|---------|------|------|
| < 2000K | 極暖光（燭光） | Warm |
| 2000-3000K | 暖光（鎢絲燈） | Warm |
| 3000-3500K | 暖白光 | Warm |
| 3500-4500K | 中性白光 | Neutral |
| 4500-5500K | 自然光 | Neutral |
| 5500-6500K | 日光 | Cool |
| 6500-8000K | 冷白光 | Cool |
| 8000-10000K | 冷光（陰天） | Daylight |
| > 10000K | 極冷光（藍天） | Daylight |

### 3. 資料匯出增強

#### Excel 匯出
匯出的 Excel 檔案現在包含以下欄位：
- 基本資訊：序號、時間戳記、座標
- RGB 數據：R、G、B、HEX
- HSV 數據：HSV_H、HSV_S、HSV_V
- HSL 數據：HSL_H、HSL_S、HSL_L
- 色溫數據：色溫 (K)、色溫描述、色溫類別

#### 圖片匯出
標註圖現在會顯示：
- HEX 色碼
- RGB 數值
- HSV 數值
- HSL 數值（如果有）
- 色溫資訊（如果有）
- 記錄筆數和時間戳記

### 4. 使用者介面更新

#### 檢測控制面板
- 新增「🎨 色度演算模式」下拉選單
- 位於「檢測模式」區塊最上方
- 選擇模式後會即時更新顯示
- 包含模式說明文字

#### 顯示面板
- 根據選擇的模式動態切換顯示內容
- 每種模式都有專屬的視覺設計
- 色相使用彩虹漸層長條圖
- 色溫使用暖色到冷色的漸層條

#### 複製功能
- 支援複製不同模式的格式化字串
- RGB 模式：複製 HEX 或 `rgb(r, g, b)` 格式
- HSV 模式：複製 `hsv(h°, s%, v%)` 格式
- HSL 模式：複製 `hsl(h°, s%, l%)` 格式
- 色溫模式：複製 `<kelvin>K (<description>)` 格式

## 技術實現

### 檔案結構

```
src/
├── utils/
│   ├── colorConversion.ts        # 新增：色彩轉換工具模組
│   ├── colorConversion.test.ts   # 新增：單元測試
│   ├── opencvProcessor.ts        # 更新：整合色度計算
│   └── exportUtils.ts             # 更新：支援新欄位匯出
├── components/
│   ├── RGBDisplay.tsx             # 重構：支援多模式顯示
│   ├── RGBDisplay.css             # 更新：新增模式樣式
│   ├── DetectionControls.tsx     # 更新：新增模式選擇器
│   └── DetectionControls.css     # 更新：選擇器樣式
└── App.tsx                        # 更新：狀態管理
```

### 核心函數

#### `colorConversion.ts`
- `rgbToHSV(r, g, b)` - RGB 轉 HSV
- `rgbToHSL(r, g, b)` - RGB 轉 HSL
- `rgbToColorTemp(r, g, b)` - RGB 轉色溫
- `getHueName(hue)` - 取得色相名稱
- `formatHSV(hsv)` - 格式化 HSV 字串
- `formatHSL(hsl)` - 格式化 HSL 字串
- `formatColorTemp(temp)` - 格式化色溫字串

#### `opencvProcessor.ts`
在 `processImageForRGB` 函數中自動計算所有色度數據：
```typescript
const hsv = rgbToHSV(avgR, avgG, avgB);
const hsl = rgbToHSL(avgR, avgG, avgB);
const colorTemp = rgbToColorTemp(avgR, avgG, avgB);
```

### 資料結構

```typescript
export type ColorDisplayMode = 'rgb' | 'hsv' | 'hsl' | 'colortemp' | 'all';

export interface RGBData {
  // 基本 RGB 數據
  r: number;
  g: number;
  b: number;
  hex: string;
  timestamp: number;
  x: number;
  y: number;
  
  // HSV 值
  hsv_h?: number;
  hsv_s?: number;
  hsv_v?: number;
  
  // HSL 值
  hsl_h?: number;
  hsl_s?: number;
  hsl_l?: number;
  
  // 色溫
  colorTemp?: number;
  colorTempDesc?: string;
  colorTempCategory?: string;
}
```

## 性能考量

### 計算複雜度
- RGB → HSV/HSL：O(1)，簡單數學運算
- RGB → 色溫：O(1)，包含 gamma 校正和矩陣運算
- 所有計算都在毫秒級別完成，不會影響即時檢測性能

### 記憶體使用
- 每筆 RGBData 記錄增加約 40 bytes（新增欄位）
- 對於一般使用場景（< 100 筆記錄），記憶體影響可忽略

### 部署考量
- ✅ 純前端計算，無需後端支援
- ✅ 完全相容 Vercel 免費方案
- ✅ 不需要 Python 後端
- ✅ 所有計算在瀏覽器中完成
- ✅ 支援 PWA 離線運行

## 使用場景

### 1. 燈光色溫檢測
使用色溫模式快速判斷燈光類型（暖光、自然光、冷光）

### 2. 色彩分析
使用 HSV 模式分析色彩的色相、飽和度和明度特性

### 3. 設計配色
使用 HSL 模式調整色彩的亮度，保持色相和飽和度

### 4. 完整記錄
使用全部顯示模式獲取完整的色彩資訊用於文檔記錄

## 未來擴展可能性

1. **更多色彩空間**
   - CIE LAB
   - YCbCr
   - CMYK

2. **色差計算**
   - ΔE (Delta E) 計算
   - 色彩相似度比較

3. **預設模式記憶**
   - 記住使用者上次選擇的模式
   - LocalStorage 持久化

4. **批量模式切換**
   - 歷史記錄面板支援切換顯示模式
   - 3D 視覺化支援不同色彩空間

## 總結

本次更新大幅增強了系統的色彩分析能力，從單純的 RGB 檢測擴展到多種色彩空間和色溫分析。所有功能都在前端實現，保持了系統的輕量和易部署特性，同時提供了專業級的色彩分析工具。

