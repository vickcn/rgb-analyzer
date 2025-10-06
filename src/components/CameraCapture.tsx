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
        
        onCameraToggle(true);
        console.log('📷 攝影機初始化完成，開始處理');
        startProcessing();
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
  const startProcessing = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.log('❌ 無法開始處理：video 或 canvas 不存在');
      return;
    }
    
    console.log('🚀 開始圖像處理循環');
    setIsProcessing(true);
    
    const processFrame = async () => {
      console.log('🔄 processFrame 被調用，isActive:', isActive);
      
      if (!videoRef.current || !canvasRef.current || !isActive) {
        console.log('❌ 停止處理：video/canvas 不存在或攝影機未啟動');
        setIsProcessing(false);
        return;
      }

      // 檢查影片是否準備好
      if (videoRef.current.readyState < 2) {
        console.log('⏳ 影片尚未準備好，readyState:', videoRef.current.readyState);
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // 限制處理頻率，每 200ms 處理一次
      const now = Date.now();
      if (now - lastProcessTime.current < 200) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastProcessTime.current = now;
      
      console.log('📹 處理影格...', new Date().toLocaleTimeString());

      try {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return;

        // 設定畫布尺寸
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        console.log('📐 畫布尺寸設定為:', canvas.width, 'x', canvas.height);

        // 繪製當前影格
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        console.log('🖼️ 影格繪製完成');

        // 使用 OpenCV 處理圖像
        console.log('🔧 調用 OpenCV 處理函數...');
        const rgbData = await processImageForRGB(
          canvas,
          detectionSettings
        );

        if (rgbData) {
          console.log('✅ 檢測到 RGB 數據:', rgbData.hex);
          onRGBDetected(rgbData);
        } else {
          console.log('❌ 未檢測到 RGB 數據');
        }

        // 繼續處理下一幀
        animationFrameRef.current = requestAnimationFrame(processFrame);
      } catch (err) {
        console.error('圖像處理錯誤:', err);
        setIsProcessing(false);
      }
    };

    console.log('🎬 開始第一幀處理');
    processFrame();
  };

  // 處理攝影機狀態變化
  useEffect(() => {
    if (isActive && !streamRef.current) {
      initializeCamera();
    } else if (!isActive && streamRef.current) {
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
          disabled={isProcessing}
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
          style={{ display: 'none' }}
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
      </div>
    </div>
  );
};

export default CameraCapture;
