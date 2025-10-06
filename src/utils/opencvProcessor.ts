import { RGBData } from '../App';

// 圖像處理設定介面
interface ProcessingSettings {
  edgeThreshold1: number;
  edgeThreshold2: number;
  minArea: number;
  blurKernel: number;
  enableEdgeDetection: boolean;
  enableColorDetection: boolean;
}

// RGB 轉 HEX
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

// 使用 Canvas API 直接檢測 RGB 值
const detectRGBFromCanvas = (canvas: HTMLCanvasElement): RGBData | null => {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 獲取中心區域的圖像數據
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 8;
    
    // 創建一個小區域來檢測
    const sampleSize = Math.max(10, Math.floor(radius / 2));
    const startX = Math.max(0, centerX - sampleSize);
    const startY = Math.max(0, centerY - sampleSize);
    const endX = Math.min(canvas.width, centerX + sampleSize);
    const endY = Math.min(canvas.height, centerY + sampleSize);
    
    const imageData = ctx.getImageData(startX, startY, endX - startX, endY - startY);
    const data = imageData.data;
    
    // 計算平均 RGB 值
    let totalR = 0, totalG = 0, totalB = 0;
    let pixelCount = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      totalR += data[i];     // R
      totalG += data[i + 1]; // G
      totalB += data[i + 2]; // B
      pixelCount++;
    }
    
    if (pixelCount === 0) return null;
    
    const avgR = Math.round(totalR / pixelCount);
    const avgG = Math.round(totalG / pixelCount);
    const avgB = Math.round(totalB / pixelCount);
    const intensity = (avgR + avgG + avgB) / 3;
    
    const rgbData: RGBData = {
      r: avgR,
      g: avgG,
      b: avgB,
      hex: rgbToHex(avgR, avgG, avgB),
      timestamp: Date.now(),
      x: centerX,
      y: centerY
    };
    
    console.log('🎨 Canvas 檢測到 RGB:', rgbData.hex, '亮度:', Math.round(intensity));
    return rgbData;
    
  } catch (error) {
    console.error('❌ Canvas RGB 檢測錯誤:', error);
    return null;
  }
};

// 主要圖像處理函數（簡化版本，不使用 OpenCV）
export const processImageForRGB = async (
  canvas: HTMLCanvasElement,
  settings: ProcessingSettings
): Promise<RGBData | null> => {
  try {
    console.log('🔍 開始圖像處理（Canvas 模式）...', new Date().toLocaleTimeString());
    console.log('📸 圖像尺寸:', canvas.width, 'x', canvas.height);
    
    // 直接使用 Canvas API 檢測 RGB
    const rgbData = detectRGBFromCanvas(canvas);
    
    if (rgbData) {
      console.log('✅ 檢測成功:', rgbData.hex);
      return rgbData;
    } else {
      console.log('❌ 檢測失敗');
      return null;
    }
    
  } catch (error) {
    console.error('❌ 圖像處理錯誤:', error);
    return null;
  }
};

// 載入 OpenCV.js（保留接口但實際上不使用）
export const loadOpenCV = (): Promise<void> => {
  return new Promise((resolve) => {
    console.log('📦 跳過 OpenCV 載入，使用 Canvas 模式');
    resolve();
  });
};

// 預設處理設定
export const defaultProcessingSettings: ProcessingSettings = {
  edgeThreshold1: 50,
  edgeThreshold2: 150,
  minArea: 100,
  blurKernel: 5,
  enableEdgeDetection: true,
  enableColorDetection: true
};