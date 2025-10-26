# RGB 檢測演算法詳細說明

## 概述

本系統實現了一套完整的RGB色彩檢測演算法，主要用於分析燈珠圖像中的色彩資訊。系統分為兩個主要部分：Python後端批量處理和前端即時檢測，兩者採用相似的演算法核心但針對不同應用場景進行優化。

## 演算法架構

### 1. 系統架構圖

```
輸入圖像 → 預處理 → 區域檢測 → 色彩分析 → 結果輸出
    ↓         ↓         ↓         ↓         ↓
  原始圖像   去噪處理   邊緣檢測   RGB計算   統計報告
```

### 2. 核心演算法流程

#### 2.1 圖像預處理階段

**目標**：去除干擾像素，保留有效色彩資訊

**數學模型**：

對於像素 $P(x,y) = (R, G, B)$，定義黑白像素判別函數：

$$f_{BW}(P) = \begin{cases}
1 & \text{if } P \text{ is black or white} \\[2ex]
0 & \text{otherwise}
\end{cases}$$

其中：
- **黑色判別**：$R < T_{black} \land G < T_{black} \land B < T_{black}$
- **白色判別**：$R > T_{white} \land G > T_{white} \land B > T_{white}$

**程式碼實現**：

```49:66:pysrc/rgb_analyzer.py
def is_black_or_white(self, pixel, black_threshold=30, white_threshold=225):
    """
    判斷像素是否為黑色或白色
    
    Args:
        pixel: RGB 像素值
        black_threshold: 黑色閾值
        white_threshold: 白色閾值
        
    Returns:
        bool: 是否為黑色或白色
    """
    r, g, b = pixel
    # 判斷是否為黑色（所有通道都低於閾值）
    is_black = r < black_threshold and g < black_threshold and b < black_threshold
    # 判斷是否為白色（所有通道都高於閾值）
    is_white = r > white_threshold and g > white_threshold and b > white_threshold
    return is_black or is_white
```

#### 2.2 區域檢測階段

**目標**：識別圖像中的燈珠區域

**演算法步驟**：

1. **遮罩生成**：
   $$M(x,y) = \begin{cases}
   255 & \text{if } f_{BW}(P(x,y)) = 0 \\[2ex]
   0 & \text{if } f_{BW}(P(x,y)) = 1
   \end{cases}$$

2. **邊緣檢測**：
   - 高斯模糊：$G(x,y) = \frac{1}{2\pi\sigma^2}e^{-\frac{x^2+y^2}{2\sigma^2}}$
   - Canny邊緣檢測：使用雙閾值 $T_1 = 50$, $T_2 = 150$

3. **形態學操作**：
   - 閉運算：$E_{closed} = (E \oplus S) \ominus S$
   - 其中 $S$ 為 $3 \times 3$ 結構元素

**程式碼實現**：

```68:129:pysrc/rgb_analyzer.py
def detect_light_regions(self, image):
    """
    檢測燈珠區域，去除黑白干擾
    
    Args:
        image: 輸入圖片
        
    Returns:
        tuple: (處理後的圖片, 邊緣框圖片, 檢測到的區域數量)
    """
    # 轉換為 RGB
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    height, width, channels = rgb_image.shape
    
    # 創建遮罩，去除黑白像素
    mask = np.ones((height, width), dtype=np.uint8) * 255
    
    for y in range(height):
        for x in range(width):
            pixel = rgb_image[y, x]
            if self.is_black_or_white(pixel):
                mask[y, x] = 0
    
    # 應用遮罩
    masked_image = cv2.bitwise_and(rgb_image, rgb_image, mask=mask)
    
    # 轉換回 BGR 用於 OpenCV 處理
    masked_bgr = cv2.cvtColor(masked_image, cv2.COLOR_RGB2BGR)
    
    # 轉換為灰階進行邊緣檢測
    gray = cv2.cvtColor(masked_bgr, cv2.COLOR_BGR2GRAY)
    
    # 高斯模糊減少噪音
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Canny 邊緣檢測
    edges = cv2.Canny(blurred, 50, 150)
    
    # 形態學操作連接邊緣
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    
    # 尋找輪廓 (OpenCV 4.5.4 相容寫法)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 過濾小輪廓
    min_area = 100
    valid_contours = [cnt for cnt in contours if cv2.contourArea(cnt) > min_area]
    
    # 創建邊緣框圖片
    edge_image = image.copy()
    cv2.drawContours(edge_image, valid_contours, -1, (0, 255, 0), 2)
    
    # 在每個檢測到的區域畫矩形框
    for i, contour in enumerate(valid_contours):
        x, y, w, h = cv2.boundingRect(contour)
        cv2.rectangle(edge_image, (x, y), (x + w, y + h), (255, 0, 0), 2)
        # 添加編號
        cv2.putText(edge_image, str(i + 1), (x, y - 10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)
    
    return masked_image, edge_image, len(valid_contours)
```

#### 2.3 RGB色彩分析階段

**目標**：計算有效區域的平均RGB值

**數學模型**：

對於有效像素集合 $S = \{P_i | f_{BW}(P_i) = 0\}$，計算平均RGB值：

$$\bar{R} = \frac{1}{|S|} \sum_{P_i \in S} R_i$$
$$\bar{G} = \frac{1}{|S|} \sum_{P_i \in S} G_i$$
$$\bar{B} = \frac{1}{|S|} \sum_{P_i \in S} B_i$$

**標準差計算**：
$$\sigma_R = \sqrt{\frac{1}{|S|} \sum_{P_i \in S} (R_i - \bar{R})^2}$$
$$\sigma_G = \sqrt{\frac{1}{|S|} \sum_{P_i \in S} (G_i - \bar{G})^2}$$
$$\sigma_B = \sqrt{\frac{1}{|S|} \sum_{P_i \in S} (B_i - \bar{B})^2}$$

**程式碼實現**：

```131:168:pysrc/rgb_analyzer.py
def calculate_rgb_stats(self, image, mask=None):
    """
    計算圖片的 RGB 統計數據
    
    Args:
        image: 輸入圖片
        mask: 可選的遮罩
        
    Returns:
        dict: RGB 統計數據
    """
    if mask is not None:
        # 只計算遮罩區域的像素
        valid_pixels = image[mask > 0]
    else:
        # 計算整張圖片
        valid_pixels = image.reshape(-1, 3)
    
    if len(valid_pixels) == 0:
        return {
            'avg_r': 0, 'avg_g': 0, 'avg_b': 0,
            'std_r': 0, 'std_g': 0, 'std_b': 0,
            'pixel_count': 0
        }
    
    # 計算平均值和標準差
    avg_rgb = np.mean(valid_pixels, axis=0)
    std_rgb = np.std(valid_pixels, axis=0)
    
    return {
        'avg_r': round(avg_rgb[0], 2),
        'avg_g': round(avg_rgb[1], 2),
        'avg_b': round(avg_rgb[2], 2),
        'std_r': round(std_rgb[0], 2),
        'std_g': round(std_rgb[1], 2),
        'std_b': round(std_rgb[2], 2),
        'pixel_count': len(valid_pixels)
    }
```

## 前端即時檢測演算法

### 3.1 ROI (Region of Interest) 處理

前端系統採用ROI技術，專注於特定區域的色彩分析：

**ROI定義**：
$$ROI = \{(x,y) | x_0 \leq x \leq x_0 + w, y_0 \leq y \leq y_0 + h\}$$

**內縮邊界計算**：
$$margin = \max(T_{min}, \lfloor \min(w,h) \times \frac{P_{margin}}{100} \rfloor)$$

其中：
- $T_{min}$：最小邊距閾值
- $P_{margin}$：邊距百分比

**程式碼實現**：

```186:206:src/utils/opencvProcessor.ts
// 內縮邊界：避免取到 ROI 邊緣的黑邊或背景
const roiMinSide = Math.min(samplingRect.width, samplingRect.height);
const marginPercent = Math.max(0, Math.min(100, (settings as any).edgeMarginPercent ?? 5));
const minMarginPx = Math.max(0, (settings as any).minEdgeMarginPx ?? 2);
const proposedMargin = Math.floor(roiMinSide * (marginPercent / 100));
const edgeMargin = Math.max(minMarginPx, proposedMargin);

// 計算內縮後的取樣區域，過小則回退為不內縮
const innerX = samplingRect.x + edgeMargin;
const innerY = samplingRect.y + edgeMargin;
const innerMaxX = Math.min(maxX, maxX - edgeMargin);
const innerMaxY = Math.min(maxY, maxY - edgeMargin);
const innerWidth = innerMaxX - innerX;
const innerHeight = innerMaxY - innerY;

log('🔍 內縮邊界計算:', {
  '邊距像素': edgeMargin,
  '原始區域': `${samplingRect.x},${samplingRect.y} -> ${maxX},${maxY}`,
  '內縮區域': `${innerX},${innerY} -> ${innerMaxX},${innerMaxY}`,
  '內縮尺寸': `${innerWidth}x${innerHeight}`
});
```

### 3.2 高級像素過濾

前端系統實現了更精細的像素過濾機制：

**飽和度計算**：
$$S = \max(R,G,B) - \min(R,G,B)$$

**過濾條件**：
- 近白像素：$R \geq T_{white} \land G \geq T_{white} \land B \geq T_{white}$
- 近黑像素：$R \leq T_{black} \land G \leq T_{black} \land B \leq T_{black}$
- 低飽和度：$S < T_{saturation}$

**程式碼實現**：

```220:250:src/utils/opencvProcessor.ts
const sampleRegion = (startX: number, startY: number, endX: number, endY: number) => {
  for (let y = startY; y < endY; y += sampleStep) {
    for (let x = startX; x < endX; x += sampleStep) {
      const index = (y * canvas.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      totalR += r;
      totalG += g;
      totalB += b;
      pixelCount++;

      // 計算簡單飽和度（max - min）
      const maxRGB = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const minRGB = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const saturation = maxRGB - minRGB;

      const isNearWhite = r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;
      const isNearBlack = r <= blackThreshold && g <= blackThreshold && b <= blackThreshold;
      const isLowSaturation = saturation < minSaturation;

      if (!(isNearWhite || isNearBlack || isLowSaturation)) {
        filteredR += r;
        filteredG += g;
        filteredB += b;
        filteredCount++;
      }
    }
  }
};
```

### 3.3 採樣策略

**步長採樣**：
$$S_{step} = \max(1, \lfloor T_{step} \rfloor)$$

**採樣點集合**：
$$S = \{(x,y) | x = x_0 + k \cdot S_{step}, y = y_0 + l \cdot S_{step}, k,l \in \mathbb{N}\}$$

## 演算法參數配置

### 4.1 關鍵參數

| 參數名稱 | 預設值 | 說明 | 數學表示 |
|---------|--------|------|----------|
| `black_threshold` | 30 | 黑色判別閾值 | $T_{black}$ |
| `white_threshold` | 225 | 白色判別閾值 | $T_{white}$ |
| `edgeThreshold1` | 50 | Canny低閾值 | $T_1$ |
| `edgeThreshold2` | 150 | Canny高閾值 | $T_2$ |
| `minArea` | 100 | 最小輪廓面積 | $A_{min}$ |
| `blurKernel` | 5 | 高斯模糊核大小 | $K_{blur}$ |
| `edgeMarginPercent` | 5 | ROI邊距百分比 | $P_{margin}$ |
| `minEdgeMarginPx` | 2 | 最小邊距像素 | $T_{min}$ |
| `minSaturation` | 10 | 最小飽和度閾值 | $T_{saturation}$ |
| `sampleStep` | 2 | 採樣步長 | $S_{step}$ |

### 4.2 參數調優建議

**高對比度圖像**：
- 降低 `black_threshold` 至 20
- 提高 `white_threshold` 至 235

**低對比度圖像**：
- 提高 `black_threshold` 至 40
- 降低 `white_threshold` 至 215

**噪聲較多圖像**：
- 增加 `blurKernel` 至 7
- 提高 `minArea` 至 200

## 演算法複雜度分析

### 5.1 時間複雜度

- **像素遍歷**：$O(W \times H)$
- **邊緣檢測**：$O(W \times H)$
- **輪廓查找**：$O(N \log N)$，其中 $N$ 為邊緣像素數
- **RGB計算**：$O(P)$，其中 $P$ 為有效像素數

**總體複雜度**：$O(W \times H)$

### 5.2 空間複雜度

- **圖像存儲**：$O(W \times H)$
- **遮罩存儲**：$O(W \times H)$
- **邊緣圖存儲**：$O(W \times H)$

**總體複雜度**：$O(W \times H)$

## 演算法優勢與限制

### 6.1 優勢

1. **魯棒性強**：通過多重過濾機制，有效去除干擾像素
2. **適應性好**：支援多種參數配置，適應不同圖像條件
3. **精度高**：採用統計方法計算平均RGB值，結果穩定
4. **效率高**：演算法複雜度線性，適合即時處理

### 6.2 限制

1. **參數敏感**：需要根據具體應用調整參數
2. **光照依賴**：強烈光照變化可能影響檢測精度
3. **色彩空間限制**：目前僅支援RGB色彩空間

## 前端色度演算擴展

### 8.1 多色彩空間支援

系統現已支援多種色度演算模式，提供更全面的色彩分析能力：

**HSV色彩空間轉換**：
$$H = \begin{cases}
60° \times \frac{G-B}{\Delta} \mod 6 & \text{if } \max = R \\
60° \times \left(\frac{B-R}{\Delta} + 2\right) & \text{if } \max = G \\
60° \times \left(\frac{R-G}{\Delta} + 4\right) & \text{if } \max = B
\end{cases}$$

$$S = \begin{cases}
0 & \text{if } \max = 0 \\[2ex]
\frac{\Delta}{\max} \times 100\% & \text{otherwise}
\end{cases}$$

$$V = \max \times 100\%$$

**HSL色彩空間轉換**：
$$L = \frac{\max + \min}{2}$$

$$S = \begin{cases}
0 & \text{if } \Delta = 0 \\[2ex]
\frac{\Delta}{1 - |2L - 1|} & \text{otherwise}
\end{cases}$$

**色溫計算（McCamy's Approximation）**：

步驟1：RGB → XYZ（sRGB標準）

$$\begin{bmatrix} X \\ Y \\ Z \end{bmatrix} = \begin{bmatrix} 0.4124564 & 0.3575761 & 0.1804375 \\ 0.2126729 & 0.7151522 & 0.0721750 \\ 0.0193339 & 0.1191920 & 0.9503041 \end{bmatrix} \begin{bmatrix} R_{linear} \\ G_{linear} \\ B_{linear} \end{bmatrix}$$

步驟2：計算色度坐標

$$x = \frac{X}{X+Y+Z}, \quad y = \frac{Y}{X+Y+Z}$$

步驟3：McCamy公式

$$n = \frac{x - 0.3320}{0.1858 - y}$$

$$CCT = 449n^3 + 3525n^2 + 6823.3n + 5520.33$$

### 8.2 實現細節

所有色度轉換在前端即時計算，確保：
- 零延遲：計算複雜度為 O(1)
- 零成本：無需後端支援
- 高精度：使用標準色彩科學公式

## 未來改進方向

### 9.1 演算法優化

1. **自適應閾值**：根據圖像統計特性自動調整閾值
2. **更多色彩空間**：增加CIE LAB、YCbCr等色彩空間
3. **色差計算**：實現ΔE (Delta E)色差計算
4. **機器學習整合**：使用深度學習提升檢測精度

### 9.2 性能優化

1. **GPU加速**：利用WebGL加速計算
2. **並行處理**：Web Workers處理多張圖像
3. **記憶體優化**：減少不必要的記憶體分配

## 結論

本RGB檢測演算法通過結合傳統計算機視覺技術和現代前端技術，實現了高效、準確的色彩分析。系統現已支援RGB、HSV、HSL和色溫等多種色度演算模式，提供專業級的色彩分析能力。演算法的數學基礎紮實，實現細節完善，具有良好的實用性和擴展性。通過持續的參數調優和演算法改進，可以進一步提升系統的性能和適用範圍。

