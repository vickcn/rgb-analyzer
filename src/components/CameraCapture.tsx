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
  };
}

const CameraCapture: React.FC<CameraCaptureProps> = ({
  isActive,
  onCameraToggle,
  onRGBDetected,
  detectionSettings
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const lastProcessTime = useRef<number>(0);
  const lastFrameData = useRef<ImageData | null>(null);
  const frameChangeThreshold = useRef<number>(0.1); // 10% 的像素變化閾值

  // Log 函數，根據設定決定是否輸出
  const log = (message: string, ...args: any[]) => {
    if (detectionSettings.enableDetailedLogs) {
      console.log(message, ...args);
    }
  };

  // 檢測畫面變動
  const detectFrameChange = (currentFrame: ImageData, lastFrame: ImageData | null): boolean => {
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
  };

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
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = resolve;
          }
        });
        
        log('📷 攝影機初始化完成，設定狀態為 true');
        onCameraToggle(true);
        
        // 等待狀態更新後再開始處理
        setTimeout(() => {
          log('📷 攝影機狀態已更新，開始處理');
          startProcessing();
        }, 100);
      }
    } catch (err) {
      console.error('攝影機初始化失敗:', err);
      setError('無法存取攝影機，請確認已授予攝影機權限');
      onCameraToggle(false);
    }
  }, [onCameraToggle]);

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
      videoRef.current.srcObject = null;
    }
    
    onCameraToggle(false);
    setIsProcessing(false);
  }, [onCameraToggle]);

  // 開始圖像處理
  const startProcessing = useCallback(() => {
    console.log('🔍 startProcessing 被調用，isActive:', isActive);
    if (!videoRef.current || !canvasRef.current) {
      console.log('❌ 無法開始處理：video 或 canvas 不存在');
      return;
    }
    
    console.log('🚀 開始圖像處理循環，isActive:', isActive);
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
        const ctx = canvas.getContext('2d');
        
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
        
        // 繪製檢測框（中心點）
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) / 4;
        
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        
        // 繪製十字線
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 20, centerY);
        ctx.lineTo(centerX + 20, centerY);
        ctx.moveTo(centerX, centerY - 20);
        ctx.lineTo(centerX, centerY + 20);
        ctx.stroke();
        
        log('🎯 檢測框已繪製');

        // 使用 OpenCV 處理圖像
        log('🔧 調用 OpenCV 處理函數...');
        const rgbData = await processImageForRGB(
          canvas,
          detectionSettings
        );

        if (rgbData) {
          log('✅ 檢測到 RGB 數據:', rgbData.hex);
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
  }, [isActive, onCameraToggle, detectionSettings.enableDetailedLogs, onRGBDetected]);

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

      <div className="camera-preview">
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
      </div>
    </div>
  );
};

export default CameraCapture;
