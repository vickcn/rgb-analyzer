import React from 'react';
import { RGBData } from '../App';
import './HistoryPanel.css';

interface HistoryPanelProps {
  history: RGBData[];
  onClear: () => void;
  onClearOld: (minutes: number) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onClear, onClearOld }) => {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const copyColor = async (rgbData: RGBData) => {
    try {
      await navigator.clipboard.writeText(rgbData.hex);
    } catch (err) {
      console.error('複製失敗:', err);
    }
  };

  if (history.length === 0) {
    return (
      <div className="history-panel">
        <div className="history-header">
          <h3>📊 檢測歷史</h3>
        </div>
        <div className="no-history">
          <div className="no-history-icon">📈</div>
          <p>尚無檢測記錄</p>
          <small>開始檢測後，歷史記錄會顯示在這裡</small>
        </div>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="history-header">
        <h3>📊 檢測歷史</h3>
        <div className="history-stats">
          <span className="stat-item">
            總計: {history.length} 筆
          </span>
          <div className="clear-options">
            <button 
              className="clear-button"
              onClick={onClear}
              title="清除所有記錄"
            >
              🗑️ 清除全部
            </button>
            <button 
              className="clear-old-button"
              onClick={() => onClearOld(10)}
              title="清除 10 分鐘前的記錄"
            >
              ⏰ 清除舊記錄
            </button>
          </div>
        </div>
      </div>

      <div className="history-list">
        {history.map((item, index) => (
          <div key={`${item.timestamp}-${index}`} className="history-item">
            <div className="history-time">
              {formatTime(item.timestamp)}
            </div>
            
            <div className="history-color">
              <div 
                className="history-swatch"
                style={{ backgroundColor: item.hex }}
              />
              <div className="history-values">
                <div className="history-hex">{item.hex.toUpperCase()}</div>
                <div className="history-rgb">
                  RGB({item.r}, {item.g}, {item.b})
                </div>
              </div>
            </div>

            <button 
              className="copy-history-button"
              onClick={() => copyColor(item)}
              title="複製顏色值"
            >
              📋
            </button>
          </div>
        ))}
      </div>

      <div className="history-summary">
        <div className="summary-item">
          <span className="summary-label">平均亮度:</span>
          <span className="summary-value">
            {Math.round(
              history.reduce((sum, item) => sum + (item.r + item.g + item.b) / 3, 0) / history.length
            )} / 255
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">檢測時長:</span>
          <span className="summary-value">
            {history.length > 1 
              ? `${Math.round((history[0].timestamp - history[history.length - 1].timestamp) / 1000)}秒`
              : '0秒'
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
