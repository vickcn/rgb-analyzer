#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RGB 分析器 - 處理燈珠圖片並計算 RGB 平均值
去除黑白干擾，專注於燈珠色光區域
"""

import cv2
import numpy as np
import os
import glob
from datetime import datetime
import pandas as pd
from pathlib import Path
import argparse
import logging

# 設定日誌
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RGBAnalyzer:
    def __init__(self, input_dir="imgData", output_dir="output"):
        """
        初始化 RGB 分析器
        
        Args:
            input_dir (str): 輸入圖片資料夾路徑
            output_dir (str): 輸出資料夾路徑
        """
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.today = datetime.now().strftime("%Y%m%d")
        
        # 創建輸出資料夾結構
        self.setup_output_directories()
        
    def setup_output_directories(self):
        """創建輸出資料夾結構"""
        self.date_dir = self.output_dir / self.today
        self.edge_dir = self.date_dir / "邊緣框檔"
        self.report_dir = self.date_dir / "報告"
        
        # 創建所有必要的資料夾
        for dir_path in [self.date_dir, self.edge_dir, self.report_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"創建資料夾: {dir_path}")
    
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
    
    def process_image(self, image_path):
        """
        處理單張圖片
        
        Args:
            image_path: 圖片路徑
            
        Returns:
            dict: 處理結果
        """
        logger.info(f"處理圖片: {image_path}")
        
        # 讀取圖片
        image = cv2.imread(str(image_path))
        if image is None:
            logger.error(f"無法讀取圖片: {image_path}")
            return None
        
        # 獲取圖片基本信息
        height, width = image.shape[:2]
        image_size = f"{width}x{height}"
        
        # 檢測燈珠區域
        masked_image, edge_image, region_count = self.detect_light_regions(image)
        
        # 計算整張圖片的 RGB 平均值
        full_image_stats = self.calculate_rgb_stats(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        
        # 計算去除黑白後的 RGB 平均值
        masked_stats = self.calculate_rgb_stats(masked_image)
        
        # 生成輸出檔名
        image_name = image_path.stem
        edge_filename = f"{image_name}_邊緣框.png"
        edge_path = self.edge_dir / edge_filename
        
        # 保存邊緣框圖片
        cv2.imwrite(str(edge_path), edge_image)
        
        # 準備結果數據
        result = {
            '來源圖片路徑': str(image_path.absolute()),
            '示意圖路徑': str(edge_path.absolute()),
            '圖片大小': image_size,
            '檢測區域數量': region_count,
            '整張圖片平均R': full_image_stats['avg_r'],
            '整張圖片平均G': full_image_stats['avg_g'],
            '整張圖片平均B': full_image_stats['avg_b'],
            '去除黑白後平均R': masked_stats['avg_r'],
            '去除黑白後平均G': masked_stats['avg_g'],
            '去除黑白後平均B': masked_stats['avg_b'],
            '有效像素數量': masked_stats['pixel_count'],
            '處理時間': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        logger.info(f"完成處理: {image_path} - 檢測到 {region_count} 個區域")
        return result
    
    def process_all_images(self):
        """處理所有圖片並生成報告"""
        # 尋找所有 PNG 圖片
        image_pattern = str(self.input_dir / "*.png")
        image_files = glob.glob(image_pattern)
        
        if not image_files:
            logger.warning(f"在 {self.input_dir} 中沒有找到 PNG 圖片")
            return
        
        logger.info(f"找到 {len(image_files)} 張圖片")
        
        # 處理所有圖片
        results = []
        for image_file in image_files:
            image_path = Path(image_file)
            result = self.process_image(image_path)
            if result:
                results.append(result)
        
        # 生成 Excel 報告
        self.generate_excel_report(results)
        
        logger.info(f"處理完成！共處理 {len(results)} 張圖片")
        logger.info(f"結果保存在: {self.date_dir}")
    
    def generate_excel_report(self, results):
        """生成 Excel 報告"""
        if not results:
            logger.warning("沒有結果數據，跳過 Excel 報告生成")
            return
        
        # 創建 DataFrame
        df = pd.DataFrame(results)
        
        # 重新排列欄位順序
        column_order = [
            '來源圖片路徑', '示意圖路徑', '圖片大小', '檢測區域數量',
            '整張圖片平均R', '整張圖片平均G', '整張圖片平均B',
            '去除黑白後平均R', '去除黑白後平均G', '去除黑白後平均B',
            '有效像素數量', '處理時間'
        ]
        df = df[column_order]
        
        # 生成 Excel 檔名
        excel_filename = f"RGB分析報告_{self.today}.xlsx"
        excel_path = self.report_dir / excel_filename
        
        # 創建 Excel writer
        with pd.ExcelWriter(str(excel_path), engine='openpyxl') as writer:
            # 寫入數據
            df.to_excel(writer, sheet_name='RGB分析結果', index=False)
            
            # 獲取工作表
            worksheet = writer.sheets['RGB分析結果']
            
            # 添加超連結 (OpenCV 4.5.4 相容寫法)
            for idx, row in df.iterrows():
                # 來源圖片超連結
                source_cell = worksheet.cell(row=idx + 2, column=1)
                source_cell.hyperlink = f"file://{row['來源圖片路徑']}"
                source_cell.style = "Hyperlink"
                
                # 示意圖超連結
                edge_cell = worksheet.cell(row=idx + 2, column=2)
                edge_cell.hyperlink = f"file://{row['示意圖路徑']}"
                edge_cell.style = "Hyperlink"
            
            # 調整欄位寬度
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
        
        logger.info(f"Excel 報告已生成: {excel_path}")

def main():
    """主函數"""
    parser = argparse.ArgumentParser(description='RGB 分析器 - 處理燈珠圖片並計算 RGB 平均值')
    parser.add_argument('--input', '-i', default='imgData', 
                       help='輸入圖片資料夾路徑 (預設: imgData)')
    parser.add_argument('--output', '-o', default='output', 
                       help='輸出資料夾路徑 (預設: output)')
    
    args = parser.parse_args()
    
    # 檢查輸入資料夾是否存在
    if not os.path.exists(args.input):
        logger.error(f"輸入資料夾不存在: {args.input}")
        return
    
    # 創建分析器並處理圖片
    analyzer = RGBAnalyzer(args.input, args.output)
    analyzer.process_all_images()

if __name__ == "__main__":
    main()
