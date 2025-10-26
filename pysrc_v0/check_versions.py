#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
版本檢查腳本 - 驗證所有依賴套件版本
"""

def check_versions():
    """檢查所有套件版本"""
    print("=" * 60)
    print("RGB 分析器 - 套件版本檢查")
    print("=" * 60)
    
    # 預期版本
    expected_versions = {
        'opencv-python': '4.5.4',  # headless 版本顯示為 4.5.4
        'numpy': '1.23.5',
        'pandas': '2.0.2',
        'openpyxl': '3.1.2'
    }
    
    # 實際版本
    actual_versions = {}
    
    # 檢查 OpenCV
    try:
        import cv2
        actual_versions['opencv-python'] = cv2.__version__
        print(f"✅ OpenCV: {cv2.__version__}")
    except ImportError:
        print("❌ OpenCV: 未安裝")
        actual_versions['opencv-python'] = None
    
    # 檢查 NumPy
    try:
        import numpy as np
        actual_versions['numpy'] = np.__version__
        print(f"✅ NumPy: {np.__version__}")
    except ImportError:
        print("❌ NumPy: 未安裝")
        actual_versions['numpy'] = None
    
    # 檢查 Pandas
    try:
        import pandas as pd
        actual_versions['pandas'] = pd.__version__
        print(f"✅ Pandas: {pd.__version__}")
    except ImportError:
        print("❌ Pandas: 未安裝")
        actual_versions['pandas'] = None
    
    # 檢查 OpenPyXL
    try:
        import openpyxl
        actual_versions['openpyxl'] = openpyxl.__version__
        print(f"✅ OpenPyXL: {openpyxl.__version__}")
    except ImportError:
        print("❌ OpenPyXL: 未安裝")
        actual_versions['openpyxl'] = None
    
    print("\n" + "=" * 60)
    print("版本比較結果:")
    print("=" * 60)
    
    all_correct = True
    for package, expected in expected_versions.items():
        actual = actual_versions.get(package)
        if actual is None:
            print(f"❌ {package}: 未安裝 (需要: {expected})")
            all_correct = False
        elif actual == expected:
            print(f"✅ {package}: {actual} (正確)")
        else:
            print(f"⚠️  {package}: {actual} (預期: {expected})")
            all_correct = False
    
    print("\n" + "=" * 60)
    if all_correct:
        print("🎉 所有套件版本都正確！")
        print("您可以正常使用 RGB 分析器")
    else:
        print("⚠️  部分套件版本不符或未安裝")
        print("建議執行以下命令安裝正確版本:")
        print("pip install opencv-python==4.5.4.60 numpy==1.23.5 pandas==2.0.2 openpyxl==3.1.2")
    print("=" * 60)
    
    return all_correct

if __name__ == "__main__":
    check_versions()
