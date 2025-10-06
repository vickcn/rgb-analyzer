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

// 計算遮罩區域的平均 RGB 值 (目前未使用，保留以備將來擴展)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const calculateAverageRGB = (src: any, mask: any, enableLogs: boolean = false): { r: number; g: number; b: number; intensity: number } | null => {
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
      r: Math.round(mean[2]), // OpenCV 使用 BGR 順序，所以 R = mean[2]
      g: Math.round(mean[1]), // G = mean[1]
      b: Math.round(mean[0]), // B = mean[0]
      intensity: intensity
    };

    // 調試 log：顯示原始 mean 值和轉換後的 RGB
    if (enableLogs) {
      console.log('🔍 OpenCV mean 值:', mean[0], mean[1], mean[2]);
      console.log('🎨 轉換後 RGB:', result.r, result.g, result.b);
    }

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
    
    // 調試：檢查原始圖像數據
    if (settings.enableDetailedLogs) {
      const data = imageData.data;
      const centerIndex = Math.floor((canvas.width * canvas.height / 2) * 4);
      console.log('🔍 Canvas 中心點 RGBA:', data[centerIndex], data[centerIndex + 1], data[centerIndex + 2], data[centerIndex + 3]);
    }
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

      // 直接從 Canvas 獲取中心點 RGB 值（不經過 OpenCV）
      log('🎯 使用 Canvas 直接檢測模式');
      const centerX = Math.floor(canvas.width / 2);
      const centerY = Math.floor(canvas.height / 2);
      const radius = Math.min(canvas.width, canvas.height) / 8;
      
      // 直接從 Canvas 圖像數據獲取 RGB
      const canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = canvasData.data;
      
      let totalR = 0, totalG = 0, totalB = 0;
      let pixelCount = 0;
      
      // 取樣中心區域的像素
      for (let y = centerY - radius; y < centerY + radius; y += 2) {
        for (let x = centerX - radius; x < centerX + radius; x += 2) {
          if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            const index = (y * canvas.width + x) * 4;
            totalR += data[index];
            totalG += data[index + 1];
            totalB += data[index + 2];
            pixelCount++;
          }
        }
      }
      
      if (pixelCount > 0) {
        const avgR = Math.round(totalR / pixelCount);
        const avgG = Math.round(totalG / pixelCount);
        const avgB = Math.round(totalB / pixelCount);
        const intensity = (avgR + avgG + avgB) / 3;
        
        log('🎨 Canvas 直接檢測 RGB:', avgR, avgG, avgB, '亮度:', Math.round(intensity));
        
        const rgbData: RGBData = {
          r: avgR,
          g: avgG,
          b: avgB,
          hex: rgbToHex(avgR, avgG, avgB),
          timestamp: Date.now(),
          x: centerX,
          y: centerY
        };
        
        return rgbData;
      }
      
      return null;

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