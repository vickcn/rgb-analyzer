#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RGB 分析器測試腳本
"""

import sys
import os
from pathlib import Path

# 添加當前目錄到 Python 路徑
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from rgb_analyzer import RGBAnalyzer

def test_analyzer():
    """測試 RGB 分析器"""
    print("開始測試 RGB 分析器...")
    
    # 設定路徑
    project_root = current_dir.parent
    input_dir = project_root / "imgData"
    output_dir = project_root / "test_output"
    
    print(f"輸入資料夾: {input_dir}")
    print(f"輸出資料夾: {output_dir}")
    
    # 檢查輸入資料夾是否存在
    if not input_dir.exists():
        print(f"錯誤: 輸入資料夾不存在: {input_dir}")
        return False
    
    # 檢查是否有 PNG 圖片
    png_files = list(input_dir.glob("*.png"))
    if not png_files:
        print(f"錯誤: 在 {input_dir} 中沒有找到 PNG 圖片")
        return False
    
    print(f"找到 {len(png_files)} 張 PNG 圖片")
    
    try:
        # 創建分析器
        analyzer = RGBAnalyzer(str(input_dir), str(output_dir))
        
        # 處理所有圖片
        analyzer.process_all_images()
        
        print("測試完成！")
        print(f"結果保存在: {output_dir}")
        return True
        
    except Exception as e:
        print(f"測試失敗: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_analyzer()
    sys.exit(0 if success else 1)
