import React from 'react';
import { RGBData } from '../App';
import './RGBDisplay.css';

interface RGBDisplayProps {
  currentRGB: RGBData | null;
  isActive: boolean;
}

const RGBDisplay: React.FC<RGBDisplayProps> = ({ currentRGB, isActive }) => {
  if (!currentRGB) {
    return (
      <div className="rgb-display">
        <h3>🎨 RGB 值顯示</h3>
        <div className="no-data">
          <div className="no-data-icon">🔍</div>
          <p>等待檢測數據...</p>
          <small>{isActive ? '將攝影機對準色光區域' : '請先啟動攝影機'}</small>
        </div>
      </div>
    );
  }

  const { r, g, b, hex, timestamp } = currentRGB;

  return (
    <div className="rgb-display">
      <h3>🎨 RGB 值顯示</h3>
      
      <div className="color-preview">
        <div 
          className="color-swatch"
          style={{ backgroundColor: hex }}
        />
        <div className="color-info">
          <div className="hex-value">{hex.toUpperCase()}</div>
          <div className="timestamp">
            {new Date(timestamp).toLocaleTimeString('zh-TW')}
          </div>
        </div>
      </div>

      <div className="rgb-values">
        <div className="rgb-channel">
          <div className="channel-label">R (紅)</div>
          <div className="channel-value red">{r}</div>
          <div className="channel-bar">
            <div 
              className="channel-fill red-fill"
              style={{ width: `${(r / 255) * 100}%` }}
            />
          </div>
        </div>

        <div className="rgb-channel">
          <div className="channel-label">G (綠)</div>
          <div className="channel-value green">{g}</div>
          <div className="channel-bar">
            <div 
              className="channel-fill green-fill"
              style={{ width: `${(g / 255) * 100}%` }}
            />
          </div>
        </div>

        <div className="rgb-channel">
          <div className="channel-label">B (藍)</div>
          <div className="channel-value blue">{b}</div>
          <div className="channel-bar">
            <div 
              className="channel-fill blue-fill"
              style={{ width: `${(b / 255) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="color-details">
        <div className="detail-item">
          <span className="detail-label">亮度:</span>
          <span className="detail-value">
            {Math.round(((r + g + b) / 3 / 255) * 100)}%
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">飽和度:</span>
          <span className="detail-value">
            {calculateSaturation(r, g, b)}%
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">色相:</span>
          <span className="detail-value">
            {calculateHue(r, g, b)}°
          </span>
        </div>
      </div>

      <div className="copy-actions">
        <button 
          className="copy-button"
          onClick={() => copyToClipboard(hex)}
        >
          📋 複製 HEX
        </button>
        <button 
          className="copy-button"
          onClick={() => copyToClipboard(`rgb(${r}, ${g}, ${b})`)}
        >
          📋 複製 RGB
        </button>
      </div>
    </div>
  );
};

// 計算飽和度
const calculateSaturation = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return Math.round(((max - min) / max) * 100);
};

// 計算色相
const calculateHue = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  
  if (delta === 0) return 0;
  
  let hue = 0;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }
  
  hue = Math.round(hue * 60);
  return hue < 0 ? hue + 360 : hue;
};

// 複製到剪貼簿
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    // 可以添加成功提示
  } catch (err) {
    console.error('複製失敗:', err);
  }
};

export default RGBDisplay;
