#!/usr/bin/env python3
"""
提取 Excel 檔案的 header 並存成 JSON
"""

import pandas as pd
import json
from pathlib import Path

def extract_headers_to_json(excel_path, output_path=None):
    """
    從 Excel 檔案提取 header 並存成 JSON
    
    Args:
        excel_path: Excel 檔案路徑
        output_path: JSON 輸出路徑（可選）
    """
    try:
        # 讀取 Excel 檔案（只讀取第一行來獲取 header）
        df = pd.read_excel(excel_path, nrows=0)
        
        # 獲取所有欄位名稱
        headers = df.columns.tolist()
        
        # 創建 header 資訊字典
        header_info = {
            "source_file": str(excel_path),
            "total_columns": len(headers),
            "headers": headers,
            "headers_with_index": {i: header for i, header in enumerate(headers)},
            "suggested_features_for_kmeans": [
                "R", "G", "B", 
                "H (色相)", "S (飽和度)", "V (明度)",
                "HSL_H", "HSL_S", "HSL_L",
                "色溫 (K)"
            ],
            "grouping_column": "圖片名稱",
            "description": {
                "RGB": "紅綠藍三原色數值 (0-255)",
                "HSV": "色相、飽和度、明度",
                "HSL": "色相、飽和度、亮度", 
                "色溫": "色溫數值 (Kelvin)",
                "分類結果": "自動分類的色光類型"
            }
        }
        
        # 設定輸出路徑
        if output_path is None:
            excel_file = Path(excel_path)
            output_path = excel_file.parent / f"{excel_file.stem}_headers.json"
        
        # 儲存為 JSON
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(header_info, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Header 已提取並儲存至: {output_path}")
        print(f"📊 總共 {len(headers)} 個欄位")
        print(f"🔍 建議用於 K-means 的特徵欄位:")
        for feature in header_info["suggested_features_for_kmeans"]:
            if feature in headers:
                print(f"   ✓ {feature}")
            else:
                print(f"   ✗ {feature} (不存在)")
        
        # 顯示所有 header
        print(f"\n📋 所有欄位:")
        for i, header in enumerate(headers):
            print(f"   {i:2d}: {header}")
        
        return header_info
        
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        return None

if __name__ == "__main__":
    # Excel 檔案路徑
    excel_path = Path(__file__).parent / "output" / "color_analysis_result.xlsx"
    
    if not excel_path.exists():
        print(f"❌ 檔案不存在: {excel_path}")
        exit(1)
    
    # 提取 header
    extract_headers_to_json(excel_path)
