# 色光分析腳本說明

## 腳本列表

### 1. `color_classification_validator.py`
**用途**: 主要驗證腳本，分析圖片並分類色光類型

**功能**:
- 提取圖片中的主導顏色
- 計算 RGB、HSV、HSL、色溫
- 自動分類色光類型
- 生成邊緣框圖片
- 匯出 Excel 報告

**輸出**:
- `output/color_analysis_result.xlsx` - 分析結果
- `output/邊緣框檔/*.png` - 邊緣框圖片

**使用**:
```bash
python color_classification_validator.py
```

---

### 2. `test_single_image.py`
**用途**: 測試單張圖片

**功能**:
- 測試特定圖片的顏色提取
- 顯示詳細的計算過程
- 生成邊緣框視覺化

**使用**:
```bash
python test_single_image.py ../imgData/網白偏綠.png
```

**輸出**: `test/*_測試邊緣框.png`

---

### 3. `extract_headers.py`
**用途**: 提取 Excel 檔案的 header 資訊

**功能**:
- 讀取 Excel 檔案的所有欄位名稱
- 生成包含欄位資訊的 JSON 檔案
- 建議適合的特徵欄位

**使用**:
```bash
python extract_headers.py
```

**輸出**: `output/*_headers.json`

---

### 4. `clean_excel_columns.py`
**用途**: 清理 Excel 欄位中的單位

**問題**: Excel 中的數值欄位可能包含單位（如 "231.6°", "32.7%"），不利於數值計算

**解決**: 移除單位符號，保留純數值

**清理的欄位**:
- `H (色相)`: "231.6°" → 231.6
- `S (飽和度)`: "32.7%" → 32.7
- `V (明度)`: "60.0%" → 60.0
- `色溫 (K)`: "19192K" → 19192

**保留的欄位**:
- `RGB`: "RGB(103,110,153)" (組合字串)
- `HSV`: "HSV(231.6°,32.7%,60.0%)" (組合字串)
- `R`, `G`, `B`: 純數字欄位

**使用**:
```bash
python clean_excel_columns.py
```

**輸出**: `output/color_analysis_result_numeric.xlsx`

---

### 5. `knn_classifier.py`
**用途**: 訓練 K-NN 分類器

**功能**:
- 使用現有標記數據訓練 K-NN 模型
- 支持新樣本的分類預測
- 自動儲存模型供後續使用

**使用**:
```bash
python knn_classifier.py
```

**輸出**:
- `output/knn_model/knn_classifier.joblib` - 分類器模型
- `output/knn_model/knn_scaler.joblib` - 標準化器
- `output/knn_model/knn_config.json` - 模型配置

---

### 6. `knn_predict.py`
**用途**: 使用訓練好的 K-NN 模型預測新樣本

**功能**:
- 載入訓練好的 K-NN 模型
- 預測新樣本的色光類別
- 顯示信心度和所有可能的類別

**使用**:
```bash
python knn_predict.py
```

**程式碼範例**:
```python
from knn_predict import load_knn_model, predict_color

# 載入模型
knn, scaler, config = load_knn_model()

# 預測新樣本
new_sample = {
    'R': 100, 'G': 150, 'B': 200,
    'H (色相)': 210,
    'S (飽和度)': 50, 'V (明度)': 75,
    '色溫 (K)': 6500
}

result = predict_color(knn, scaler, config['feature_columns'], new_sample)
print(f"預測類別: {result['prediction']}")
```

---

### 7. `simple_dbscan.py`
**用途**: DBSCAN 聚類分析

**功能**:
- 使用標記樣本（圖片名稱）進行聚類驗證
- 自動尋找最佳 DBSCAN 參數
- 計算 ARI 和 Silhouette 分數
- 分析群集特徵

**特徵欄位**:
- R, G, B (RGB)
- H (色相), S (飽和度), V (明度)
- 色溫 (K)

**使用**:
```bash
python simple_dbscan.py
```

**輸出**:
- `output/dbscan_simple/dbscan_results.csv`
- `output/dbscan_simple/best_params.json`

---

## 工作流程

### 完整分析流程（推薦）

#### 方式 1: K-NN 分類器（推薦，適合小樣本）
```bash
# 1. 執行顏色分析
python color_classification_validator.py

# 2. 清理單位
python clean_excel_columns.py

# 3. 訓練 K-NN 模型
python knn_classifier.py

# 4. 使用模型預測新樣本
python knn_predict.py
```

#### 方式 2: DBSCAN 聚類分析
```bash
# 1. 執行顏色分析
python color_classification_validator.py

# 2. 提取 header
python extract_headers.py

# 3. 清理單位
python clean_excel_columns.py

# 4. 執行 DBSCAN 分析
python simple_dbscan.py
```

---

## 常見問題

### Q: 為什麼需要清理單位？
**A**: 
- DBSCAN 需要純數值進行計算
- 帶單位的字串無法正確轉換為數值
- 例如 "231.6°" 無法轉換為 231.6

### Q: 為什麼選擇 DBSCAN 而不是 K-means？
**A**: 
- 我們有標記樣本（圖片名稱）
- DBSCAN 可以識別噪音點
- 不需要預先指定群集數量
- 適合探索性的聚類分析

### Q: 如何選擇特徵欄位？
**A**: 
建議使用：
- `R, G, B` - 基礎色彩
- `H, S, V` - HSV 色彩空間
- `色溫 (K)` - 光源特性

組合字串（如 "RGB(...)"）不適合用於計算。

---

## 輸出檔案說明

### `output/color_analysis_result.xlsx`
包含以下欄位：
- **編號**: 序號
- **圖片名稱**: 原始檔案名
- **R, G, B**: 紅綠藍數值
- **RGB**: RGB 組合字串 "RGB(103,110,153)"
- **HSV**: HSV 組合字串
- **H, S, V**: 色相、飽和度、明度（帶單位）
- **色溫 (K)**: 色溫數值
- **分類結果**: 自動分類

### `output/color_analysis_result_numeric.xlsx`
同上，但移除了單位：
- **H, S, V**: 純數值（無 °、%）
- **色溫**: 純數值（無 K）

### `output/dbscan_simple/dbscan_results.csv`
包含：
- 原始數據
- **真實標籤**: 從圖片名稱提取
- **聚類標籤**: DBSCAN 結果

---
