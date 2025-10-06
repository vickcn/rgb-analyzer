import { RGBData } from '../App';

// OpenCV.js 類型定義
declare global {
  interface Window {
    cv: any;
  }
}

// 載入 OpenCV.js
export const loadOpenCV = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.cv) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    
    script.onload = () => {
      window.cv.onRuntimeInitialized = () => {
        console.log('OpenCV.js 載入成功');
        resolve();
      };
    };
    
    script.onerror = () => {
      reject(new Error('無法載入 OpenCV.js'));
    };
    
    document.head.appendChild(script);
  });
};

// 圖像處理設定介面
interface ProcessingSettings {
  edgeThreshold1: number;
  edgeThreshold2: number;
  minArea: number;
  blurKernel: number;
  enableEdgeDetection: boolean;
  enableColorDetection: boolean;
  enableDetailedLogs: boolean;
}

// RGB 轉 HEX
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

// 計算遮罩區域的平均 RGB 值
const calculateAverageRGB = (src: any, mask: any): { r: number; g: number; b: number; intensity: number } | null => {
  try {
    const cv = window.cv;
    
    // 創建遮罩後的圖像
    const masked = new cv.Mat();
    src.copyTo(masked, mask);

    // 計算平均值
    const mean = cv.mean(masked, mask);
    
    // 計算亮度
    const intensity = (mean[0] + mean[1] + mean[2]) / 3;

    const result = {
      r: Math.round(mean[2]), // OpenCV 使用 BGR 順序
      g: Math.round(mean[1]),
      b: Math.round(mean[0]),
      intensity: intensity
    };

    masked.delete();
    return result;

  } catch (error) {
    console.error('RGB 計算錯誤:', error);
    return null;
  }
};

// 主要圖像處理函數
export const processImageForRGB = async (
  canvas: HTMLCanvasElement,
  settings: ProcessingSettings
): Promise<RGBData | null> => {
  try {
    // Log 函數，根據設定決定是否輸出
    const log = (message: string, ...args: any[]) => {
      if (settings.enableDetailedLogs) {
        console.log(message, ...args);
      }
    };

    log('🔍 開始圖像處理...', new Date().toLocaleTimeString());
    
    // 確保 OpenCV 已載入
    if (!window.cv) {
      log('📦 載入 OpenCV.js...');
      await loadOpenCV();
    }

    const cv = window.cv;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      log('❌ 無法獲取 Canvas 上下文');
      return null;
    }

    // 獲取圖像數據
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    log('📸 圖像尺寸:', canvas.width, 'x', canvas.height);
    
    // 創建 OpenCV Mat 物件
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    const blurred = new cv.Mat();

    try {
      log('🔧 開始 OpenCV 處理...');
      // 轉換為灰階
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // 高斯模糊
      cv.GaussianBlur(gray, blurred, new cv.Size(settings.blurKernel, settings.blurKernel), 0, 0, cv.BORDER_DEFAULT);

      // 簡化處理：直接使用中心點檢測
      log('🎯 使用中心點檢測模式');
      const centerMask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
      const center = new cv.Point(canvas.width / 2, canvas.height / 2);
      const radius = Math.min(canvas.width, canvas.height) / 4;
      cv.circle(centerMask, center, radius, [255, 255, 255, 0], -1);
      const detectedRegions = [centerMask];

      // 計算 RGB 值
      let bestRGB: RGBData | null = null;
      let maxIntensity = 0;

      for (const mask of detectedRegions) {
        const rgb = calculateAverageRGB(src, mask);
        if (rgb && rgb.intensity > maxIntensity) {
          maxIntensity = rgb.intensity;
          bestRGB = {
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
            hex: rgbToHex(rgb.r, rgb.g, rgb.b),
            timestamp: Date.now(),
            x: canvas.width / 2,
            y: canvas.height / 2
          };
        }
        mask.delete();
      }

      if (bestRGB) {
        log('🎨 檢測到 RGB:', bestRGB.hex, '亮度:', Math.round(maxIntensity));
      } else {
        log('❌ 未檢測到有效 RGB 值');
      }

      return bestRGB;

    } finally {
      // 清理所有 Mat 物件
      log('🧹 清理 OpenCV 記憶體...');
      try {
        src.delete();
        gray.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
        blurred.delete();
        log('✅ 記憶體清理完成');
      } catch (cleanupError) {
        console.error('❌ 記憶體清理錯誤:', cleanupError);
      }
    }

  } catch (error) {
    console.error('❌ 圖像處理錯誤:', error);
    return null;
  }
};

// 預設處理設定
export const defaultProcessingSettings: ProcessingSettings = {
  edgeThreshold1: 50,
  edgeThreshold2: 150,
  minArea: 100,
  blurKernel: 5,
  enableEdgeDetection: true,
  enableColorDetection: true,
  enableDetailedLogs: false
};