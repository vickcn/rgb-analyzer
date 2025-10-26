#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenCV 4.5.4.60 相容性測試腳本
"""

import cv2
import numpy as np
import sys
from pathlib import Path

def test_opencv_version():
    """測試 OpenCV 版本和基本功能"""
    print(f"OpenCV 版本: {cv2.__version__}")
    
    # 檢查版本是否為 4.5.4.60
    if cv2.__version__ != "4.5.4.60":
        print(f"警告: 當前版本 {cv2.__version__} 與預期版本 4.5.4.60 不符")
    
    # 檢查其他套件版本
    import numpy as np
    import pandas as pd
    import openpyxl
    
    print(f"NumPy 版本: {np.__version__}")
    print(f"Pandas 版本: {pd.__version__}")
    print(f"OpenPyXL 版本: {openpyxl.__version__}")
    
    # 版本檢查
    expected_versions = {
        'numpy': '1.23.5',
        'pandas': '2.0.2',
        'openpyxl': '3.1.2'
    }
    
    actual_versions = {
        'numpy': np.__version__,
        'pandas': pd.__version__,
        'openpyxl': openpyxl.__version__
    }
    
    for package, expected in expected_versions.items():
        actual = actual_versions[package]
        if actual != expected:
            print(f"警告: {package} 版本 {actual} 與預期版本 {expected} 不符")
        else:
            print(f"✓ {package} 版本正確: {actual}")
    
    # 測試基本功能
    try:
        # 創建測試圖片
        test_image = np.zeros((100, 100, 3), dtype=np.uint8)
        test_image[25:75, 25:75] = [255, 0, 0]  # 藍色方塊
        
        # 測試顏色轉換
        gray = cv2.cvtColor(test_image, cv2.COLOR_BGR2GRAY)
        print("✓ 顏色轉換功能正常")
        
        # 測試高斯模糊
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        print("✓ 高斯模糊功能正常")
        
        # 測試 Canny 邊緣檢測
        edges = cv2.Canny(blurred, 50, 150)
        print("✓ Canny 邊緣檢測功能正常")
        
        # 測試形態學操作
        kernel = np.ones((3, 3), np.uint8)
        morphed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
        print("✓ 形態學操作功能正常")
        
        # 測試輪廓檢測 (OpenCV 4.5.4 寫法)
        contours, hierarchy = cv2.findContours(morphed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        print(f"✓ 輪廓檢測功能正常，找到 {len(contours)} 個輪廓")
        
        # 測試輪廓面積計算
        if contours:
            area = cv2.contourArea(contours[0])
            print(f"✓ 輪廓面積計算正常: {area}")
        
        # 測試邊界框計算
        if contours:
            x, y, w, h = cv2.boundingRect(contours[0])
            print(f"✓ 邊界框計算正常: ({x}, {y}, {w}, {h})")
        
        # 測試圖片保存
        test_output = Path("test_output.png")
        cv2.imwrite(str(test_output), test_image)
        if test_output.exists():
            print("✓ 圖片保存功能正常")
            test_output.unlink()  # 刪除測試檔案
        
        print("\n所有 OpenCV 4.5.4.60 功能測試通過！")
        return True
        
    except Exception as e:
        print(f"❌ OpenCV 功能測試失敗: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_rgb_analyzer_import():
    """測試 RGB 分析器導入"""
    try:
        from rgb_analyzer import RGBAnalyzer
        print("✓ RGB 分析器導入成功")
        return True
    except Exception as e:
        print(f"❌ RGB 分析器導入失敗: {str(e)}")
        return False

def main():
    """主測試函數"""
    print("開始 OpenCV 4.5.4.60 相容性測試...\n")
    
    # 測試 OpenCV 功能
    opencv_ok = test_opencv_version()
    
    print("\n" + "="*50 + "\n")
    
    # 測試 RGB 分析器導入
    analyzer_ok = test_rgb_analyzer_import()
    
    print("\n" + "="*50)
    if opencv_ok and analyzer_ok:
        print("✅ 所有測試通過！可以正常使用 RGB 分析器")
        return True
    else:
        print("❌ 部分測試失敗，請檢查環境設定")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
