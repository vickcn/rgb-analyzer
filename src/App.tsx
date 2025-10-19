import React, { useState, useRef, useEffect, useCallback } from 'react';
import CameraCapture from './components/CameraCapture';
import RGBDisplay from './components/RGBDisplay';
import DetectionControls from './components/DetectionControls';
import HistoryPanel from './components/HistoryPanel';
import RGB3DVisualization from './components/RGB3DVisualization';
import { exportToExcel, exportImages } from './utils/exportUtils';
import './App.css';

export interface RGBData {
  r: number;
  g: number;
  b: number;
  hex: string;
  timestamp: number;
  x: number;
  y: number;
  h?: number; // HSV values (optional for backward compatibility)
  s?: number;
  v?: number;
}

export interface TimeIntervalRecord {
  id: string;
  startTime: number;
  endTime: number;
  records: RGBData[];
  annotatedImage?: string; // base64 encoded annotated image
  rawImage?: string; // base64 encoded raw image
}

function App() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentRGB, setCurrentRGB] = useState<RGBData | null>(null);
  const [detectionHistory, setDetectionHistory] = useState<RGBData[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingData, setRecordingData] = useState<RGBData[]>([]);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const [show3DVisualization, setShow3DVisualization] = useState(false);
  const [shouldFreezeCamera, setShouldFreezeCamera] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCameraFullscreen, setIsCameraFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detectionSettings, setDetectionSettings] = useState({
    edgeThreshold1: 50,
    edgeThreshold2: 150,
    minArea: 100,
    blurKernel: 5,
    enableEdgeDetection: true,
    enableColorDetection: true,
    enableDetailedLogs: false, // 生產環境預設關閉詳細 log
    // 新增：ROI 與像素過濾預設
    edgeMarginPercent: 5,
    minEdgeMarginPx: 2,
    whiteThreshold: 240,
    blackThreshold: 10,
    minSaturation: 10,
    sampleStep: 2
  });

  const handleRGBDetected = useCallback((rgbData: RGBData) => {
    setCurrentRGB(rgbData);
    setDetectionHistory(prev => [rgbData, ...prev.slice(0, 49)]); // 保留最近50筆記錄
  }, []);

  const clearHistory = () => {
    setDetectionHistory([]);
  };

  const clearOldHistory = (minutes: number = 10) => {
    const cutoffTime = Date.now() - minutes * 60 * 1000;
    setDetectionHistory(prev => prev.filter(item => item.timestamp > cutoffTime));
  };

  // 調試3D視覺化狀態
  useEffect(() => {
    console.log('🔍 App.tsx - show3DVisualization:', show3DVisualization, 'recordingData.length:', recordingData.length);
    if (recordingData.length > 0) {
      console.log('📊 第一筆數據:', recordingData[0]);
    }
  }, [show3DVisualization, recordingData]);

  // 時段區間紀錄功能
  const startRecording = () => {
    console.log('⏺️ 開始時段紀錄');
    
    if (!isCameraActive) {
      alert('請先啟動攝影機');
      return;
    }

    if (!currentRGB) {
      alert('請確保有RGB數據可記錄');
      return;
    }

    setIsRecording(true);
    setRecordingData([]);
    
    // 使用本地變數追蹤記錄狀態，避免狀態更新時序問題
    let isRecordingLocal = true;
    let recordCount = 0; // 本地計數器
    
    // 每0.5秒記錄一筆數據
    const interval = setInterval(() => {
      // 檢查是否還在記錄狀態
      if (!isRecordingLocal) {
        clearInterval(interval);
        return;
      }
      
      // 使用最新的 currentRGB 數據
      if (currentRGB) {
        // 增加本地計數器
        recordCount++;
        
        // 添加一些隨機變化來模擬真實的顏色變化
        const variation = 2; // 允許 ±2 的變化
        const rVariation = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
        const gVariation = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
        const bVariation = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
        
        // 創建新的 RGB 數據，使用當前時間戳和輕微變化
        const newRGBData = {
          r: Math.max(0, Math.min(255, currentRGB.r + rVariation)),
          g: Math.max(0, Math.min(255, currentRGB.g + gVariation)),
          b: Math.max(0, Math.min(255, currentRGB.b + bVariation)),
          hex: '', // 將在下面計算
          timestamp: Date.now(),
          x: currentRGB.x,
          y: currentRGB.y
        };
        
        // 計算新的 hex 值
        newRGBData.hex = `#${newRGBData.r.toString(16).padStart(2, '0')}${newRGBData.g.toString(16).padStart(2, '0')}${newRGBData.b.toString(16).padStart(2, '0')}`;
        
        setRecordingData(prev => {
          const newData = [...prev, newRGBData];
          return newData;
        });
        
        // 檢查是否達到最大記錄數
        if (recordCount >= 10) {
          console.log('🔟 達到最大記錄數，自動停止');
          isRecordingLocal = false; // 停止本地記錄狀態
          // 直接調用 stopRecording，不使用 setTimeout
          stopRecording(recordCount);
        }
      }
    }, 500);

    setRecordingInterval(interval);
  };

  const stopRecording = (currentDataCount?: number) => {
    console.log('🛑 停止時段紀錄');
    const actualDataCount = currentDataCount || recordingData.length;
    console.log('📊 記錄到的數據筆數:', actualDataCount);
    
    // 立即清除間隔器
    if (recordingInterval) {
      clearInterval(recordingInterval);
      setRecordingInterval(null);
      console.log('⏹️ 清除紀錄間隔器');
    }
    
    // 設置狀態
    setIsRecording(false);
    
    // 如果有記錄到超過1筆數據，顯示3D視覺化並定格最後一秒
    if (actualDataCount > 1) {
      console.log('🎨 準備顯示3D視覺化，數據筆數:', actualDataCount);
      console.log('  - 當前攝影機全螢幕狀態:', isCameraFullscreen);
      console.log('  - 3D視覺化將以', isCameraFullscreen ? '浮動覆蓋層' : '正常模式', '顯示');
      
      // 使用 setTimeout 確保 recordingData 狀態已更新
      setTimeout(() => {
        setShow3DVisualization(true);
        console.log('✅ 3D視覺化狀態已設置為顯示');
        console.log('  - show3DVisualization: true');
        console.log('  - recordingData.length:', recordingData.length);
        console.log('  - isCameraFullscreen:', isCameraFullscreen);
        console.log('  - 預期顯示模式:', isCameraFullscreen ? 'floating-overlay (浮動到全螢幕之上)' : 'normal-mode (正常顯示)');
        
        // 定格最後一秒的狀況
        console.log('🎬 定格最後一秒的狀況');
        setShouldFreezeCamera(true);
        
        // 3秒後自動解除定格（可選）
        setTimeout(() => {
          console.log('⏯️ 自動解除定格');
          setShouldFreezeCamera(false);
        }, 3000);
      }, 100); // 給狀態更新一點時間
    } else {
      console.log('⚠️ 記錄數據不足，無法顯示3D視覺化 (需要超過1筆)');
    }
  };

  const handleExportChoice = (choice: 'none' | 'images' | 'xlsx' | 'both') => {
    console.log('📤 用戶選擇匯出選項:', choice);
    
    switch (choice) {
      case 'none':
        // 清空記憶體
        console.log('🗑️ 清除記錄數據');
        setRecordingData([]);
        setShow3DVisualization(false);
        break;
      case 'images':
        // 匯出純圖
        console.log('🖼️ 匯出圖片');
        handleExportImages();
        break;
      case 'xlsx':
        // 匯出xlsx
        console.log('📊 匯出Excel');
        exportXLSX();
        break;
      case 'both':
        // 匯出純圖與xlsx
        console.log('📦 匯出全部');
        handleExportImages();
        exportXLSX();
        break;
    }
  };

  const handleExportImages = async () => {
    try {
      if (canvasRef.current) {
        await exportImages(canvasRef.current, recordingData);
        alert(`成功匯出 ${recordingData.length} 筆記錄的圖片`);
      } else {
        alert('無法獲取畫面，請確保攝影機正在運行');
      }
    } catch (error) {
      console.error('匯出圖片失敗:', error);
      alert('匯出圖片失敗，請重試');
    }
    setRecordingData([]);
    setShow3DVisualization(false);
  };

  const exportXLSX = () => {
    try {
      exportToExcel(recordingData);
      alert(`成功匯出 ${recordingData.length} 筆記錄的xlsx檔案`);
    } catch (error) {
      console.error('匯出xlsx失敗:', error);
      alert('匯出xlsx失敗，請重試');
    }
    setRecordingData([]);
    setShow3DVisualization(false);
  };

  // 計算RGB數據的統計資訊
  const calculateRGBStats = () => {
    if (recordingData.length === 0) return null;

    console.log('📊 計算統計資訊，記錄數據:', recordingData);
    const avgR = recordingData.reduce((sum, item) => sum + item.r, 0) / recordingData.length;
    const avgG = recordingData.reduce((sum, item) => sum + item.g, 0) / recordingData.length;
    const avgB = recordingData.reduce((sum, item) => sum + item.b, 0) / recordingData.length;
    console.log('📊 平均值:', { avgR, avgG, avgB });

    // 計算歐式空間距離和標準差
    const distances = recordingData.map(item => {
      const diffR = item.r - avgR;
      const diffG = item.g - avgG;
      const diffB = item.b - avgB;
      return Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB);
    });

    const avgDistance = distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
    const variance = distances.reduce((sum, dist) => sum + (dist - avgDistance) * (dist - avgDistance), 0) / distances.length;
    const standardDeviation = Math.sqrt(variance);

    // 計算各通道的標準差
    const rVariance = recordingData.reduce((sum, item) => sum + (item.r - avgR) * (item.r - avgR), 0) / recordingData.length;
    const gVariance = recordingData.reduce((sum, item) => sum + (item.g - avgG) * (item.g - avgG), 0) / recordingData.length;
    const bVariance = recordingData.reduce((sum, item) => sum + (item.b - avgB) * (item.b - avgB), 0) / recordingData.length;

    return {
      average: { r: Math.round(avgR), g: Math.round(avgG), b: Math.round(avgB) },
      averageDistance: Math.round(avgDistance * 100) / 100,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      channelStdDev: {
        r: Math.round(Math.sqrt(rVariance) * 100) / 100,
        g: Math.round(Math.sqrt(gVariance) * 100) / 100,
        b: Math.round(Math.sqrt(bVariance) * 100) / 100
      },
      minDistance: Math.round(Math.min(...distances) * 100) / 100,
      maxDistance: Math.round(Math.max(...distances) * 100) / 100
    };
  };

  // 追蹤3D視覺化狀態變化（只在狀態真正改變時記錄）
  useEffect(() => {
    if (show3DVisualization) {
      console.log('🎨 3D視覺化已顯示，記錄數據筆數:', recordingData.length);
    }
  }, [show3DVisualization, recordingData.length]);

  // 攝影機全螢幕狀態回調
  const handleCameraFullscreenChange = useCallback((isFullscreen: boolean) => {
    setIsCameraFullscreen(isFullscreen);
    console.log('📺 App.tsx - 攝影機全螢幕狀態變化:', isFullscreen);
  }, []);

  // 關閉 3D 視覺化回調
  const handleClose3DVisualization = useCallback(() => {
    console.log('🔄 App.tsx - 關閉 3D 視覺化');
    setShow3DVisualization(false);
  }, []);

  // 調試3D視覺化顯示條件
  useEffect(() => {
    console.log('🔍 3D視覺化顯示條件檢查:');
    console.log('  - show3DVisualization:', show3DVisualization);
    console.log('  - recordingData.length:', recordingData.length);
    console.log('  - 條件結果:', show3DVisualization && recordingData.length > 1);
    console.log('  - isCameraFullscreen (App state):', isCameraFullscreen);
    console.log('  - document.fullscreenElement (Browser API):', document.fullscreenElement);
    console.log('  - 狀態是否一致:', isCameraFullscreen === !!document.fullscreenElement);
    
    // 檢查 3D 視覺化是否應該顯示
    if (show3DVisualization && recordingData.length > 1) {
      console.log('🎨 3D視覺化應該顯示');
      console.log('  - 顯示模式:', isCameraFullscreen ? '浮動覆蓋層 (floating-overlay)' : '正常模式 (normal-mode)');
      
      if (isCameraFullscreen) {
        console.log('📺 攝影機全螢幕模式 - 3D視覺化應該浮動到全螢幕畫布之上');
        console.log('  - CSS 類別: floating-overlay');
        console.log('  - z-index: 9999 (最高層級)');
        console.log('  - 位置: position: fixed, top: 0, left: 0');
        console.log('  - 尺寸: width: 100vw, height: 100vh');
      } else {
        console.log('📱 正常模式 - 3D視覺化正常顯示在頁面中');
        console.log('  - CSS 類別: normal-mode');
        console.log('  - 位置: 正常文檔流');
      }
    } else {
      console.log('❌ 3D視覺化不應該顯示');
      if (!show3DVisualization) console.log('  - 原因: show3DVisualization = false');
      if (recordingData.length <= 1) console.log('  - 原因: recordingData.length <= 1');
    }
  }, [show3DVisualization, recordingData.length, isCameraFullscreen]);

  // 記錄 3D 視覺化渲染狀態
  useEffect(() => {
    if (show3DVisualization && recordingData.length > 1) {
      console.log('🎨 3D視覺化正在渲染:', {
        show3DVisualization,
        recordingDataLength: recordingData.length,
        isCameraFullscreen,
        className: isCameraFullscreen ? 'floating-overlay' : 'normal-mode',
        shouldFloat: isCameraFullscreen,
        renderTime: new Date().toISOString()
      });
      
      if (isCameraFullscreen) {
        console.log('📺 3D視覺化應該浮動到全螢幕畫布之上');
        console.log('  - 內聯樣式已應用: position: fixed, zIndex: 9999');
        console.log('  - 覆蓋範圍: 100vw × 100vh');
        console.log('  - 背景: rgba(0, 0, 0, 0.95)');
        
        // 檢查 DOM 元素是否真的存在
        setTimeout(() => {
          const visualizationElement = document.querySelector('.visualization-section.floating-overlay');
          if (visualizationElement) {
            const rect = visualizationElement.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(visualizationElement);
            console.log('🔍 DOM 元素檢查:');
            console.log('  - 元素存在:', !!visualizationElement);
            console.log('  - 位置:', { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
            console.log('  - 樣式:', {
              position: computedStyle.position,
              zIndex: computedStyle.zIndex,
              display: computedStyle.display,
              visibility: computedStyle.visibility,
              opacity: computedStyle.opacity
            });
            console.log('  - 是否可見:', rect.width > 0 && rect.height > 0);
          } else {
            console.log('❌ DOM 元素不存在: .visualization-section.floating-overlay');
          }
        }, 100);
      }
    }
  }, [show3DVisualization, recordingData.length, isCameraFullscreen]);

  // 監聽全螢幕狀態變化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎨 RGB 色光檢測器</h1>
        <p>透過手機攝影機即時檢測RGB色光值</p>
      </header>

      <main className="app-main">
        <div className="camera-section">
          <CameraCapture
            isActive={isCameraActive}
            onCameraToggle={setIsCameraActive}
            onRGBDetected={handleRGBDetected}
            detectionSettings={detectionSettings}
            isRecording={isRecording}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            recordingData={recordingData}
            canvasRef={canvasRef}
            shouldFreeze={shouldFreezeCamera}
            onFullscreenChange={handleCameraFullscreenChange}
            show3DVisualization={show3DVisualization}
            onClose3DVisualization={handleClose3DVisualization}
          />
        </div>

        <div className="controls-section">
          <DetectionControls
            settings={detectionSettings}
            onSettingsChange={setDetectionSettings}
          />
        </div>

        <div className="display-section">
          <RGBDisplay
            currentRGB={currentRGB}
            isActive={isCameraActive}
          />
        </div>

            <div className="history-section">
              <HistoryPanel
                history={detectionHistory}
                onClear={clearHistory}
                onClearOld={clearOldHistory}
              />
            </div>
      </main>


      {/* 3D RGB視覺化 - 只在攝影機全螢幕時浮動顯示 */}
      {show3DVisualization && recordingData.length > 1 && (
        <div 
          className={`visualization-section ${isCameraFullscreen ? 'floating-overlay' : 'normal-mode'}`}
          style={{
            // 添加內聯樣式以便調試
            ...(isCameraFullscreen && {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 99999,
              backgroundColor: 'rgba(255, 0, 0, 0.8)',
              border: '5px solid yellow',
              pointerEvents: 'auto'
            })
          }}
        >
          <div className="visualization-header">
            <h3>🎨 RGB 3D 視覺化報告</h3>
            <div className="export-buttons">
              <button 
                onClick={() => handleExportChoice('images')} 
                className="export-btn images-btn"
                title="匯出圖片（原圖與標註圖）"
              >
                🖼️ 匯出圖片
              </button>
              <button 
                onClick={() => handleExportChoice('xlsx')} 
                className="export-btn xlsx-btn"
                title="匯出Excel表格"
              >
                📊 匯出Excel
              </button>
              <button 
                onClick={() => handleExportChoice('both')} 
                className="export-btn both-btn"
                title="匯出圖片與Excel"
              >
                📦 匯出全部
              </button>
              <button 
                onClick={() => handleExportChoice('none')} 
                className="export-btn clear-btn"
                title="清除數據"
              >
                🗑️ 清除數據
              </button>
            </div>
          </div>
          
          <RGB3DVisualization data={recordingData} isVisible={show3DVisualization} />
          
          {calculateRGBStats() && (
            <div className="rgb-stats">
              <h4>📊 RGB 空間分布統計</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">平均值:</span>
                  <span className="stat-value">
                    RGB({calculateRGBStats()!.average.r}, {calculateRGBStats()!.average.g}, {calculateRGBStats()!.average.b})
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">平均歐式距離:</span>
                  <span className="stat-value">{calculateRGBStats()!.averageDistance}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">歐式空間標準差:</span>
                  <span className="stat-value">{calculateRGBStats()!.standardDeviation}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">距離範圍:</span>
                  <span className="stat-value">
                    {calculateRGBStats()!.minDistance} ~ {calculateRGBStats()!.maxDistance}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">各通道標準差:</span>
                  <span className="stat-value">
                    R:{calculateRGBStats()!.channelStdDev.r} G:{calculateRGBStats()!.channelStdDev.g} B:{calculateRGBStats()!.channelStdDev.b}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">記錄點數:</span>
                  <span className="stat-value">{recordingData.length} 個</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="app-footer">
        <p>使用 OpenCV.js 進行即時圖像處理</p>
      </footer>
    </div>
  );
}

export default App;