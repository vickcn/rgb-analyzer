# RGB 分析器

這是一個用於分析燈珠圖片 RGB 值的 Python 工具，能夠去除黑白干擾並專注於燈珠色光區域。

## 功能特色

- 🎯 **智能區域檢測**: 自動檢測燈珠區域，去除黑白背景干擾
- 📊 **RGB 統計分析**: 計算去除干擾後的 RGB 平均值
- 📁 **自動組織輸出**: 按日期創建資料夾結構
- 📋 **Excel 報告**: 生成包含超連結的詳細報告
- 🖼️ **邊緣框視覺化**: 生成檢測範圍示意圖

## 安裝需求

### 系統需求
- Python 3.7+
- OpenCV 4.5.4.60 (已測試版本)
- NumPy 1.23.5
- Pandas 2.0.2
- OpenPyXL 3.1.2

### 安裝步驟
```bash
# 安裝依賴套件
pip install -r requirements.txt

# 或手動安裝
pip install opencv-python==4.5.4.60 numpy==1.23.5 pandas==2.0.2 openpyxl==3.1.2
```

### 相容性測試
```bash
# 檢查所有套件版本
python check_versions.py

# 測試 OpenCV 4.5.4.60 相容性
python test_opencv_compatibility.py
```

## 使用方法

### 基本使用
```bash
python rgb_analyzer.py
```

### 自訂輸入輸出路徑
```bash
python rgb_analyzer.py --input /path/to/images --output /path/to/output
```

### 參數說明
- `--input, -i`: 輸入圖片資料夾路徑 (預設: imgData)
- `--output, -o`: 輸出資料夾路徑 (預設: output)

## 輸出結構

```
output/
└── YYYYMMDD/                    # 日期資料夾
    ├── 邊緣框檔/                # 邊緣框示意圖
    │   ├── 圖片1_邊緣框.png
    │   ├── 圖片2_邊緣框.png
    │   └── ...
    └── 報告/                    # Excel 報告
        └── RGB分析報告_YYYYMMDD.xlsx
```

## Excel 報告內容

報告包含以下欄位：
- **來源圖片路徑**: 原始圖片路徑（超連結）
- **示意圖路徑**: 邊緣框圖片路徑（超連結）
- **圖片大小**: 圖片尺寸
- **檢測區域數量**: 檢測到的燈珠區域數量
- **整張圖片平均RGB**: 整張圖片的 RGB 平均值
- **去除黑白後平均RGB**: 去除黑白干擾後的 RGB 平均值
- **有效像素數量**: 用於計算的像素數量
- **處理時間**: 處理時間戳記

## 技術細節

### 黑白干擾去除
- 黑色閾值: RGB 值都 < 30
- 白色閾值: RGB 值都 > 225

### 區域檢測流程
1. 去除黑白像素
2. 高斯模糊降噪
3. Canny 邊緣檢測
4. 形態學操作連接邊緣
5. 輪廓檢測和過濾

### 最小區域面積
- 過濾面積小於 100 像素的區域

## 注意事項

- 確保輸入資料夾包含 PNG 格式圖片
- 輸出資料夾會自動創建
- Excel 報告中的超連結需要相對路徑正確
- 建議在處理大量圖片前先測試小批量
