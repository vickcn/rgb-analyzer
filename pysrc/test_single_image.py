#!/usr/bin/env python3
"""
測試單張圖片的顏色檢測
"""

import cv2
import numpy as np
import sys
from pathlib import Path

# 從主腳本導入函數
from color_classification_validator import (
    extract_dominant_color, 
    rgb_to_hsv, 
    rgb_to_color_temp, 
    classify_color,
    draw_edge_detection
)

def test_image(image_path):
    """測試單張圖片"""
    print(f"\n{'='*60}")
    print(f"測試圖片: {Path(image_path).name}")
    print(f"{'='*60}")
    
    # 讀取圖片
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"無法讀取圖片: {image_path}")
        return
    
    print(f"圖片尺寸: {img.shape[1]} x {img.shape[0]}")
    print(f"像素總數: {img.shape[0] * img.shape[1]:,}")
    
    # 提取主導顏色
    print(f"\n提取主導顏色中...")
    r, g, b = extract_dominant_color(img)
    print(f"\n✓ 主導顏色: RGB({r}, {g}, {b})")
    
    # 計算 HSV 和色溫
    hue, sat, val = rgb_to_hsv(r, g, b)
    color_temp = rgb_to_color_temp(r, g, b)
    
    print(f"\n色度參數:")
    print(f"  HSV: H={hue:.1f}°, S={sat:.1f}%, V={val:.1f}%")
    print(f"  色溫: {color_temp:.0f}K")
    
    # 分類
    classification = classify_color(hue, sat, val, color_temp)
    print(f"\n分類結果: {classification}")
    
    print(f"\n{'='*60}")
    
    # 生成邊緣框圖片
    edge_image = draw_edge_detection(img)
    
    # 輸出到 pysrc/test/ 目錄
    output_dir = Path(__file__).parent / "test"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = output_dir / f"{Path(image_path).stem}_測試邊緣框.png"
    cv2.imwrite(str(output_path), edge_image)
    print(f"邊緣框圖片已儲存: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("使用方法: python test_single_image.py <圖片路徑>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    test_image(image_path)
