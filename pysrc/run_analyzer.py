#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RGB 分析器執行腳本 - 針對 OpenCV 4.5.4.60 優化
"""

import sys
import os
from pathlib import Path

# 添加當前目錄到 Python 路徑
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def main():
    """主執行函數"""
    print("=" * 60)
    print("RGB 分析器 - OpenCV 4.5.4.60 版本")
    print("=" * 60)
    
    # 設定路徑
    project_root = current_dir.parent
    input_dir = project_root / "imgData"
    output_dir = project_root / "pysrc" / "output"
    
    print(f"📁 輸入資料夾: {input_dir}")
    print(f"📁 輸出資料夾: {output_dir}")
    print()
    
    # 檢查輸入資料夾
    if not input_dir.exists():
        print(f"❌ 錯誤: 輸入資料夾不存在: {input_dir}")
        print("請確保 imgData 資料夾存在並包含 PNG 圖片")
        return False
    
    # 檢查 PNG 圖片
    png_files = list(input_dir.glob("*.png"))
    if not png_files:
        print(f"❌ 錯誤: 在 {input_dir} 中沒有找到 PNG 圖片")
        return False
    
    print(f"📸 找到 {len(png_files)} 張 PNG 圖片:")
    for i, png_file in enumerate(png_files[:5], 1):  # 只顯示前5個
        print(f"   {i}. {png_file.name}")
    if len(png_files) > 5:
        print(f"   ... 還有 {len(png_files) - 5} 張圖片")
    print()
    
    try:
        # 導入並執行分析器
        from rgb_analyzer import RGBAnalyzer
        
        print("🚀 開始處理圖片...")
        analyzer = RGBAnalyzer(str(input_dir), str(output_dir))
        analyzer.process_all_images()
        
        print()
        print("✅ 處理完成！")
        print(f"📊 結果保存在: {output_dir}")
        print(f"📋 Excel 報告: {output_dir / analyzer.today / '報告'}")
        print(f"🖼️  邊緣框圖片: {output_dir / analyzer.today / '邊緣框檔'}")
        
        return True
        
    except ImportError as e:
        print(f"❌ 導入錯誤: {str(e)}")
        print("請確保已安裝所有依賴套件:")
        print("pip install opencv-python==4.5.4.60 numpy==1.23.5 pandas==2.0.2 openpyxl==3.1.2")
        return False
        
    except Exception as e:
        print(f"❌ 處理過程中發生錯誤: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    
    print()
    print("=" * 60)
    if success:
        print("🎉 RGB 分析器執行成功！")
    else:
        print("💥 RGB 分析器執行失敗，請檢查錯誤訊息")
    print("=" * 60)
    
    # 等待用戶輸入
    input("\n按 Enter 鍵退出...")
    sys.exit(0 if success else 1)
