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
}

// 主要圖像處理函數
export const processImageForRGB = async (
  canvas: HTMLCanvasElement,
  settings: ProcessingSettings
): Promise<RGBData | null> => {
  try {
    // 確保 OpenCV 已載入
    if (!window.cv) {
      await loadOpenCV();
    }

    const cv = window.cv;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 獲取圖像數據
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 創建 OpenCV Mat 物件
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      // 轉換為灰階
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // 高斯模糊
      const blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(settings.blurKernel, settings.blurKernel), 0, 0, cv.BORDER_DEFAULT);

      let detectedRegions: cv.Mat[] = [];

      if (settings.enableEdgeDetection) {
        // Canny 邊緣檢測
        cv.Canny(blurred, edges, settings.edgeThreshold1, settings.edgeThreshold2);

        // 形態學操作 - 閉合小孔洞
        const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
        const closed = new cv.Mat();
        cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);

        // 尋找輪廓
        cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        // 過濾輪廓
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          const area = cv.contourArea(contour);
          
          if (area > settings.minArea) {
            // 創建遮罩
            const mask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
            cv.drawContours(mask, contours, i, new cv.Scalar(255), -1);
            detectedRegions.push(mask);
          }
        }

        // 清理
        kernel.delete();
        closed.delete();
      }

      if (settings.enableColorDetection) {
        // HSV 色彩空間檢測
        const hsv = new cv.Mat();
        cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
        cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

        // 檢測亮色區域 (高亮度)
        const lowerBound = new cv.Scalar(0, 0, 100); // 低飽和度，高亮度
        const upperBound = new cv.Scalar(180, 255, 255);
        const colorMask = new cv.Mat();
        cv.inRange(hsv, lowerBound, upperBound, colorMask);

        // 形態學操作
        const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(10, 10));
        const processedMask = new cv.Mat();
        cv.morphologyEx(colorMask, processedMask, cv.MORPH_CLOSE, kernel);
        cv.morphologyEx(processedMask, processedMask, cv.MORPH_OPEN, kernel);

        // 尋找色光區域輪廓
        const colorContours = new cv.MatVector();
        const colorHierarchy = new cv.Mat();
        cv.findContours(processedMask, colorContours, colorHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        // 過濾色光區域
        for (let i = 0; i < colorContours.size(); i++) {
          const contour = colorContours.get(i);
          const area = cv.contourArea(contour);
          
          if (area > settings.minArea) {
            const mask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
            cv.drawContours(mask, colorContours, i, new cv.Scalar(255), -1);
            detectedRegions.push(mask);
          }
        }

        // 清理
        hsv.delete();
        colorMask.delete();
        processedMask.delete();
        kernel.delete();
        colorContours.delete();
        colorHierarchy.delete();
        lowerBound.delete();
        upperBound.delete();
      }

      // 如果沒有檢測到區域，使用中心點
      if (detectedRegions.length === 0) {
        const centerMask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
        const center = new cv.Point(canvas.width / 2, canvas.height / 2);
        const radius = Math.min(canvas.width, canvas.height) / 8;
        cv.circle(centerMask, center, radius, new cv.Scalar(255), -1);
        detectedRegions.push(centerMask);
        center.delete();
      }

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

      return bestRGB;

    } finally {
      // 清理所有 Mat 物件
      src.delete();
      gray.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      blurred?.delete();
    }

  } catch (error) {
    console.error('圖像處理錯誤:', error);
    return null;
  }
};

// 計算遮罩區域的平均 RGB 值
const calculateAverageRGB = (src: cv.Mat, mask: cv.Mat): { r: number; g: number; b: number; intensity: number } | null => {
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

// RGB 轉 HEX
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
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
