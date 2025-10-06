import React, { useState } from 'react';
import CameraCapture from './components/CameraCapture';
import RGBDisplay from './components/RGBDisplay';
import DetectionControls from './components/DetectionControls';
import HistoryPanel from './components/HistoryPanel';
import './App.css';

export interface RGBData {
  r: number;
  g: number;
  b: number;
  hex: string;
  timestamp: number;
  x: number;
  y: number;
}

function App() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentRGB, setCurrentRGB] = useState<RGBData | null>(null);
  const [detectionHistory, setDetectionHistory] = useState<RGBData[]>([]);
  const [detectionSettings, setDetectionSettings] = useState({
    edgeThreshold1: 50,
    edgeThreshold2: 150,
    minArea: 100,
    blurKernel: 5,
    enableEdgeDetection: true,
    enableColorDetection: true
  });

  const handleRGBDetected = (rgbData: RGBData) => {
    setCurrentRGB(rgbData);
    setDetectionHistory(prev => [rgbData, ...prev.slice(0, 49)]); // 保留最近50筆記錄
  };

  const clearHistory = () => {
    setDetectionHistory([]);
  };

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
          />
        </div>
      </main>

      <footer className="app-footer">
        <p>使用 OpenCV.js 進行即時圖像處理</p>
      </footer>
    </div>
  );
}

export default App;