import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RGBData } from '../App';
import { processImageForRGB } from '../utils/opencvProcessor';
import RGB3DVisualization from './RGB3DVisualization';
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
  shouldFreeze?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  show3DVisualization?: boolean;
  onClose3DVisualization?: () => void;
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
  canvasRef: externalCanvasRef,
  shouldFreeze = false,
  onFullscreenChange,
  show3DVisualization = false,
  onClose3DVisualization,
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
  const isFrozenRef = useRef(false);
  
  // 同步 isFrozen 狀態到 ref
  useEffect(() => {
    isFrozenRef.current = isFrozen;
  }, [isFrozen]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastRGB, setLastRGB] = useState<RGBData | null>(null);
  const [averageRGB, setAverageRGB] = useState<RGBData | null>(null);
  // ROI 使用「容器內本地座標」(左上角為 0,0)
  const [roi, setRoi] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // ROI 大小控制（用於觸控模式）
  const [roiSize, setRoiSize] = useState<number>(25); // 預設 25% 的畫面大小
  const roiRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const draggingRef = useRef<{ type: 'move' | 'resize'; offsetX: number; offsetY: number } | null>(null);
  const rgbRecalcTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const roiJustMovedRef = useRef<boolean>(false); // 追蹤檢測框是否剛剛被移動
  const lastProcessTime = useRef<number>(0);
  const lastFrameData = useRef<ImageData | null>(null);
  const frameChangeThreshold = useRef<number>(0.1); // 10% 的像素變化閾值

  // Log 函數，根據設定決定是否輸出
  const log = useCallback((message: string, ...args: any[]) => {
    if (detectionSettings.enableDetailedLogs) {
      console.log(message, ...args);
    }
  }, [detectionSettings.enableDetailedLogs]);

  // 統一的 ROI Canvas 計算函數
  const calculateROICanvas = useCallback((roi: { x: number; y: number; width: number; height: number }, canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
    const canvasRect = canvas.getBoundingClientRect();
    const currentFullscreenState = document.fullscreenElement === containerRef.current;
    
    console.log('🔍 座標變換計算開始:', {
      '全螢幕狀態(組件)': isFullscreen,
      '全螢幕狀態(實際)': currentFullscreenState,
      '原始ROI': roi,
      'Canvas尺寸': `${canvas.width}x${canvas.height}`,
      'Canvas顯示尺寸': `${canvasRect.width}x${canvasRect.height}`,
      'Video尺寸': `${video.videoWidth}x${video.videoHeight}`
    });
    
    // 計算 video 在 container 中的實際顯示區域（考慮 object-fit: contain）
    const videoAspectRatio = video.videoWidth / video.videoHeight;
    
    // 全螢幕時 video 和 canvas 佔滿整個螢幕，按鈕浮動在上方
    let availableHeight = canvasRect.height;
    // 不需要預留按鈕空間，因為按鈕現在是浮動的
    
    const containerAspectRatio = canvasRect.width / availableHeight;
    
    let displayWidth, displayHeight, displayX, displayY;
    
    if (videoAspectRatio > containerAspectRatio) {
      // video 較寬，以寬度為準
      displayWidth = canvasRect.width;
      displayHeight = canvasRect.width / videoAspectRatio;
      displayX = 0;
      displayY = (availableHeight - displayHeight) / 2;
    } else {
      // video 較高，以高度為準
      displayHeight = availableHeight;
      displayWidth = availableHeight * videoAspectRatio;
      displayX = (canvasRect.width - displayWidth) / 2;
      displayY = 0;
    }
    
    console.log('📐 顯示區域計算:', {
      'Video寬高比': videoAspectRatio.toFixed(3),
      '容器寬高比': containerAspectRatio.toFixed(3),
      '可用高度': availableHeight.toFixed(1),
      '實際顯示區域': `${displayWidth.toFixed(1)}x${displayHeight.toFixed(1)}`,
      '顯示位置': `(${displayX.toFixed(1)}, ${displayY.toFixed(1)})`
    });
    
    // 檢查 ROI 是否在實際顯示區域內
    const roiInDisplayArea = roi.x >= displayX && 
                            roi.y >= displayY && 
                            roi.x + roi.width <= displayX + displayWidth &&
                            roi.y + roi.height <= displayY + displayHeight;
    
    let roiCanvas: { x: number; y: number; width: number; height: number };
    
    if (roiInDisplayArea) {
      // ROI 在顯示區域內，轉換到 Canvas 座標
      const scaleX = canvas.width / displayWidth;
      const scaleY = canvas.height / displayHeight;
      roiCanvas = {
        x: Math.max(0, Math.round((roi.x - displayX) * scaleX)),
        y: Math.max(0, Math.round((roi.y - displayY) * scaleY)),
        width: Math.max(1, Math.round(roi.width * scaleX)),
        height: Math.max(1, Math.round(roi.height * scaleY))
      };
      
      console.log('✅ ROI在顯示區域內，轉換到Canvas座標:', {
        '縮放比例': `X:${scaleX.toFixed(3)}, Y:${scaleY.toFixed(3)}`,
        '轉換後ROI': roiCanvas
      });
    } else {
      // ROI 超出顯示區域，使用預設 ROI
      const defaultSize = Math.min(canvas.width, canvas.height) / 4;
      roiCanvas = {
        x: Math.floor(canvas.width / 2 - defaultSize / 2),
        y: Math.floor(canvas.height / 2 - defaultSize / 2),
        width: Math.floor(defaultSize),
        height: Math.floor(defaultSize)
      };
      
      console.log('⚠️ ROI超出顯示區域，使用預設ROI:', {
        'ROI位置檢查': {
          'X範圍': `${roi.x} >= ${displayX} && ${roi.x + roi.width} <= ${displayX + displayWidth}`,
          'Y範圍': `${roi.y} >= ${displayY} && ${roi.y + roi.height} <= ${displayY + displayHeight}`,
          '結果': roiInDisplayArea
        },
        '預設ROI': roiCanvas
      });
    }
    
    return roiCanvas;
  }, [isFullscreen]);

  // 計算全螢幕定格狀態下 RGB 資訊卡的最佳位置
  const getOptimalInfoCardPosition = useCallback(() => {
    if (!isFullscreen || !isFrozen || !lastRGB) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    // 資訊卡尺寸（估算）
    const cardWidth = 280;
    const cardHeight = 100;
    const padding = 20;

    // 功能按鈕區域（底部）
    const buttonArea = {
      x: 0,
      y: window.innerHeight - 120, // 底部 120px
      width: window.innerWidth,
      height: 120
    };

    // 檢測框區域（如果存在）
    let roiArea = null;
    if (roi && containerRef.current) {
      const canvasRect = containerRef.current.getBoundingClientRect();
      const video = videoRef.current;
      if (video) {
        const roiCanvas = calculateROICanvas(roi, canvasRef.current!, video);
        
        // 將 Canvas 座標轉換為螢幕座標
        const scaleX = canvasRect.width / canvasRef.current!.width;
        const scaleY = canvasRect.height / canvasRef.current!.height;
        
        roiArea = {
          x: canvasRect.left + roiCanvas.x * scaleX,
          y: canvasRect.top + roiCanvas.y * scaleY,
          width: roiCanvas.width * scaleX,
          height: roiCanvas.height * scaleY
        };
      }
    }

    // 候選位置
    const candidatePositions = [
      { x: padding, y: padding }, // 左上
      { x: window.innerWidth - cardWidth - padding, y: padding }, // 右上
      { x: padding, y: window.innerHeight - cardHeight - padding }, // 左下
      { x: window.innerWidth - cardWidth - padding, y: window.innerHeight - cardHeight - padding }, // 右下
      { x: (window.innerWidth - cardWidth) / 2, y: padding }, // 上中
      { x: (window.innerWidth - cardWidth) / 2, y: window.innerHeight - cardHeight - padding }, // 下中
      { x: padding, y: (window.innerHeight - cardHeight) / 2 }, // 左中
      { x: window.innerWidth - cardWidth - padding, y: (window.innerHeight - cardHeight) / 2 }, // 右中
    ];

    // 檢查重疊的函數
    const intersects = (a: {x: number; y: number; width: number; height: number}, b: {x: number; y: number; width: number; height: number}) => {
      return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
    };

    // 找到最佳位置
    for (const pos of candidatePositions) {
      const cardRect = { x: pos.x, y: pos.y, width: cardWidth, height: cardHeight };
      let isValidPosition = true;

      // 檢查是否與功能按鈕重疊
      if (intersects(cardRect, buttonArea)) {
        isValidPosition = false;
      }

      // 檢查是否與檢測框重疊
      if (roiArea && intersects(cardRect, roiArea)) {
        isValidPosition = false;
      }

      if (isValidPosition) {
        console.log('🎯 RGB 資訊卡位置選擇:', {
          '選擇位置': pos,
          '功能按鈕區域': buttonArea,
          '檢測框區域': roiArea,
          '資訊卡尺寸': { width: cardWidth, height: cardHeight }
        });
        return { 
          top: `${pos.y}px`, 
          left: `${pos.x}px`, 
          transform: 'none' 
        };
      }
    }

    // 如果所有位置都有衝突，使用預設位置（螢幕中央）
    console.log('⚠️ 所有位置都有衝突，使用預設位置');
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }, [isFullscreen, isFrozen, lastRGB, roi]);

  // 檢測畫面變動（整個畫面）
  const detectFrameChange = useCallback((currentFrame: ImageData, lastFrame: ImageData | null): boolean => {
    if (!lastFrame) {
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
    return changeRatio > frameChangeThreshold.current;
  }, [log]);

  // 檢測檢測框內部變動（只檢測 ROI 區域）
  const detectROIChange = useCallback((currentFrame: ImageData, lastFrame: ImageData | null, roi: { x: number; y: number; width: number; height: number }): boolean => {
    if (!lastFrame) {
      return true;
    }

    const currentData = currentFrame.data;
    const lastData = lastFrame.data;
    const canvasWidth = currentFrame.width;
    const canvasHeight = currentFrame.height;
    
    // 確保 ROI 在畫布範圍內
    const roiX = Math.max(0, Math.min(Math.floor(roi.x), canvasWidth));
    const roiY = Math.max(0, Math.min(Math.floor(roi.y), canvasHeight));
    const roiWidth = Math.max(1, Math.min(Math.floor(roi.width), canvasWidth - roiX));
    const roiHeight = Math.max(1, Math.min(Math.floor(roi.height), canvasHeight - roiY));
    
    let changedPixels = 0;
    let totalROIPixels = 0;

    // 只檢測 ROI 區域內的像素
    for (let y = roiY; y < roiY + roiHeight; y += 2) { // 每2行檢測一次，提高效率
      for (let x = roiX; x < roiX + roiWidth; x += 2) { // 每2列檢測一次，提高效率
        const pixelIndex = (y * canvasWidth + x) * 4; // RGBA 4個通道
        
        if (pixelIndex < currentData.length && pixelIndex < lastData.length) {
          const r1 = currentData[pixelIndex];
          const g1 = currentData[pixelIndex + 1];
          const b1 = currentData[pixelIndex + 2];
          
          const r2 = lastData[pixelIndex];
          const g2 = lastData[pixelIndex + 1];
          const b2 = lastData[pixelIndex + 2];
          
          // 計算顏色差異
          const colorDiff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
          if (colorDiff > 30) { // 顏色差異閾值
            changedPixels++;
          }
          totalROIPixels++;
        }
      }
    }

    const changeRatio = totalROIPixels > 0 ? changedPixels / totalROIPixels : 0;
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

  // 清理防抖定時器（保留以防其他地方使用）
  useEffect(() => {
    return () => {
      if (rgbRecalcTimeoutRef.current) {
        clearTimeout(rgbRecalcTimeoutRef.current);
      }
    };
  }, []);

  // 全螢幕功能 - 針對攝影機容器
  const toggleFullscreen = useCallback(async () => {
    const cameraContainer = containerRef.current;
    if (!cameraContainer) {
      setError('無法找到攝影機容器');
      return;
    }

    console.log('🔄 切換全螢幕狀態');
    console.log('  - 當前全螢幕元素:', document.fullscreenElement);
    console.log('  - 攝影機容器:', cameraContainer);
    console.log('  - 是否為攝影機全螢幕:', document.fullscreenElement === cameraContainer);
    console.log('  - onFullscreenChange 回調函數:', onFullscreenChange ? '存在' : '不存在');

    if (!document.fullscreenElement) {
      try {
        console.log('📺 嘗試進入攝影機全螢幕模式');
        if (cameraContainer.requestFullscreen) {
          await cameraContainer.requestFullscreen();
        } else if ((cameraContainer as any).webkitRequestFullscreen) {
          await (cameraContainer as any).webkitRequestFullscreen();
        } else if ((cameraContainer as any).msRequestFullscreen) {
          await (cameraContainer as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
        console.log('✅ 攝影機畫面進入全螢幕模式');
        
        // 手動通知父組件全螢幕狀態變化
        if (onFullscreenChange) {
          onFullscreenChange(true);
          console.log('📤 手動通知父組件 - 進入全螢幕');
        }
      } catch (err) {
        console.error('❌ 無法進入全螢幕模式:', err);
        setError('無法進入全螢幕模式');
      }
    } else {
      try {
        console.log('📺 嘗試退出攝影機全螢幕模式');
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
        console.log('✅ 攝影機畫面退出全螢幕模式');
        
        // 手動通知父組件全螢幕狀態變化
        if (onFullscreenChange) {
          onFullscreenChange(false);
          console.log('📤 手動通知父組件 - 退出全螢幕');
        }
      } catch (err) {
        console.error('❌ 無法退出全螢幕模式:', err);
        setError('無法退出全螢幕模式');
      }
    }
  }, []);

  // 監聽全螢幕狀態變化
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCameraFullscreen = document.fullscreenElement === containerRef.current;
      setIsFullscreen(isCameraFullscreen);
      
      console.log('🔄 全螢幕狀態變化:', {
        '新狀態': isCameraFullscreen ? '攝影機全螢幕' : '非全螢幕',
        'document.fullscreenElement': document.fullscreenElement,
        'containerRef.current': containerRef.current,
        '是否為攝影機容器': document.fullscreenElement === containerRef.current
      });
      
      // 通知父組件全螢幕狀態變化
      if (onFullscreenChange) {
        onFullscreenChange(isCameraFullscreen);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [onFullscreenChange]);

  // ESC 鍵監聽 - 關閉 3D 視覺化
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen && show3DVisualization) {
        console.log('🔄 ESC 鍵觸發 - 關閉 3D 視覺化');
        if (onClose3DVisualization) {
          onClose3DVisualization();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, show3DVisualization, onClose3DVisualization]);

  // 處理外部定格控制
  useEffect(() => {
    if (shouldFreeze && !isFrozen) {
      console.log('🎬 外部觸發定格');
      setIsFrozen(true);
    }
  }, [shouldFreeze, isFrozen]);

  // 移除自動 ROI 變化監聽，避免無限循環
  // RGB 重新計算只在用戶主動移動 ROI 時觸發（onMouseUp, onTouchEnd）

  // 計算平均 RGB（當有記錄數據時）
  useEffect(() => {
    if (recordingData.length > 0) {
      const avgR = Math.round(recordingData.reduce((sum, item) => sum + item.r, 0) / recordingData.length);
      const avgG = Math.round(recordingData.reduce((sum, item) => sum + item.g, 0) / recordingData.length);
      const avgB = Math.round(recordingData.reduce((sum, item) => sum + item.b, 0) / recordingData.length);
      const avgHex = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
      
      setAverageRGB({
        r: avgR,
        g: avgG,
        b: avgB,
        hex: avgHex,
        timestamp: Date.now(),
        x: 0, // 平均 RGB 不需要具體位置
        y: 0
      });
      console.log('📊 計算平均 RGB:', avgHex);
    }
  }, [recordingData]);

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

      // 嘗試四個角落，找一個不與 ROI 和功能按鈕相交的位置
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
      
      // 功能按鈕區域（假設在畫面底部，高度約 60px）
      const buttonAreaHeight = 60;
      const buttonArea = { 
        x: 0, 
        y: saveCanvas.height - buttonAreaHeight, 
        width: saveCanvas.width, 
        height: buttonAreaHeight 
      };
      
      // 檢查每個候選位置，避開 ROI 和功能按鈕區域
      for (const pos of candidatePositions) {
        const cardRect = { x: pos.x, y: pos.y, width: cardWidth, height: cardHeight };
        let isValidPosition = true;
        
        // 檢查是否與 ROI 相交
        if (roiCanvas && intersects(cardRect, roiCanvas)) {
          isValidPosition = false;
        }
        
        // 檢查是否與功能按鈕區域相交
        if (intersects(cardRect, buttonArea)) {
          isValidPosition = false;
        }
        
        if (isValidPosition) {
          cardX = pos.x;
          cardY = pos.y;
          break;
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
    
    // ROI 變化時立即更新檢測框視覺顯示
    if (roi && canvasRef.current && videoRef.current) {
      console.log('🔄 ROI 狀態變化，立即更新檢測框視覺顯示');
      updateROIVisualDisplay();
    }
  }, [roi]);

  // 立即更新檢測框視覺顯示的函數
  const updateROIVisualDisplay = useCallback(() => {
    if (!canvasRef.current || !videoRef.current || !roi) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    
    if (!ctx) return;
    
    // 清除畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 繪製當前視頻幀
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 計算 ROI 在 Canvas 上的位置
    const canvasRect = canvas.getBoundingClientRect();
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
    
    let roiCanvas: { x: number; y: number; width: number; height: number };
    
    if (roiInDisplayArea) {
      // ROI 在顯示區域內，轉換到 Canvas 座標
      const scaleX = canvas.width / displayWidth;
      const scaleY = canvas.height / displayHeight;
      roiCanvas = {
        x: Math.max(0, Math.round((roi.x - displayX) * scaleX)),
        y: Math.max(0, Math.round((roi.y - displayY) * scaleY)),
        width: Math.max(1, Math.round(roi.width * scaleX)),
        height: Math.max(1, Math.round(roi.height * scaleY))
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
    
    // 檢測框由 processFrame 統一繪製，避免重複繪製
    console.log('✅ 視頻幀已更新，檢測框由 processFrame 統一處理');
  }, [roi, canvasRef, videoRef]);

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

      // 定格狀態下完全停止處理，保持畫面靜止
      if (isFrozenRef.current) {
        // 定格狀態下降低循環頻率，節省資源
        setTimeout(() => {
          animationFrameRef.current = requestAnimationFrame(processFrame);
        }, 100); // 每 100ms 檢查一次，而不是 16.67ms
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
        const frameTime = new Date().toLocaleTimeString();
        log('🖼️ 影格繪製完成，時間:', frameTime);
        
        // 檢測畫面變動（定格狀態下跳過靈敏度判斷）
        const currentFrameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const currentRoiForSensitivity = roiRef.current;
        
        let hasSignificantChange = false;
        
        // 定格狀態下不需要進行靈敏度判斷
        if (isFrozen) {
          console.log('⏸️ 定格狀態，跳過靈敏度判斷 - 直接進行 RGB 計算');
          console.log('📊 定格狀態資訊:', {
            '定格狀態': isFrozen,
            '檢測框位置': currentRoiForSensitivity ? `${currentRoiForSensitivity.x},${currentRoiForSensitivity.y},${currentRoiForSensitivity.width}x${currentRoiForSensitivity.height}` : '無檢測框',
            '跳過靈敏度檢測': true,
            '直接進行RGB計算': true
          });
          hasSignificantChange = true; // 定格狀態下直接進行 RGB 計算
        } else if (currentRoiForSensitivity) {
          // 有檢測框時，只檢測檢測框內部的變化
          hasSignificantChange = detectROIChange(currentFrameData, lastFrameData.current, currentRoiForSensitivity);
          console.log('🎯 使用檢測框內部靈敏度檢測');
        } else {
          // 沒有檢測框時，檢測整個畫面（預設中央區域）
          hasSignificantChange = detectFrameChange(currentFrameData, lastFrameData.current);
          console.log('🎯 使用整個畫面靈敏度檢測（預設中央區域）');
        }
        
        lastFrameData.current = currentFrameData;
        
        // 如果檢測框剛剛被移動，強制進行 RGB 計算
        if (roiJustMovedRef.current) {
          console.log('🎯 檢測框剛剛被移動，強制進行 RGB 計算（跳過靈敏度門檻）');
          // 不檢查靈敏度門檻，直接進行 RGB 計算
        } else if (!hasSignificantChange) {
          log('😴 檢測框內部無顯著變化，跳過檢測');
          // 繼續處理下一幀
          animationFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }
        
        // 根據觸發原因輸出不同的 log
        if (roiJustMovedRef.current) {
          console.log('🔄 檢測框移動觸發，開始 RGB 檢測');
        } else {
          log('🔄 畫面有顯著變化，開始檢測');
        }
        
        // 計算 ROI（若無，預設為畫面中央區域）
        let roiCanvas: { x: number; y: number; width: number; height: number };
        const currentRoi = roiRef.current;
        
        // 輸出檢測框位置頂點
        if (currentRoi) {
          if (roiJustMovedRef.current) {
            console.log('✅ 檢測框移動觸發，檢測框位置頂點:', {
              '左上角': `(${currentRoi.x}, ${currentRoi.y})`,
              '右下角': `(${currentRoi.x + currentRoi.width}, ${currentRoi.y + currentRoi.height})`,
              '對角頂點4個值': `x:${currentRoi.x}, y:${currentRoi.y}, w:${currentRoi.width}, h:${currentRoi.height}`
            });
          } else {
            console.log('✅ 通過靈敏度門檻，檢測框位置頂點:', {
              '左上角': `(${currentRoi.x}, ${currentRoi.y})`,
              '右下角': `(${currentRoi.x + currentRoi.width}, ${currentRoi.y + currentRoi.height})`,
              '對角頂點4個值': `x:${currentRoi.x}, y:${currentRoi.y}, w:${currentRoi.width}, h:${currentRoi.height}`
            });
          }
        } else {
          if (roiJustMovedRef.current) {
            console.log('✅ 檢測框移動觸發，使用預設中央區域檢測框');
          } else {
            console.log('✅ 通過靈敏度門檻，使用預設中央區域檢測框');
          }
        }
        if (currentRoi && containerRef.current) {
          // 使用統一的 ROI Canvas 計算函數
          roiCanvas = calculateROICanvas(currentRoi, canvas, video);
        } else {
          // 沒有 ROI，使用預設中央區域
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

        // 如果定格且有平均 RGB 數據，繪製平均 RGB 資訊卡
        if (isFrozen && averageRGB) {
          const padding = 12;
          const swatchSize = Math.max(12, Math.floor(Math.min(canvas.width, canvas.height) / 20));
          const fontSize = Math.max(14, Math.floor(swatchSize * 0.9));
          ctx.font = `${fontSize}px Arial`;
          
          const textLines = [
            `平均 RGB: ${averageRGB.r}, ${averageRGB.g}, ${averageRGB.b}`,
            `HEX: ${averageRGB.hex}`,
            `數據筆數: ${recordingData.length}`
          ];
          
          const textWidth = Math.max(...textLines.map(line => ctx.measureText(line).width));
          const cardWidth = padding + swatchSize + padding + textWidth + padding;
          const cardHeight = padding + fontSize * textLines.length + padding;

          // 計算資訊卡位置（避開 ROI 和功能按鈕）
          const candidatePositions = [
            { x: padding, y: padding }, // 左上
            { x: canvas.width - cardWidth - padding, y: padding }, // 右上
            { x: padding, y: canvas.height - cardHeight - padding }, // 左下
            { x: canvas.width - cardWidth - padding, y: canvas.height - cardHeight - padding }, // 右下
          ];
          
          // 根據是否全螢幕計算按鈕區域
          let buttonAreaHeight = 60; // 預設高度
          let buttonAreaY = canvas.height - buttonAreaHeight; // 預設位置
          
          if (isFullscreen) {
            // 全螢幕模式：按鈕在底部 20px，加上按鈕高度和 padding
            buttonAreaHeight = 80; // 按鈕高度 + padding + 邊距
            buttonAreaY = canvas.height - buttonAreaHeight;
          }
          
          const buttonArea = { 
            x: 0, 
            y: buttonAreaY, 
            width: canvas.width, 
            height: buttonAreaHeight 
          };
          
          console.log('🎯 RGB 資訊卡位置計算:', {
            '全螢幕狀態': isFullscreen,
            '按鈕區域': buttonArea,
            '檢測框區域': roiCanvas,
            '資訊卡尺寸': { width: cardWidth, height: cardHeight }
          });
          
          const intersects = (a: {x:number;y:number;width:number;height:number}, b: {x:number;y:number;width:number;height:number}) =>
            !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
          
          let cardX = candidatePositions[0].x;
          let cardY = candidatePositions[0].y;
          
          for (let i = 0; i < candidatePositions.length; i++) {
            const pos = candidatePositions[i];
            const cardRect = { x: pos.x, y: pos.y, width: cardWidth, height: cardHeight };
            let isValidPosition = true;
            let conflictReason = '';
            
            if (roiCanvas && intersects(cardRect, roiCanvas)) {
              isValidPosition = false;
              conflictReason = '與檢測框重疊';
            }
            
            if (intersects(cardRect, buttonArea)) {
              isValidPosition = false;
              conflictReason = conflictReason ? `${conflictReason} + 與按鈕重疊` : '與按鈕重疊';
            }
            
            console.log(`📍 候選位置 ${i + 1}:`, {
              '位置': pos,
              '有效': isValidPosition,
              '衝突原因': conflictReason || '無衝突'
            });
            
            if (isValidPosition) {
              cardX = pos.x;
              cardY = pos.y;
              console.log(`✅ 選擇位置 ${i + 1}:`, { x: cardX, y: cardY });
              break;
            }
          }

          // 繪製平均 RGB 資訊卡背景
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
          ctx.strokeStyle = '#ff6b6b';
          ctx.lineWidth = 2;
          ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);

          // 繪製平均 RGB 色塊
          const swatchX = cardX + padding;
          const swatchY = cardY + Math.floor((cardHeight - swatchSize) / 2);
          ctx.fillStyle = averageRGB.hex;
          ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);

          // 繪製文字
          ctx.fillStyle = '#333';
          ctx.textAlign = 'left';
          let textX = swatchX + swatchSize + padding;
          let textY = cardY + padding + fontSize * 0.9;
          for (const line of textLines) {
            ctx.fillText(line, textX, textY);
            textY += fontSize;
          }
          
          log('📊 平均 RGB 資訊卡已繪製');
        }

        // 使用 OpenCV 處理圖像
        log('🔧 調用 OpenCV 處理函數...');
        
        console.log('🎨 RGB 計算開始:', {
          '全螢幕狀態': isFullscreen,
          'Canvas尺寸': `${canvas.width}x${canvas.height}`,
          'ROI Canvas座標': roiCanvas,
          '原始ROI': currentRoi,
          '觸發原因': roiJustMovedRef.current ? '檢測框移動' : '靈敏度門檻通過'
        });
        
        const rgbData = await processImageForRGB(
          canvas,
          detectionSettings,
          roiCanvas
        );

        if (rgbData) {
          log('✅ 檢測到 RGB 數據:', rgbData.hex);
          
          // 檢查是否是移動檢測框觸發的 RGB 計算
          if (roiJustMovedRef.current) {
            console.log('🎯 移動檢測框觸發的 RGB 計算完成:', {
              'RGB 值': `R:${rgbData.r}, G:${rgbData.g}, B:${rgbData.b}`,
              'HEX 值': rgbData.hex,
              '時間戳': new Date(rgbData.timestamp).toLocaleTimeString(),
              '檢測框位置': currentRoi ? `x:${currentRoi.x}, y:${currentRoi.y}, w:${currentRoi.width}, h:${currentRoi.height}` : '預設中央區域',
              '觸發原因': '檢測框移動'
            });
            roiJustMovedRef.current = false; // 重置標記
          } else {
            // 輸出通過靈敏度門檻後的 RGB 計算結果
            console.log('🎨 通過靈敏度門檻，RGB 計算結果:', {
              'RGB 值': `R:${rgbData.r}, G:${rgbData.g}, B:${rgbData.b}`,
              'HEX 值': rgbData.hex,
              '時間戳': new Date(rgbData.timestamp).toLocaleTimeString(),
              '檢測框位置': currentRoi ? `x:${currentRoi.x}, y:${currentRoi.y}, w:${currentRoi.width}, h:${currentRoi.height}` : '預設中央區域',
              '觸發原因': '靈敏度門檻通過'
            });
          }
          
          setLastRGB(rgbData);
          onRGBDetected(rgbData);
        } else {
          log('❌ 未檢測到 RGB 數據');
          if (roiJustMovedRef.current) {
            console.log('❌ 移動檢測框觸發的 RGB 計算失敗');
            roiJustMovedRef.current = false; // 重置標記
          } else {
            console.log('❌ 通過靈敏度門檻，但 RGB 計算失敗');
          }
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
  }, [isActive, onRGBDetected, isFrozen, canvasRef, detectFrameChange, detectROIChange, detectionSettings, log]);

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

  // 處理全螢幕狀態變化時的檢測框位置重新計算
  useEffect(() => {
    if (roi && containerRef.current && videoRef.current && canvasRef.current) {
      console.log('🔄 全螢幕狀態變化，重新計算檢測框位置');
      
      // 標記檢測框剛剛被移動（全螢幕狀態變化觸發）
      roiJustMovedRef.current = true;
      
      // 等待 processFrame 循環進行 RGB 計算，確保使用相同的視頻幀
      console.log('📐 全螢幕狀態變化，將使用 processFrame 中的視頻幀進行 RGB 計算');
      console.log('💡 將使用 processFrame 中的視頻幀進行 RGB 計算，確保與靈敏度門檻計算使用相同的圖像');
    }
  }, [isFullscreen, roi]);

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

  // 清理資源
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="camera-capture">
      {/* 非全螢幕模式下的控制按鈕 */}
      {!isFullscreen && (
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
              <button
                className={`fullscreen-toggle ${isFullscreen ? 'active' : ''}`}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? '🔲 退出全螢幕' : '⛶ 全螢幕'}
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
      )}

      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
          <button onClick={initializeCamera}>重試</button>
        </div>
      )}

      <div className="camera-preview" ref={containerRef}>
        {/* 全螢幕模式下的控制按鈕 */}
        {isFullscreen && (
          <div className="camera-controls">
            <div className="button-row">
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
                <button
                  className={`save-image ${isSaving ? 'saving' : ''}`}
                  onClick={saveRawFrame}
                  disabled={isSaving}
                >
                  {isSaving ? '💾 保存中...' : '💾 保存原圖'}
                </button>
              )}
            </div>
            
            {isActive && (
              <div className="button-row">
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
                <button
                  className={`fullscreen-toggle ${isFullscreen ? 'active' : ''}`}
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? '🔲 退出全螢幕' : '⛶ 全螢幕'}
                </button>
              </div>
            )}
            
            {isProcessing && (
              <div className="processing-indicator">
                <div className="spinner"></div>
                <span>處理中...</span>
              </div>
            )}
          </div>
        )}

        {/* 全螢幕定格狀態下的 RGB 資訊卡 */}
        {isFullscreen && isFrozen && lastRGB && (
          <div 
            className="fullscreen-rgb-info-card"
            style={{
              position: 'fixed',
              ...getOptimalInfoCardPosition()
            }}
          >
            <div className="rgb-swatch" style={{ backgroundColor: lastRGB.hex }}></div>
            <div className="rgb-details">
              <div className="rgb-values">
                <span className="rgb-label">R:</span>
                <span className="rgb-value">{lastRGB.r}</span>
                <span className="rgb-label">G:</span>
                <span className="rgb-value">{lastRGB.g}</span>
                <span className="rgb-label">B:</span>
                <span className="rgb-value">{lastRGB.b}</span>
              </div>
              <div className="hex-value">{lastRGB.hex}</div>
              <div className="timestamp">
                {new Date(lastRGB.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}
        
        {/* 攝影機內容 */}
        <div
          onMouseDown={(e) => {
            if (!containerRef.current) return;
            
            // 檢查是否為定格狀態，如果是則不允許移動 ROI
            if (isFrozen) {
              console.log('🔒 定格狀態下不允許移動檢測框');
              return;
            }
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
            // 檢查是否點擊在 ROI 內部
            const isInsideROI = startX >= roi.x && startX <= roi.x + roi.width &&
                               startY >= roi.y && startY <= roi.y + roi.height;
            
            if (isInsideROI) {
              // 點擊在 ROI 內部，開始拖拽
              console.log('🖱️ 點擊檢測框內部，開始拖拽模式');
              draggingRef.current = { type: 'move', offsetX: startX - roi.x, offsetY: startY - roi.y };
            } else {
              // 點擊在 ROI 外部，移動 ROI 到新位置
              console.log('🖱️ 點擊檢測框外部，移動檢測框到新位置');
              const size = roi.width; // 保持原有大小
              
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
                
                // 確保新位置在顯示區域內
                const newX = Math.max(displayX, Math.min(startX - size / 2, displayX + displayWidth - size));
                const newY = Math.max(displayY, Math.min(startY - size / 2, displayY + displayHeight - size));
                const newRoi = { x: newX, y: newY, width: size, height: size };
                setRoi(newRoi);
                
                // 標記檢測框剛剛被移動
                roiJustMovedRef.current = true;
                
                // 等待 processFrame 循環進行 RGB 計算，確保使用相同的視頻幀
                console.log('🔄 檢測框移動到新位置，等待 processFrame 循環進行 RGB 計算');
                console.log('📐 新的檢測框範圍:', {
                  '左上角': `(${newRoi.x}, ${newRoi.y})`,
                  '右下角': `(${newRoi.x + newRoi.width}, ${newRoi.y + newRoi.height})`,
                  '對角頂點4個值': `x:${newRoi.x}, y:${newRoi.y}, w:${newRoi.width}, h:${newRoi.height}`
                });
                console.log('💡 將使用 processFrame 中的視頻幀進行 RGB 計算，確保與靈敏度門檻計算使用相同的圖像');
              } else {
                // 沒有 video 元素，使用簡單計算
                const newX = Math.max(0, Math.min(startX - size / 2, rect.width - size));
                const newY = Math.max(0, Math.min(startY - size / 2, rect.height - size));
                const newRoi = { x: newX, y: newY, width: size, height: size };
                setRoi(newRoi);
                
                // 標記檢測框剛剛被移動
                roiJustMovedRef.current = true;
                
                // 等待 processFrame 循環進行 RGB 計算，確保使用相同的視頻幀
                console.log('🔄 檢測框移動到新位置，等待 processFrame 循環進行 RGB 計算');
                console.log('📐 新的檢測框範圍:', {
                  '左上角': `(${newRoi.x}, ${newRoi.y})`,
                  '右下角': `(${newRoi.x + newRoi.width}, ${newRoi.y + newRoi.height})`,
                  '對角頂點4個值': `x:${newRoi.x}, y:${newRoi.y}, w:${newRoi.width}, h:${newRoi.height}`
                });
                console.log('💡 將使用 processFrame 中的視頻幀進行 RGB 計算，確保與靈敏度門檻計算使用相同的圖像');
              }
            }
          }
        }}
        onMouseMove={(e) => {
          if (!draggingRef.current || !containerRef.current) return;
          
          // 檢查是否為定格狀態，如果是則不允許移動 ROI
          if (isFrozen) {
            return;
          }
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
        onMouseUp={() => { 
          if (draggingRef.current) {
            console.log('🔄 ROI 拖曳完成，等待 processFrame 循環進行 RGB 計算');
            
            // 標記檢測框剛剛被移動（拖曳完成）
            roiJustMovedRef.current = true;
            
            // 等待 processFrame 循環進行 RGB 計算，確保使用相同的視頻幀
            console.log('📐 拖曳完成，將使用 processFrame 中的視頻幀進行 RGB 計算');
            console.log('💡 將使用 processFrame 中的視頻幀進行 RGB 計算，確保與靈敏度門檻計算使用相同的圖像');
          }
          draggingRef.current = null;
        }}
        onMouseLeave={() => { draggingRef.current = null; }}
        onTouchStart={(e) => {
          if (!containerRef.current) return;
          if (e.touches.length === 0) return;
          
          // 檢查是否為定格狀態，如果是則不允許移動 ROI
          if (isFrozen) {
            console.log('🔒 定格狀態下不允許移動檢測框（觸控）');
            return;
          }
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
            // 檢查是否觸控在 ROI 內部
            const isInsideROI = startX >= roi.x && startX <= roi.x + roi.width &&
                               startY >= roi.y && startY <= roi.y + roi.height;
            
            if (isInsideROI) {
              // 觸控在 ROI 內部，開始拖拽
              console.log('📱 觸控檢測框內部，開始拖拽模式');
              draggingRef.current = { type: 'move', offsetX: startX - roi.x, offsetY: startY - roi.y };
            } else {
              // 觸控在 ROI 外部，移動 ROI 到新位置
              console.log('📱 觸控檢測框外部，移動檢測框到新位置');
              const size = roi.width; // 保持原有大小
              
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
                
                // 確保新位置在顯示區域內
                const newX = Math.max(displayX, Math.min(startX - size / 2, displayX + displayWidth - size));
                const newY = Math.max(displayY, Math.min(startY - size / 2, displayY + displayHeight - size));
                const newRoi = { x: newX, y: newY, width: size, height: size };
                setRoi(newRoi);
                
                // 標記檢測框剛剛被移動
                roiJustMovedRef.current = true;
                
                // 等待 processFrame 循環進行 RGB 計算，確保使用相同的視頻幀
                console.log('🔄 檢測框移動到新位置（觸控），等待 processFrame 循環進行 RGB 計算');
                console.log('📐 新的檢測框範圍（觸控）:', {
                  '左上角': `(${newRoi.x}, ${newRoi.y})`,
                  '右下角': `(${newRoi.x + newRoi.width}, ${newRoi.y + newRoi.height})`,
                  '對角頂點4個值': `x:${newRoi.x}, y:${newRoi.y}, w:${newRoi.width}, h:${newRoi.height}`
                });
                console.log('💡 將使用 processFrame 中的視頻幀進行 RGB 計算，確保與靈敏度門檻計算使用相同的圖像');
              } else {
                // 沒有 video 元素，使用簡單計算
                const newX = Math.max(0, Math.min(startX - size / 2, rect.width - size));
                const newY = Math.max(0, Math.min(startY - size / 2, rect.height - size));
                const newRoi = { x: newX, y: newY, width: size, height: size };
                setRoi(newRoi);
                
                // 標記檢測框剛剛被移動
                roiJustMovedRef.current = true;
                
                // 等待 processFrame 循環進行 RGB 計算，確保使用相同的視頻幀
                console.log('🔄 檢測框移動到新位置（觸控），等待 processFrame 循環進行 RGB 計算');
                console.log('📐 新的檢測框範圍（觸控）:', {
                  '左上角': `(${newRoi.x}, ${newRoi.y})`,
                  '右下角': `(${newRoi.x + newRoi.width}, ${newRoi.y + newRoi.height})`,
                  '對角頂點4個值': `x:${newRoi.x}, y:${newRoi.y}, w:${newRoi.width}, h:${newRoi.height}`
                });
                console.log('💡 將使用 processFrame 中的視頻幀進行 RGB 計算，確保與靈敏度門檻計算使用相同的圖像');
              }
            }
          }
        }}
        onTouchMove={(e) => {
          if (!draggingRef.current || !containerRef.current) return;
          if (e.touches.length === 0) return;
          
          // 檢查是否為定格狀態，如果是則不允許移動 ROI
          if (isFrozen) {
            return;
          }
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
        onTouchEnd={() => { 
          if (draggingRef.current) {
            console.log('🔄 ROI 拖曳完成（觸控），等待 processFrame 循環進行 RGB 計算');
            
            // 標記檢測框剛剛被移動（拖曳完成）
            roiJustMovedRef.current = true;
            
            // 等待 processFrame 循環進行 RGB 計算，確保使用相同的視頻幀
            console.log('📐 拖曳完成（觸控），將使用 processFrame 中的視頻幀進行 RGB 計算');
            console.log('💡 將使用 processFrame 中的視頻幀進行 RGB 計算，確保與靈敏度門檻計算使用相同的圖像');
          }
          draggingRef.current = null;
        }}
        onTouchCancel={() => { draggingRef.current = null; }}
        onWheel={(e) => {
          if (!containerRef.current) return;
          
          // 檢查是否為定格狀態，如果是則不允許調整 ROI 大小
          if (isFrozen) {
            console.log('🔒 定格狀態下不允許調整檢測框大小');
            return;
          }
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
                // 觸發 RGB 重新計算
                setTimeout(() => {
                  if (isActive && videoRef.current && canvasRef.current) {
                    console.log('🔄 ROI 大小調整完成，重新進行 RGB 運算');
                    processImageForRGB(canvasRef.current, detectionSettings, { x, y, width: size, height: size }).then((rgbData) => {
                      if (rgbData) {
                        onRGBDetected(rgbData);
                      }
                    });
                  }
                }, 100);
                return;
              }
            } else {
              // 沒有 video 元素，使用簡單計算
              const size = Math.min(rect.width, rect.height) * (roiSize / 100);
              const x = Math.max(0, Math.min(localX - size / 2, rect.width - size));
              const y = Math.max(0, Math.min(localY - size / 2, rect.height - size));
              setRoi({ x, y, width: size, height: size });
              // 標記檢測框剛剛被調整大小
              roiJustMovedRef.current = true;
              
              // 等待 processFrame 循環進行 RGB 計算，確保使用相同的視頻幀
              console.log('🔄 檢測框大小調整完成，等待 processFrame 循環進行 RGB 計算');
              console.log('📐 新的檢測框範圍（滾輪調整）:', {
                '左上角': `(${x}, ${y})`,
                '右下角': `(${x + size}, ${y + size})`,
                '對角頂點4個值': `x:${x}, y:${y}, w:${size}, h:${size}`
              });
              console.log('💡 將使用 processFrame 中的視頻幀進行 RGB 計算，確保與靈敏度門檻計算使用相同的圖像');
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
        
        {/* 全螢幕模式下的 3D 視覺化 */}
        {isFullscreen && show3DVisualization && recordingData.length > 1 && (
          <div 
            className="fullscreen-3d-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
              fontSize: '18px',
              padding: '20px',
              boxSizing: 'border-box'
            }}
          >
            {/* 退出按鈕 */}
            <button
              onClick={() => {
                // 通知父組件關閉 3D 視覺化
                if (onClose3DVisualization) {
                  console.log('🔄 用戶點擊退出 3D 視覺化');
                  onClose3DVisualization();
                }
              }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                border: '2px solid white',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '16px',
                cursor: 'pointer',
                zIndex: 10001
              }}
            >
              ❌ 關閉 3D 視覺化
            </button>
            
            {/* ESC 提示 */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              💡 按 ESC 鍵或點擊右上角按鈕退出
            </div>
            
            <h2>🎨 RGB 3D 視覺化報告</h2>
            <p>數據筆數: {recordingData.length}</p>
            <p>攝影機全螢幕模式</p>
            
            {/* 真正的 3D 視覺化組件 */}
            <div style={{ 
              marginTop: '20px', 
              width: '100%', 
              height: '60vh',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <RGB3DVisualization 
                data={recordingData} 
                isVisible={true}
              />
            </div>
            
            {/* 操作提示 */}
            <div style={{ 
              marginTop: '20px', 
              fontSize: '14px', 
              textAlign: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              padding: '10px',
              borderRadius: '8px'
            }}>
              <p>🖱️ 滑鼠：拖拽旋轉，滾輪縮放</p>
              <p>📱 觸控：雙指縮放，單指拖拽旋轉</p>
            </div>
          </div>
        )}
        </div>
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
              if (roi && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                
                if (videoRef.current) {
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
                    
                    // 標記檢測框剛剛被調整大小
                    roiJustMovedRef.current = true;
                    
                    // 等待 processFrame 循環進行 RGB 計算，確保使用相同的視頻幀
                    console.log('🔄 檢測框大小調整完成（滑桿），等待 processFrame 循環進行 RGB 計算');
                    console.log('📐 新的檢測框範圍（滑桿調整）:', {
                      '左上角': `(${newX}, ${newY})`,
                      '右下角': `(${newX + newPixelSize}, ${newY + newPixelSize})`,
                      '對角頂點4個值': `x:${newX}, y:${newY}, w:${newPixelSize}, h:${newPixelSize}`
                    });
                    console.log('💡 將使用 processFrame 中的視頻幀進行 RGB 計算，確保與靈敏度門檻計算使用相同的圖像');
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
                    
                    // 標記檢測框剛剛被調整大小
                    roiJustMovedRef.current = true;
                    
                    // 等待 processFrame 循環進行 RGB 計算，確保使用相同的視頻幀
                    console.log('🔄 檢測框重新建立完成（滑桿），等待 processFrame 循環進行 RGB 計算');
                    console.log('📐 新的檢測框範圍（滑桿重新建立）:', {
                      '左上角': `(${newX}, ${newY})`,
                      '右下角': `(${newX + newPixelSize}, ${newY + newPixelSize})`,
                      '對角頂點4個值': `x:${newX}, y:${newY}, w:${newPixelSize}, h:${newPixelSize}`
                    });
                    console.log('💡 將使用 processFrame 中的視頻幀進行 RGB 計算，確保與靈敏度門檻計算使用相同的圖像');
                  }
                } else {
                  // 沒有 video 元素，使用簡單計算
                  const size = Math.min(rect.width, rect.height) * (newSize / 100);
                  const centerX = roi.x + roi.width / 2;
                  const centerY = roi.y + roi.height / 2;
                  const newX = Math.max(0, Math.min(centerX - size / 2, rect.width - size));
                  const newY = Math.max(0, Math.min(centerY - size / 2, rect.height - size));
                  
                  setRoi({
                    x: newX,
                    y: newY,
                    width: size,
                    height: size
                  });
                  
                  // 標記檢測框剛剛被調整大小
                  roiJustMovedRef.current = true;
                  
                  // 等待 processFrame 循環進行 RGB 計算，確保使用相同的視頻幀
                  console.log('🔄 檢測框大小調整完成（滑桿，無video），等待 processFrame 循環進行 RGB 計算');
                  console.log('📐 新的檢測框範圍（滑桿調整，無video）:', {
                    '左上角': `(${newX}, ${newY})`,
                    '右下角': `(${newX + size}, ${newY + size})`,
                    '對角頂點4個值': `x:${newX}, y:${newY}, w:${size}, h:${size}`
                  });
                  console.log('💡 將使用 processFrame 中的視頻幀進行 RGB 計算，確保與靈敏度門檻計算使用相同的圖像');
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
