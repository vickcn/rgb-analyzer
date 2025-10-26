import { RGBData } from '../App';
import { rgbToHSV, rgbToHSL, rgbToColorTemp } from './colorConversion';
import { getGlobalClassifier } from './colorClassifier';

// OpenCV.js 類型定義
declare global {
  interface Window {
    cv: any;
  }
}

// 全域載入狀態追蹤
let isOpenCVLoading = false;
let openCVLoadPromise: Promise<void> | null = null;

// 清理 OpenCV 資源（開發模式熱重載時使用）
export const cleanupOpenCV = () => {
  if (typeof window !== 'undefined') {
    // 移除現有的 OpenCV script
    const existingScript = document.getElementById('opencv-script');
    if (existingScript) {
      existingScript.remove();
    }
    
    // 重置載入狀態
    isOpenCVLoading = false;
    openCVLoadPromise = null;
    
    // 在開發模式下，清理 window.cv（生產模式不建議）
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 開發模式：清理 OpenCV 資源');
      // 不直接刪除 window.cv，因為這可能導致其他問題
      // delete window.cv;
    }
  }
};

// 載入 OpenCV.js
export const loadOpenCV = (): Promise<void> => {
  // 如果已經載入完成
  if (window.cv && window.cv.Mat) {
    return Promise.resolve();
  }

  // 如果正在載入，返回現有的 Promise
  if (isOpenCVLoading && openCVLoadPromise) {
    return openCVLoadPromise;
  }

  // 檢查是否已經有 OpenCV script 標籤
  const existingScript = document.querySelector('script[src*="opencv.js"]');
  if (existingScript) {
    console.log('🔍 發現現有的 OpenCV script，等待初始化...');
    // 如果 script 存在，等待 OpenCV 初始化完成
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 100; // 10秒超時
      
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.cv && window.cv.Mat) {
          console.log('✅ OpenCV 已初始化完成');
          clearInterval(checkInterval);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          console.error('❌ OpenCV 載入超時，移除現有 script 並重試');
          existingScript.remove();
          isOpenCVLoading = false;
          openCVLoadPromise = null;
          // 遞歸重試
          resolve(loadOpenCV());
        }
      }, 100);
    });
  }

  // 開始新的載入過程
  isOpenCVLoading = true;
  openCVLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    script.id = 'opencv-script'; // 添加 ID 以便識別
    
    script.onload = () => {
      // 等待 OpenCV 運行時初始化
      const waitForInit = () => {
        if (window.cv && window.cv.Mat) {
          console.log('OpenCV.js 載入並初始化成功');
          isOpenCVLoading = false;
          resolve();
        } else if (window.cv) {
          // 如果 cv 存在但還沒完全初始化
          window.cv.onRuntimeInitialized = () => {
            console.log('OpenCV.js 運行時初始化完成');
            isOpenCVLoading = false;
            resolve();
          };
        } else {
          // 繼續等待
          setTimeout(waitForInit, 50);
        }
      };
      waitForInit();
    };
    
    script.onerror = () => {
      isOpenCVLoading = false;
      openCVLoadPromise = null;
      reject(new Error('無法載入 OpenCV.js'));
    };
    
    document.head.appendChild(script);
  });

  return openCVLoadPromise;
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
  // 新增：ROI 內縮與像素過濾參數
  edgeMarginPercent: number;    // 內縮比例（%）
  minEdgeMarginPx: number;      // 內縮最小像素
  whiteThreshold: number;       // 近白門檻
  blackThreshold: number;       // 近黑門檻
  minSaturation: number;        // 最小飽和度
  sampleStep: number;           // 取樣步距
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
  settings: ProcessingSettings,
  roi?: { x: number; y: number; width: number; height: number }
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
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
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

      // 直接從 Canvas 圖像數據獲取 RGB（支援 ROI，否則採樣中心區域）
      log('🎯 使用 Canvas 直接檢測模式');
      const canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = canvasData.data;

      // 計算 ROI 邊界（若未提供，使用以中心為主的預設區域）
      const defaultSize = Math.floor(Math.min(canvas.width, canvas.height) / 4);
      const samplingRect = roi ? {
        x: Math.max(0, Math.floor(roi.x)),
        y: Math.max(0, Math.floor(roi.y)),
        width: Math.max(1, Math.floor(roi.width)),
        height: Math.max(1, Math.floor(roi.height))
      } : {
        x: Math.floor(canvas.width / 2 - defaultSize / 2),
        y: Math.floor(canvas.height / 2 - defaultSize / 2),
        width: defaultSize,
        height: defaultSize
      };

      log('🎯 像素採樣區域計算:', {
        '輸入ROI': roi,
        'Canvas尺寸': `${canvas.width}x${canvas.height}`,
        '採樣區域': samplingRect,
        '是否使用預設': !roi
      });

      const maxX = Math.min(canvas.width, samplingRect.x + samplingRect.width);
      const maxY = Math.min(canvas.height, samplingRect.y + samplingRect.height);

      // 內縮邊界：避免取到 ROI 邊緣的黑邊或背景
      const roiMinSide = Math.min(samplingRect.width, samplingRect.height);
      const marginPercent = Math.max(0, Math.min(100, (settings as any).edgeMarginPercent ?? 5));
      const minMarginPx = Math.max(0, (settings as any).minEdgeMarginPx ?? 2);
      const proposedMargin = Math.floor(roiMinSide * (marginPercent / 100));
      const edgeMargin = Math.max(minMarginPx, proposedMargin);

      // 計算內縮後的取樣區域，過小則回退為不內縮
      const innerX = samplingRect.x + edgeMargin;
      const innerY = samplingRect.y + edgeMargin;
      const innerMaxX = Math.min(maxX, maxX - edgeMargin);
      const innerMaxY = Math.min(maxY, maxY - edgeMargin);
      const innerWidth = innerMaxX - innerX;
      const innerHeight = innerMaxY - innerY;

      log('🔍 內縮邊界計算:', {
        '邊距像素': edgeMargin,
        '原始區域': `${samplingRect.x},${samplingRect.y} -> ${maxX},${maxY}`,
        '內縮區域': `${innerX},${innerY} -> ${innerMaxX},${innerMaxY}`,
        '內縮尺寸': `${innerWidth}x${innerHeight}`
      });

      let totalR = 0, totalG = 0, totalB = 0;
      let pixelCount = 0;
      // 過濾後的統計（近白/近黑/低飽和排除）
      let filteredR = 0, filteredG = 0, filteredB = 0;
      let filteredCount = 0;

      const sampleStep = Math.max(1, Math.floor((settings as any).sampleStep ?? 2)); // 每 N px 取樣
      // 過濾條件
      const whiteThreshold = Math.max(0, Math.min(255, (settings as any).whiteThreshold ?? 240));
      const blackThreshold = Math.max(0, Math.min(255, (settings as any).blackThreshold ?? 10));
      const minSaturation = Math.max(0, Math.min(255, (settings as any).minSaturation ?? 10));

      const sampleRegion = (startX: number, startY: number, endX: number, endY: number) => {
        for (let y = startY; y < endY; y += sampleStep) {
          for (let x = startX; x < endX; x += sampleStep) {
            const index = (y * canvas.width + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            totalR += r;
            totalG += g;
            totalB += b;
            pixelCount++;

            // 計算簡單飽和度（max - min）
            const maxRGB = r > g ? (r > b ? r : b) : (g > b ? g : b);
            const minRGB = r < g ? (r < b ? r : b) : (g < b ? g : b);
            const saturation = maxRGB - minRGB;

            const isNearWhite = r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;
            const isNearBlack = r <= blackThreshold && g <= blackThreshold && b <= blackThreshold;
            const isLowSaturation = saturation < minSaturation;

            if (!(isNearWhite || isNearBlack || isLowSaturation)) {
              filteredR += r;
              filteredG += g;
              filteredB += b;
              filteredCount++;
            }
          }
        }
      };

      // 優先用內縮後區域，若太小或沒有取到像素，則回退到原 ROI 區域
      const minEffectiveSize = 8; // 內縮後至少需要 8px 邊長
      if (innerWidth >= minEffectiveSize && innerHeight >= minEffectiveSize) {
        sampleRegion(innerX, innerY, innerMaxX, innerMaxY);
      }
      if (pixelCount === 0) {
        // 回退：不內縮，使用原 ROI
        sampleRegion(samplingRect.x, samplingRect.y, maxX, maxY);
      }
      // 若過濾後仍有像素，優先使用過濾後的平均；否則使用原始平均
      const useFiltered = filteredCount > 0;
      if (useFiltered || pixelCount > 0) {
        const denom = useFiltered ? filteredCount : pixelCount;
        const sumR = useFiltered ? filteredR : totalR;
        const sumG = useFiltered ? filteredG : totalG;
        const sumB = useFiltered ? filteredB : totalB;
        const avgR = Math.round(sumR / denom);
        const avgG = Math.round(sumG / denom);
        const avgB = Math.round(sumB / denom);
        const intensity = (avgR + avgG + avgB) / 3;

        log(
          useFiltered ? '🎨 ROI 過濾後平均 RGB:' : '🎨 ROI 平均 RGB:',
          avgR, avgG, avgB, '亮度:', Math.round(intensity),
          useFiltered ? `(樣本數: ${filteredCount})` : `(樣本數: ${pixelCount})`
        );

        console.log('🎨 最終 RGB 計算結果:', {
          'RGB值': `R:${avgR}, G:${avgG}, B:${avgB}`,
          'HEX值': rgbToHex(avgR, avgG, avgB),
          '亮度': Math.round(intensity),
          '使用過濾': useFiltered,
          '樣本數': useFiltered ? filteredCount : pixelCount,
          '採樣區域': samplingRect,
          '內縮區域': `${innerX},${innerY} -> ${innerMaxX},${innerMaxY}`
        });

        const centerX = Math.floor(samplingRect.x + samplingRect.width / 2);
        const centerY = Math.floor(samplingRect.y + samplingRect.height / 2);

        // 計算 HSV、HSL、色溫
        const hsv = rgbToHSV(avgR, avgG, avgB);
        const hsl = rgbToHSL(avgR, avgG, avgB);
        const colorTemp = rgbToColorTemp(avgR, avgG, avgB);

        const rgbData: RGBData = {
          r: avgR,
          g: avgG,
          b: avgB,
          hex: rgbToHex(avgR, avgG, avgB),
          timestamp: Date.now(),
          x: centerX,
          y: centerY,
          // HSV 值
          hsv_h: hsv.h,
          hsv_s: hsv.s,
          hsv_v: hsv.v,
          // HSL 值
          hsl_h: hsl.h,
          hsl_s: hsl.s,
          hsl_l: hsl.l,
          // 色溫
          colorTemp: colorTemp.kelvin,
          colorTempDesc: colorTemp.description,
          colorTempCategory: colorTemp.category
        };

        // K-NN 分類（若分類器已訓練）
        try {
          const classifier = getGlobalClassifier();
          if (classifier.isModelTrained()) {
            const features = [
              avgR, 
              avgG, 
              avgB, 
              hsv.h, 
              hsv.s, 
              hsv.v, 
              colorTemp.kelvin
            ];
            
            const result = classifier.predict(features);
            rgbData.className = result.className;
            rgbData.confidence = result.confidence;
            
            log('🎯 K-NN 分類結果:', result.className, '信心度:', (result.confidence * 100).toFixed(1) + '%');
          }
        } catch (classifyError) {
          console.warn('⚠️ K-NN 分類失敗:', classifyError);
          // 分類失敗不影響主要功能，繼續返回 RGB 數據
        }

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
  enableDetailedLogs: false,
  // 新增預設值（與 App、DetectionControls 一致）
  edgeMarginPercent: 5,
  minEdgeMarginPx: 2,
  whiteThreshold: 240,
  blackThreshold: 10,
  minSaturation: 10,
  sampleStep: 2
};