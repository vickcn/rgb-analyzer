import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RGBData } from '../App';
import { processImageForRGB } from '../utils/opencvProcessor';
import './CameraCapture.css';

interface CameraCaptureProps {
  isActive: boolean;
  onCameraToggle: (active: boolean) => void;
  onRGBDetected: (rgbData: RGBData) => void;
  detectionSettings: {
    edgeThreshold1: number;
    edgeThreshold2: number;
    minArea: number;
    blurKernel: number;
    enableEdgeDetection: boolean;
    enableColorDetection: boolean;
    enableDetailedLogs: boolean;
    // 新增設定（同步 utils）
    edgeMarginPercent: number;
    minEdgeMarginPx: number;
    whiteThreshold: number;
    blackThreshold: number;
    minSaturation: number;
    sampleStep: number;
  };
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  recordingData: RGBData[];
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({
  isActive,
  onCameraToggle,
  onRGBDetected,
  detectionSettings,
  isRecording,
  onStartRecording,
  onStopRecording,
  recordingData,
  canvasRef: externalCanvasRef
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 使用外部傳入的 ref 或內部 ref
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastRGB, setLastRGB] = useState<RGBData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // ROI 使用「容器內本地座標」(左上角為 0,0)
  const [roi, setRoi] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // ROI 大小控制（用於觸控模式）
  const [roiSize, setRoiSize] = useState<number>(25); // 預設 25% 的畫面大小
  const roiRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const draggingRef = useRef<{ type: 'move' | 'resize'; offsetX: number; offsetY: number } | null>(null);
  const lastProcessTime = useRef<number>(0);
  const lastFrameData = useRef<ImageData | null>(null);
  const frameChangeThreshold = useRef<number>(0.1); // 10% 的像素變化閾值

  // Log 函數，根據設定決定是否輸出
  const log = useCallback((message: string, ...args: any[]) => {
    if (detectionSettings.enableDetailedLogs) {
      console.log(message, ...args);
    }
  }, [detectionSettings.enableDetailedLogs]);

  // 全螢幕切換功能
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        // 進入全螢幕
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        } else if ((containerRef.current as any).mozRequestFullScreen) {
          await (containerRef.current as any).mozRequestFullScreen();
        } else if ((containerRef.current as any).msRequestFullscreen) {
          await (containerRef.current as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
        log('🖥️ 進入全螢幕模式');
      } else {
        // 退出全螢幕
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
        log('🖥️ 退出全螢幕模式');
      }
    } catch (err) {
      console.error('全螢幕切換失敗:', err);
      setError('全螢幕功能不支援或發生錯誤');
    }
  }, [isFullscreen, log]);

  // 檢測畫面變動
  const detectFrameChange = useCallback((currentFrame: ImageData, lastFrame: ImageData | null): boolean => {
    if (!lastFrame) {
      log('🆕 首次影格，需要檢測');
      return true;
    }

    const currentData = currentFrame.data;
    const lastData = lastFrame.data;
    const totalPixels = currentData.length / 4; // RGBA 4個通道
    let changedPixels = 0;

    // 取樣檢測（每10個像素檢測一次，提高效率）
    for (let i = 0; i < currentData.length; i += 40) { // 每10個像素檢測一次
      const r1 = currentData[i];
      const g1 = currentData[i + 1];
      const b1 = currentData[i + 2];
      
      const r2 = lastData[i];
      const g2 = lastData[i + 1];
      const b2 = lastData[i + 2];
      
      // 計算顏色差異
      const colorDiff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
      if (colorDiff > 30) { // 顏色差異閾值
        changedPixels++;
      }
    }

    const changeRatio = changedPixels / (totalPixels / 10);
    log(`📊 畫面變化率: ${(changeRatio * 100).toFixed(1)}%`);
    
    return changeRatio > frameChangeThreshold.current;
  }, [log]);

  // 初始化攝影機
  const initializeCamera = useCallback(async () => {
    try {
      setError('');
      
      // 請求攝影機權限
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // 後置攝影機
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // 等待影片載入
        await new Promise((resolve, reject) => {
          if (videoRef.current) {
            const video = videoRef.current;
            
            const handleLoadedMetadata = () => {
              video.removeEventListener('loadedmetadata', handleLoadedMetadata);
              video.removeEventListener('error', handleError);
              resolve(void 0);
            };
            
            const handleError = (err: Event) => {
              video.removeEventListener('loadedmetadata', handleLoadedMetadata);
              video.removeEventListener('error', handleError);
              reject(err);
            };
            
            video.addEventListener('loadedmetadata', handleLoadedMetadata);
            video.addEventListener('error', handleError);
            
            // 如果已經載入完成，直接 resolve
            if (video.readyState >= 1) {
              handleLoadedMetadata();
            }
          } else {
            reject(new Error('Video element not found'));
          }
        });
        
        log('📷 攝影機初始化完成，設定狀態為 true');
        onCameraToggle(true);
        
        // 等待狀態更新後再開始處理
        setTimeout(() => {
          log('📷 攝影機狀態已更新，開始處理');
          setIsProcessing(true);
        }, 100);
      }
    } catch (err) {
      console.error('攝影機初始化失敗:', err);
      setError('無法存取攝影機，請確認已授予攝影機權限');
      onCameraToggle(false);
    }
  }, [onCameraToggle, log]);

  // 停止攝影機
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current.load(); // 重置 video 元素
      } catch (err) {
        console.warn('停止攝影機時發生錯誤:', err);
      }
    }
    
    onCameraToggle(false);
    setIsProcessing(false);
    setIsFrozen(false); // 重置定格狀態
  }, [onCameraToggle]);

  // 保存原圖（不含任何標註）
  const saveRawFrame = useCallback(async () => {
    if (!canvasRef.current || !isActive) {
      setError('無法保存圖片：攝影機未啟動或畫布不存在');
      return;
    }

    try {
      setIsSaving(true);
      setError('');

      // 創建一個新的 canvas 來保存圖片
      const saveCanvas = document.createElement('canvas');
      const saveCtx = saveCanvas.getContext('2d', { willReadFrequently: true });
      
      if (!saveCtx) {
        throw new Error('無法創建畫布上下文');
      }

      // 設定保存畫布的尺寸
      saveCanvas.width = canvasRef.current.width;
      saveCanvas.height = canvasRef.current.height;

      // 繪製當前畫面到保存畫布
      saveCtx.drawImage(canvasRef.current, 0, 0);

      // 轉換為 blob 並下載
      saveCanvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('無法生成圖片數據');
        }

        // 創建下載連結
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // 生成檔案名稱（包含時間戳）
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `rgb-raw-${timestamp}.png`;
        
        // 觸發下載
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 清理 URL
        URL.revokeObjectURL(url);
        
        log('✅ 原圖已成功保存');
      }, 'image/png', 0.95);

    } catch (err) {
      console.error('保存圖片失敗:', err);
      setError('保存圖片失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  }, [isActive, log, canvasRef]);

  // 保存標註圖（含 ROI、RGB 資訊、避開 ROI 的資訊卡、色塊）
  const saveAnnotatedFrame = useCallback(async () => {
    if (!canvasRef.current || !isActive) {
      setError('無法保存圖片：攝影機未啟動或畫布不存在');
      return;
    }

    try {
      setIsSaving(true);
      setError('');

      const sourceCanvas = canvasRef.current;
      const saveCanvas = document.createElement('canvas');
      const ctx = saveCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('無法創建畫布上下文');

      saveCanvas.width = sourceCanvas.width;
      saveCanvas.height = sourceCanvas.height;
      ctx.drawImage(sourceCanvas, 0, 0);

      // 繪製 ROI 框（手動 ROI 或預設 ROI）
      let roiCanvas: { x: number; y: number; width: number; height: number } | null = null;
      if (roi && containerRef.current) {
        // 手動 ROI：從容器座標轉換到 Canvas 座標（考慮 object-fit: contain）
        const canvasRect = sourceCanvas.getBoundingClientRect();
        const video = videoRef.current;
        
        if (video) {
          // 計算 video 在 container 中的實際顯示區域
          const videoAspectRatio = video.videoWidth / video.videoHeight;
          const containerAspectRatio = canvasRect.width / canvasRect.height;
          
          let displayWidth, displayHeight, displayX, displayY;
          
          if (videoAspectRatio > containerAspectRatio) {
            displayWidth = canvasRect.width;
            displayHeight = canvasRect.width / videoAspectRatio;
            displayX = 0;
            displayY = (canvasRect.height - displayHeight) / 2;
          } else {
            displayHeight = canvasRect.height;
            displayWidth = canvasRect.height * videoAspectRatio;
            displayX = (canvasRect.width - displayWidth) / 2;
            displayY = 0;
          }
          
          // 檢查 ROI 是否在實際顯示區域內
          const roiInDisplayArea = roi.x >= displayX && 
                                  roi.y >= displayY && 
                                  roi.x + roi.width <= displayX + displayWidth &&
                                  roi.y + roi.height <= displayY + displayHeight;
          
          if (roiInDisplayArea) {
            // ROI 在顯示區域內，轉換到 Canvas 座標
            const scaleX = sourceCanvas.width / displayWidth;
            const scaleY = sourceCanvas.height / displayHeight;
            roiCanvas = {
              x: Math.max(0, Math.round((roi.x - displayX) * scaleX)),
              y: Math.max(0, Math.round((roi.y - displayY) * scaleY)),
              width: Math.max(1, Math.round(roi.width * scaleX)),
              height: Math.max(1, Math.round(roi.height * scaleY))
            };
          } else {
            // ROI 超出顯示區域，使用預設 ROI
            const defaultSize = Math.min(sourceCanvas.width, sourceCanvas.height) / 4;
            roiCanvas = {
              x: Math.floor(sourceCanvas.width / 2 - defaultSize / 2),
              y: Math.floor(sourceCanvas.height / 2 - defaultSize / 2),
              width: Math.floor(defaultSize),
              height: Math.floor(defaultSize)
            };
          }
        } else {
          // 沒有 video 元素，使用簡單轉換
          const scaleX = sourceCanvas.width / canvasRect.width;
          const scaleY = sourceCanvas.height / canvasRect.height;
          roiCanvas = {
            x: Math.max(0, Math.round(roi.x * scaleX)),
            y: Math.max(0, Math.round(roi.y * scaleY)),
            width: Math.max(1, Math.round(roi.width * scaleX)),
            height: Math.max(1, Math.round(roi.height * scaleY))
          };
        }
      } else {
        // 預設 ROI：畫面中央區域（與 processFrame 邏輯一致）
        const defaultSize = Math.min(sourceCanvas.width, sourceCanvas.height) / 4;
        roiCanvas = {
          x: Math.floor(sourceCanvas.width / 2 - defaultSize / 2),
          y: Math.floor(sourceCanvas.height / 2 - defaultSize / 2),
          width: Math.floor(defaultSize),
          height: Math.floor(defaultSize)
        };
      }
      
      // 繪製 ROI 框
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3;
      ctx.strokeRect(roiCanvas.x, roiCanvas.y, roiCanvas.width, roiCanvas.height);

      // 計算資訊卡位置（盡量避開 ROI）
      const padding = 12;
      const swatchSize = Math.max(12, Math.floor(Math.min(saveCanvas.width, saveCanvas.height) / 20));
      const fontSize = Math.max(14, Math.floor(swatchSize * 0.9));
      ctx.font = `${fontSize}px Arial`;
      const textLines: string[] = [];
      if (lastRGB) {
        textLines.push(`HEX: ${lastRGB.hex}`);
        textLines.push(`RGB: ${lastRGB.r}, ${lastRGB.g}, ${lastRGB.b}`);
      } else {
        textLines.push('尚無 RGB 數據');
      }
      const textWidth = Math.max(...textLines.map(line => ctx.measureText(line).width));
      const cardWidth = padding + swatchSize + padding + textWidth + padding;
      const cardHeight = padding + fontSize * textLines.length + padding;

      // 嘗試四個角落，找一個不與 ROI 相交的位置
      const candidatePositions = [
        { x: padding, y: padding }, // 左上
        { x: saveCanvas.width - cardWidth - padding, y: padding }, // 右上
        { x: padding, y: saveCanvas.height - cardHeight - padding }, // 左下
        { x: saveCanvas.width - cardWidth - padding, y: saveCanvas.height - cardHeight - padding }, // 右下
      ];
      let cardX = candidatePositions[0].x;
      let cardY = candidatePositions[0].y;
      const intersects = (a: {x:number;y:number;width:number;height:number}, b: {x:number;y:number;width:number;height:number}) =>
        !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
      if (roiCanvas) {
        for (const pos of candidatePositions) {
          const cardRect = { x: pos.x, y: pos.y, width: cardWidth, height: cardHeight };
          if (!intersects(cardRect, roiCanvas)) {
            cardX = pos.x;
            cardY = pos.y;
            break;
          }
        }
      }

      // 背板：白色 70% 透明
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
      // 邊框（可有可無，保留細黑線）
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);

      // 顏色色塊（黑邊）
      const swatchX = cardX + padding;
      const swatchY = cardY + Math.floor((cardHeight - swatchSize) / 2);
      const swatchColor = lastRGB ? lastRGB.hex : '#000000';
      ctx.fillStyle = swatchColor;
      ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);

      // 文字（黑色）
      ctx.fillStyle = '#000000';
      let textX = swatchX + swatchSize + padding;
      let textY = cardY + padding + fontSize * 0.9; // 第一行基線
      for (const line of textLines) {
        ctx.fillText(line, textX, textY);
        textY += fontSize;
      }

      // 轉換為 blob 並下載
      saveCanvas.toBlob((blob) => {
        if (!blob) throw new Error('無法生成圖片數據');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `rgb-annotated-${timestamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        log('✅ 標註圖已成功保存');
      }, 'image/png', 0.95);

    } catch (err) {
      console.error('保存圖片失敗:', err);
      setError('保存圖片失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  }, [isActive, roi, lastRGB, log, canvasRef]);

  // 同步 ROI 狀態至 ref，供處理迴圈即時讀取
  useEffect(() => {
    roiRef.current = roi;
  }, [roi]);

  // 開始圖像處理
  const startProcessing = useCallback(() => {
    // console.log('🔍 startProcessing 被調用，isActive:', isActive);
    if (!videoRef.current || !canvasRef.current) {
      console.log('❌ 無法開始處理：video 或 canvas 不存在');
      return;
    }
    
    // console.log('🚀 開始圖像處理循環，isActive:', isActive);
    setIsProcessing(true);
    
    let frameCount = 0;
    const processFrame = async () => {
      // 直接檢查攝影機狀態，不依賴 isActive
      const isCameraReady = videoRef.current && canvasRef.current && streamRef.current;
      log('🔄 processFrame 被調用，攝影機就緒:', isCameraReady);
      
      if (!isCameraReady) {
        console.log('❌ 停止處理：攝影機未就緒');
        setIsProcessing(false);
        return;
      }

      // 定格：若已定格，不更新畫面與偵測（保留上一次畫面）
      if (isFrozen) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // 限制處理頻率，每 500ms 處理一次（降低頻率）
      const now = Date.now();
      if (now - lastProcessTime.current < 500) {
        log('⏱️ 跳過處理，等待時間未到');
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastProcessTime.current = now;
      
      frameCount++;
      log('📹 處理影格 #' + frameCount, new Date().toLocaleTimeString());

      try {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) return;

        // 設定畫布尺寸
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        log('📐 畫布尺寸設定為:', canvas.width, 'x', canvas.height);

        // 繪製當前影格
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        log('🖼️ 影格繪製完成');
        
        // 檢測畫面變動
        const currentFrameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hasSignificantChange = detectFrameChange(currentFrameData, lastFrameData.current);
        lastFrameData.current = currentFrameData;
        
        if (!hasSignificantChange) {
          log('😴 畫面無顯著變化，跳過檢測');
          // 繼續處理下一幀
          animationFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }
        
        log('🔄 畫面有顯著變化，開始檢測');
        
        // 計算 ROI（若無，預設為畫面中央區域）
        let roiCanvas: { x: number; y: number; width: number; height: number };
        const currentRoi = roiRef.current;
        if (currentRoi && containerRef.current) {
          const canvasRect = canvas.getBoundingClientRect();
          
          // 計算 video 在 container 中的實際顯示區域（考慮 object-fit: contain）
          const videoAspectRatio = video.videoWidth / video.videoHeight;
          const containerAspectRatio = canvasRect.width / canvasRect.height;
          
          let displayWidth, displayHeight, displayX, displayY;
          
          if (videoAspectRatio > containerAspectRatio) {
            // video 較寬，以寬度為準
            displayWidth = canvasRect.width;
            displayHeight = canvasRect.width / videoAspectRatio;
            displayX = 0;
            displayY = (canvasRect.height - displayHeight) / 2;
          } else {
            // video 較高，以高度為準
            displayHeight = canvasRect.height;
            displayWidth = canvasRect.height * videoAspectRatio;
            displayX = (canvasRect.width - displayWidth) / 2;
            displayY = 0;
          }
          
          // 檢查 ROI 是否在實際顯示區域內
          const roiInDisplayArea = currentRoi.x >= displayX && 
                                  currentRoi.y >= displayY && 
                                  currentRoi.x + currentRoi.width <= displayX + displayWidth &&
                                  currentRoi.y + currentRoi.height <= displayY + displayHeight;
          
          if (roiInDisplayArea) {
            // ROI 在顯示區域內，轉換到 Canvas 座標
            const scaleX = canvas.width / displayWidth;
            const scaleY = canvas.height / displayHeight;
            roiCanvas = {
              x: Math.max(0, Math.round((currentRoi.x - displayX) * scaleX)),
              y: Math.max(0, Math.round((currentRoi.y - displayY) * scaleY)),
              width: Math.max(1, Math.round(currentRoi.width * scaleX)),
              height: Math.max(1, Math.round(currentRoi.height * scaleY))
            };
          } else {
            // ROI 超出顯示區域，使用預設 ROI
            const defaultSize = Math.min(canvas.width, canvas.height) / 4;
            roiCanvas = {
              x: Math.floor(canvas.width / 2 - defaultSize / 2),
              y: Math.floor(canvas.height / 2 - defaultSize / 2),
              width: Math.floor(defaultSize),
              height: Math.floor(defaultSize)
            };
          }
        } else {
          const defaultSize = Math.min(canvas.width, canvas.height) / 4;
          roiCanvas = {
            x: Math.floor(canvas.width / 2 - defaultSize / 2),
            y: Math.floor(canvas.height / 2 - defaultSize / 2),
            width: Math.floor(defaultSize),
            height: Math.floor(defaultSize)
          };
        }

        // 在 Canvas 上繪製 ROI 框
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(roiCanvas.x, roiCanvas.y, roiCanvas.width, roiCanvas.height);
        log('🎯 檢測 ROI 已繪製');

        // 使用 OpenCV 處理圖像
        log('🔧 調用 OpenCV 處理函數...');
        const rgbData = await processImageForRGB(
          canvas,
          detectionSettings,
          roiCanvas
        );

        if (rgbData) {
          log('✅ 檢測到 RGB 數據:', rgbData.hex);
          setLastRGB(rgbData);
          onRGBDetected(rgbData);
        } else {
          log('❌ 未檢測到 RGB 數據');
        }

        // 繼續處理下一幀
        log('➡️ 準備處理下一幀');
        animationFrameRef.current = requestAnimationFrame(processFrame);
      } catch (err) {
        console.error('❌ 圖像處理錯誤:', err);
        setIsProcessing(false);
      }
    };

    log('🎬 開始第一幀處理');
    processFrame();
  }, [isActive, onRGBDetected, isFrozen, canvasRef, detectFrameChange, detectionSettings, log]);

  // 處理攝影機狀態變化
  useEffect(() => {
    console.log('🔄 useEffect 觸發，isActive:', isActive, 'streamRef.current:', !!streamRef.current);
    if (isActive && !streamRef.current) {
      console.log('🚀 啟動攝影機...');
      initializeCamera();
    } else if (!isActive && streamRef.current) {
      console.log('🛑 停止攝影機...');
      stopCamera();
    }
  }, [isActive, initializeCamera, stopCamera]);

  // 當 isProcessing 變為 true 時啟動圖像處理
  useEffect(() => {
    if (isProcessing && isActive && videoRef.current && canvasRef.current) {
      // console.log('🚀 啟動圖像處理循環');
      startProcessing();
    }
  }, [isProcessing, isActive, startProcessing, canvasRef]);

  // 定格時暫停 video 播放（保持最後畫面）；解除定格時恢復播放
  useEffect(() => {
    if (!videoRef.current) return;
    if (isFrozen) {
      try { 
        videoRef.current.pause(); 
      } catch (err) {
        console.warn('暫停影片失敗:', err);
      }
    } else {
      try { 
        // 檢查影片是否已經載入並準備播放
        if (videoRef.current.readyState >= 2) {
          videoRef.current.play().catch(err => {
            console.warn('播放影片失敗:', err);
          });
        }
      } catch (err) {
        console.warn('播放影片失敗:', err);
      }
    }
  }, [isFrozen]);

  // 監聽全螢幕狀態變化
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // 清理資源
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="camera-capture">
      <div className="camera-controls">
        <button
          className={`camera-toggle ${isActive ? 'active' : ''}`}
          onClick={() => onCameraToggle(!isActive)}
        >
          {isActive ? '📷 停止攝影機' : '📷 啟動攝影機'}
        </button>
        {isActive && (
          <button
            className={`freeze-toggle ${isFrozen ? 'active' : ''}`}
            onClick={() => setIsFrozen(prev => !prev)}
          >
            {isFrozen ? '⏯ 解除定格' : '⏸ 定格畫面'}
          </button>
        )}
        {isActive && (
          <>
            <button
              className={`fullscreen-toggle ${isFullscreen ? 'active' : ''}`}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? '🔳 退出全螢幕' : '🔲 全螢幕'}
            </button>
            <button
              className={`save-image ${isSaving ? 'saving' : ''}`}
              onClick={saveRawFrame}
              disabled={isSaving}
            >
              {isSaving ? '💾 保存中...' : '💾 保存原圖'}
            </button>
            <button
              className={`save-image ${isSaving ? 'saving' : ''}`}
              onClick={saveAnnotatedFrame}
              disabled={isSaving}
            >
              {isSaving ? '💾 保存中...' : '💾 保存標註圖'}
            </button>
            <button
              className={`recording-toggle ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? onStopRecording : onStartRecording}
              disabled={isSaving}
            >
              {isRecording ? `🔴 停止紀錄 (${recordingData.length}/10)` : '⏺️ 開始時段紀錄'}
            </button>
          </>
        )}
        
        {isProcessing && (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <span>處理中...</span>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
          <button onClick={initializeCamera}>重試</button>
        </div>
      )}

      <div className="camera-preview" ref={containerRef}
        onMouseDown={(e) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const startX = e.clientX - rect.left; // 轉為容器本地座標
          const startY = e.clientY - rect.top;
          if (!roi) {
            // 新建 ROI：以當前點為中心建立預設大小（使用 roiSize 設定）
            const video = videoRef.current;
            if (video) {
              // 計算 video 在 container 中的實際顯示區域
              const videoAspectRatio = video.videoWidth / video.videoHeight;
              const containerAspectRatio = rect.width / rect.height;
              
              let displayWidth, displayHeight, displayX, displayY;
              
              if (videoAspectRatio > containerAspectRatio) {
                displayWidth = rect.width;
                displayHeight = rect.width / videoAspectRatio;
                displayX = 0;
                displayY = (rect.height - displayHeight) / 2;
              } else {
                displayHeight = rect.height;
                displayWidth = rect.height * videoAspectRatio;
                displayX = (rect.width - displayWidth) / 2;
                displayY = 0;
              }
              
              // 確保點擊位置在顯示區域內
              const clickInDisplayArea = startX >= displayX && startX <= displayX + displayWidth &&
                                        startY >= displayY && startY <= displayY + displayHeight;
              
              if (clickInDisplayArea) {
                const size = Math.min(displayWidth, displayHeight) * (roiSize / 100);
                const x = Math.max(displayX, Math.min(startX - size / 2, displayX + displayWidth - size));
                const y = Math.max(displayY, Math.min(startY - size / 2, displayY + displayHeight - size));
                const newRoi = { x, y, width: size, height: size };
                setRoi(newRoi);
                // 設為可移動狀態，offset 使得中心在手指附近
                draggingRef.current = { type: 'move', offsetX: startX - x, offsetY: startY - y };
              }
            } else {
              // 沒有 video 元素，使用簡單計算
              const size = Math.min(rect.width, rect.height) * (roiSize / 100);
              const x = Math.max(0, Math.min(startX - size / 2, rect.width - size));
              const y = Math.max(0, Math.min(startY - size / 2, rect.height - size));
              const newRoi = { x, y, width: size, height: size };
              setRoi(newRoi);
              // 設為可移動狀態，offset 使得中心在手指附近
              draggingRef.current = { type: 'move', offsetX: startX - x, offsetY: startY - y };
            }
          } else {
            // 只支援移動，不支援拖曳調整大小
            draggingRef.current = { type: 'move', offsetX: startX - roi.x, offsetY: startY - roi.y };
          }
        }}
        onMouseMove={(e) => {
          if (!draggingRef.current || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left; // 容器本地座標
          const y = e.clientY - rect.top;
          setRoi(prev => {
            if (!prev || !draggingRef.current) return prev;
            
            // 計算實際顯示區域
            const video = videoRef.current;
            if (video) {
              const videoAspectRatio = video.videoWidth / video.videoHeight;
              const containerAspectRatio = rect.width / rect.height;
              
              let displayWidth, displayHeight, displayX, displayY;
              
              if (videoAspectRatio > containerAspectRatio) {
                displayWidth = rect.width;
                displayHeight = rect.width / videoAspectRatio;
                displayX = 0;
                displayY = (rect.height - displayHeight) / 2;
              } else {
                displayHeight = rect.height;
                displayWidth = rect.height * videoAspectRatio;
                displayX = (rect.width - displayWidth) / 2;
                displayY = 0;
              }
              
              // 限制 ROI 移動在實際顯示區域內
              const newX = Math.max(displayX, Math.min(x - draggingRef.current.offsetX, displayX + displayWidth - prev.width));
              const newY = Math.max(displayY, Math.min(y - draggingRef.current.offsetY, displayY + displayHeight - prev.height));
              return { ...prev, x: newX, y: newY };
            } else {
              // 沒有 video 元素，使用簡單計算
              const newX = Math.max(0, Math.min(x - draggingRef.current.offsetX, rect.width - prev.width));
              const newY = Math.max(0, Math.min(y - draggingRef.current.offsetY, rect.height - prev.height));
              return { ...prev, x: newX, y: newY };
            }
          });
        }}
        onMouseUp={() => { draggingRef.current = null; }}
        onMouseLeave={() => { draggingRef.current = null; }}
        onTouchStart={(e) => {
          if (!containerRef.current) return;
          if (e.touches.length === 0) return;
          const touch = e.touches[0];
          const rect = containerRef.current.getBoundingClientRect();
          const startX = touch.clientX - rect.left;
          const startY = touch.clientY - rect.top;
          e.preventDefault();
          if (!roi) {
            // 觸控新建 ROI：使用 roiSize 設定的大小置中於觸點
            const video = videoRef.current;
            if (video) {
              // 計算 video 在 container 中的實際顯示區域
              const videoAspectRatio = video.videoWidth / video.videoHeight;
              const containerAspectRatio = rect.width / rect.height;
              
              let displayWidth, displayHeight, displayX, displayY;
              
              if (videoAspectRatio > containerAspectRatio) {
                displayWidth = rect.width;
                displayHeight = rect.width / videoAspectRatio;
                displayX = 0;
                displayY = (rect.height - displayHeight) / 2;
              } else {
                displayHeight = rect.height;
                displayWidth = rect.height * videoAspectRatio;
                displayX = (rect.width - displayWidth) / 2;
                displayY = 0;
              }
              
              // 確保觸控位置在顯示區域內
              const touchInDisplayArea = startX >= displayX && startX <= displayX + displayWidth &&
                                        startY >= displayY && startY <= displayY + displayHeight;
              
              if (touchInDisplayArea) {
                const size = Math.min(displayWidth, displayHeight) * (roiSize / 100);
                const x = Math.max(displayX, Math.min(startX - size / 2, displayX + displayWidth - size));
                const y = Math.max(displayY, Math.min(startY - size / 2, displayY + displayHeight - size));
                setRoi({ x, y, width: size, height: size });
                draggingRef.current = { type: 'move', offsetX: startX - x, offsetY: startY - y };
              }
            } else {
              // 沒有 video 元素，使用簡單計算
              const size = Math.min(rect.width, rect.height) * (roiSize / 100);
              const x = Math.max(0, Math.min(startX - size / 2, rect.width - size));
              const y = Math.max(0, Math.min(startY - size / 2, rect.height - size));
              setRoi({ x, y, width: size, height: size });
              draggingRef.current = { type: 'move', offsetX: startX - x, offsetY: startY - y };
            }
          } else {
            // 只支援移動，不支援觸控調整大小
            draggingRef.current = { type: 'move', offsetX: startX - roi.x, offsetY: startY - roi.y };
          }
        }}
        onTouchMove={(e) => {
          if (!draggingRef.current || !containerRef.current) return;
          if (e.touches.length === 0) return;
          const touch = e.touches[0];
          const rect = containerRef.current.getBoundingClientRect();
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;
          e.preventDefault();
          setRoi(prev => {
            if (!prev || !draggingRef.current) return prev;
            
            // 計算實際顯示區域
            const video = videoRef.current;
            if (video) {
              const videoAspectRatio = video.videoWidth / video.videoHeight;
              const containerAspectRatio = rect.width / rect.height;
              
              let displayWidth, displayHeight, displayX, displayY;
              
              if (videoAspectRatio > containerAspectRatio) {
                displayWidth = rect.width;
                displayHeight = rect.width / videoAspectRatio;
                displayX = 0;
                displayY = (rect.height - displayHeight) / 2;
              } else {
                displayHeight = rect.height;
                displayWidth = rect.height * videoAspectRatio;
                displayX = (rect.width - displayWidth) / 2;
                displayY = 0;
              }
              
              // 限制 ROI 移動在實際顯示區域內
              const newX = Math.max(displayX, Math.min(x - draggingRef.current.offsetX, displayX + displayWidth - prev.width));
              const newY = Math.max(displayY, Math.min(y - draggingRef.current.offsetY, displayY + displayHeight - prev.height));
              return { ...prev, x: newX, y: newY };
            } else {
              // 沒有 video 元素，使用簡單計算
              const newX = Math.max(0, Math.min(x - draggingRef.current.offsetX, rect.width - prev.width));
              const newY = Math.max(0, Math.min(y - draggingRef.current.offsetY, rect.height - prev.height));
              return { ...prev, x: newX, y: newY };
            }
          });
        }}
        onTouchEnd={() => { draggingRef.current = null; }}
        onTouchCancel={() => { draggingRef.current = null; }}
        onWheel={(e) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const localX = e.clientX - rect.left;
          const localY = e.clientY - rect.top;
          if (!roi) {
            // 若尚未建立 ROI，先建立一個以游標為中心的預設 ROI（本地座標）
            const video = videoRef.current;
            if (video) {
              // 計算 video 在 container 中的實際顯示區域
              const videoAspectRatio = video.videoWidth / video.videoHeight;
              const containerAspectRatio = rect.width / rect.height;
              
              let displayWidth, displayHeight, displayX, displayY;
              
              if (videoAspectRatio > containerAspectRatio) {
                displayWidth = rect.width;
                displayHeight = rect.width / videoAspectRatio;
                displayX = 0;
                displayY = (rect.height - displayHeight) / 2;
              } else {
                displayHeight = rect.height;
                displayWidth = rect.height * videoAspectRatio;
                displayX = (rect.width - displayWidth) / 2;
                displayY = 0;
              }
              
              // 確保游標位置在顯示區域內
              const cursorInDisplayArea = localX >= displayX && localX <= displayX + displayWidth &&
                                         localY >= displayY && localY <= displayY + displayHeight;
              
              if (cursorInDisplayArea) {
                const size = Math.min(displayWidth, displayHeight) * (roiSize / 100);
                const x = Math.max(displayX, Math.min(localX - size / 2, displayX + displayWidth - size));
                const y = Math.max(displayY, Math.min(localY - size / 2, displayY + displayHeight - size));
                setRoi({ x, y, width: size, height: size });
                return;
              }
            } else {
              // 沒有 video 元素，使用簡單計算
              const size = Math.min(rect.width, rect.height) * (roiSize / 100);
              const x = Math.max(0, Math.min(localX - size / 2, rect.width - size));
              const y = Math.max(0, Math.min(localY - size / 2, rect.height - size));
              setRoi({ x, y, width: size, height: size });
              return;
            }
          }
          // 移除滾輪縮放功能，大小由滑桿控制
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="video-preview"
          style={{ display: isActive ? 'block' : 'none' }}
        />
        
        <canvas
          ref={canvasRef}
          className="processing-canvas"
          style={{ display: isActive ? 'block' : 'none' }}
        />
        
        {!isActive && (
          <div className="camera-placeholder">
            <div className="placeholder-icon">📷</div>
            <p>點擊上方按鈕啟動攝影機</p>
            <small>需要攝影機權限以進行RGB檢測</small>
          </div>
        )}

        {/* ROI 覆蓋層（以視窗座標繪製）*/}
        {roi && (
          <div
            style={{
              position: 'absolute',
              left: roi.x,
              top: roi.y,
              width: roi.width,
              height: roi.height,
              border: '2px solid #00ff88',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.2) inset',
              zIndex: 20,
              pointerEvents: 'none'
            }}
          />
        )}

        {/* 全螢幕模式下的浮動控制面板 */}
        {isFullscreen && (
          <div className="floating-controls">
            <button
              className={`freeze-toggle ${isFrozen ? 'active' : ''}`}
              onClick={() => setIsFrozen(prev => !prev)}
            >
              {isFrozen ? '⏯ 解除定格' : '⏸ 定格畫面'}
            </button>
            <button
              className={`save-image ${isSaving ? 'saving' : ''}`}
              onClick={saveRawFrame}
              disabled={isSaving}
            >
              {isSaving ? '💾 保存中...' : '💾 保存原圖'}
            </button>
            <button
              className={`save-image ${isSaving ? 'saving' : ''}`}
              onClick={saveAnnotatedFrame}
              disabled={isSaving}
            >
              {isSaving ? '💾 保存中...' : '💾 保存標註圖'}
            </button>
            <button
              className={`fullscreen-toggle active`}
              onClick={toggleFullscreen}
            >
              🔳 退出全螢幕
            </button>
          </div>
        )}

        {/* 定格時的 RGB 資訊覆蓋層 */}
        {isFrozen && lastRGB && (
          <div className="rgb-overlay">
            <div className="rgb-info-card">
              <div className="color-swatch" style={{ backgroundColor: lastRGB.hex }}></div>
              <div className="rgb-text">
                <div className="hex-value">HEX: {lastRGB.hex}</div>
                <div className="rgb-value">RGB: {lastRGB.r}, {lastRGB.g}, {lastRGB.b}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="camera-info">
        <p>💡 將攝影機對準燈珠或色光區域進行檢測</p>
        <p>🔍 系統會自動識別邊緣和色光區塊</p>
        <div className="motion-sensitivity">
          <label>畫面變動敏感度:</label>
          <input
            type="range"
            min="0.01"
            max="0.5"
            step="0.01"
            value={frameChangeThreshold.current}
            onChange={(e) => {
              frameChangeThreshold.current = parseFloat(e.target.value);
              log('🎛️ 敏感度調整為:', (frameChangeThreshold.current * 100).toFixed(1) + '%');
            }}
          />
          <span>{(frameChangeThreshold.current * 100).toFixed(1)}%</span>
        </div>
        <div className="roi-size-control">
          <label>檢測框大小:</label>
          <input
            type="range"
            min="10"
            max="50"
            step="5"
            value={roiSize}
            onChange={(e) => {
              const newSize = parseInt(e.target.value);
              setRoiSize(newSize);
              
              // 如果已有 ROI，即時調整其大小
              if (roi && containerRef.current && videoRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const video = videoRef.current;
                
                // 計算 video 在 container 中的實際顯示區域
                const videoAspectRatio = video.videoWidth / video.videoHeight;
                const containerAspectRatio = rect.width / rect.height;
                
                let displayWidth, displayHeight, displayX, displayY;
                
                if (videoAspectRatio > containerAspectRatio) {
                  displayWidth = rect.width;
                  displayHeight = rect.width / videoAspectRatio;
                  displayX = 0;
                  displayY = (rect.height - displayHeight) / 2;
                } else {
                  displayHeight = rect.height;
                  displayWidth = rect.height * videoAspectRatio;
                  displayX = (rect.width - displayWidth) / 2;
                  displayY = 0;
                }
                
                // 檢查 ROI 是否在實際顯示區域內
                const roiInDisplayArea = roi.x >= displayX && 
                                        roi.y >= displayY && 
                                        roi.x + roi.width <= displayX + displayWidth &&
                                        roi.y + roi.height <= displayY + displayHeight;
                
                if (roiInDisplayArea) {
                  // 使用顯示區域的大小作為基準
                  const baseSize = Math.min(displayWidth, displayHeight);
                  const newPixelSize = Math.max(20, baseSize * (newSize / 100)); // 確保最小 20px
                  
                  // 保持 ROI 中心點不變，調整大小
                  const centerX = roi.x + roi.width / 2;
                  const centerY = roi.y + roi.height / 2;
                  const newX = Math.max(displayX, Math.min(centerX - newPixelSize / 2, displayX + displayWidth - newPixelSize));
                  const newY = Math.max(displayY, Math.min(centerY - newPixelSize / 2, displayY + displayHeight - newPixelSize));
                  
                  setRoi({
                    x: newX,
                    y: newY,
                    width: newPixelSize,
                    height: newPixelSize
                  });
                } else {
                  // ROI 不在顯示區域內，重新建立一個在顯示區域中央的 ROI
                  const baseSize = Math.min(displayWidth, displayHeight);
                  const newPixelSize = Math.max(20, baseSize * (newSize / 100));
                  const newX = displayX + (displayWidth - newPixelSize) / 2;
                  const newY = displayY + (displayHeight - newPixelSize) / 2;
                  
                  setRoi({
                    x: newX,
                    y: newY,
                    width: newPixelSize,
                    height: newPixelSize
                  });
                }
              }
              
              log('📐 檢測框大小調整為:', newSize + '%');
            }}
          />
          <span>{roiSize}%</span>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;
