#!/usr/bin/env python3
"""
清理 Excel 欄位中的單位
移除各種單位符號（°、%、K、()等）以便於數值計算
"""

import pandas as pd
import re
from pathlib import Path

def clean_column_value(value):
    """
    清理單個值，移除單位
    例如：
    "231.6°" -> 231.6
    "32.7%" -> 32.7
    "19192K" -> 19192
    "RGB(103,110,153)" -> "RGB(103,110,153)"  # 保留組合字串
    """
    if pd.isna(value):
        return value
    
    # 轉換為字串
    str_value = str(value)
    
    # 如果是組合字串（包含逗號或括號），保留原樣
    if ',' in str_value or '(' in str_value or ')' in str_value:
        return str_value
    
    # 如果是單個數值加單位，提取數字
    # 移除常見單位
    patterns = [
        (r'(\d+\.?\d*)\s*°', r'\1'),  # 度數
        (r'(\d+\.?\d*)\s*%', r'\1'),  # 百分比
        (r'(\d+\.?\d*)\s*K', r'\1'),  # 開爾文
    ]
    
    cleaned = str_value
    for pattern, replacement in patterns:
        cleaned = re.sub(pattern, replacement, cleaned)
    
    # 嘗試轉換為數字
    try:
        # 如果是純數字，返回 float
        return float(cleaned) if '.' in cleaned or float(cleaned) != 0 else int(cleaned)
    except ValueError:
        # 如果轉換失敗，返回原字串
        return str_value

def clean_excel_file(input_path, output_path=None):
    """
    清理 Excel 檔案中的單位
    
    Args:
        input_path: 輸入 Excel 檔案路徑
        output_path: 輸出路徑（可選，預設在原檔案名稱後加 _cleaned）
    """
    # 讀取 Excel
    df = pd.read_excel(input_path)
    
    print(f"📂 讀取檔案: {input_path}")
    print(f"📊 原始數據形狀: {df.shape}")
    
    # 需要清理的欄位（移除單位的欄位）
    columns_to_clean = [
        "H (色相)",     # 度數 °
        "S (飽和度)",   # 百分比 %
        "V (明度)",     # 百分比 %
        "HSL_H",        # 度數 °
        "HSL_S",        # 百分比 %
        "HSL_L",        # 百分比 %
        "色溫 (K)",     # 開爾文 K
    ]
    
    print(f"\n🧹 清理欄位:")
    for col in columns_to_clean:
        if col in df.columns:
            print(f"   • {col}")
            df[col] = df[col].apply(clean_column_value)
    
    # 保留的欄位（組合字串，不需要清理）
    keep_as_is = [
        "編號",
        "圖片名稱",
        "RGB",          # "RGB(103,110,153)"
        "HSV",          # "HSV(231.6°,32.7%,60.0%)"
        "HSL",          # "HSL(...)"
        "色溫描述",     # 文字描述
        "分類結果",     # 文字分類
        "邊緣框檔",     # 檔案名
        "R",            # 純數字，不需要處理
        "G",            # 純數字，不需要處理
        "B",            # 純數字，不需要處理
    ]
    
    print(f"\n✓ 保留原樣:")
    for col in keep_as_is:
        if col in df.columns:
            print(f"   • {col}")
    
    # 設定輸出路徑
    if output_path is None:
        input_file = Path(input_path)
        output_path = input_file.parent / f"{input_file.stem}_numeric.xlsx"
    
    # 儲存清理後的 Excel
    df.to_excel(output_path, index=False)
    print(f"\n💾 已儲存至: {output_path}")
    
    # 顯示前幾行作為範例
    print(f"\n📋 清理後的數據範例:")
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', None)
    print(df.head(3).to_string())
    
    return df

def main():
    """主程式"""
    input_path = Path("output/color_analysis_result.xlsx")
    
    if not input_path.exists():
        print(f"❌ 檔案不存在: {input_path}")
        return
    
    # 清理 Excel
    clean_excel_file(input_path)
    
    print(f"\n✅ 完成！清理後的檔案已儲存為 *_numeric.xlsx")

if __name__ == "__main__":
    main()
