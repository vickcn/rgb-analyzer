import React, { useState } from 'react';
import './DetectionControls.css';

interface DetectionControlsProps {
  settings: {
    edgeThreshold1: number;
    edgeThreshold2: number;
    minArea: number;
    blurKernel: number;
    enableEdgeDetection: boolean;
    enableColorDetection: boolean;
    enableDetailedLogs: boolean;
    // 新增設定（與 utils 對齊）
    edgeMarginPercent: number;
    minEdgeMarginPx: number;
    whiteThreshold: number;
    blackThreshold: number;
    minSaturation: number;
    sampleStep: number;
  };
  onSettingsChange: (settings: any) => void;
}

const DetectionControls: React.FC<DetectionControlsProps> = ({
  settings,
  onSettingsChange
}) => {
  const [isMainPanelExpanded, setIsMainPanelExpanded] = useState(false);
  const [isDetectionModeExpanded, setIsDetectionModeExpanded] = useState(false);
  const [isEdgeDetectionExpanded, setIsEdgeDetectionExpanded] = useState(false);
  const [isGeneralExpanded, setIsGeneralExpanded] = useState(false);
  const [isTipsExpanded, setIsTipsExpanded] = useState(false);

  const updateSetting = (key: string, value: any) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  const resetToDefaults = () => {
    onSettingsChange({
      edgeThreshold1: 50,
      edgeThreshold2: 150,
      minArea: 100,
      blurKernel: 5,
      enableEdgeDetection: true,
      enableColorDetection: true,
      enableDetailedLogs: false,
      edgeMarginPercent: 5,
      minEdgeMarginPx: 2,
      whiteThreshold: 240,
      blackThreshold: 10,
      minSaturation: 10,
      sampleStep: 2
    });
  };

  return (
    <div className="detection-controls">
      <div className="controls-header collapsible">
        <div 
          className="main-panel-header"
          onClick={() => setIsMainPanelExpanded(!isMainPanelExpanded)}
        >
          <h3>⚙️ 檢測設定</h3>
          <span className={`collapse-icon ${isMainPanelExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>
        {isMainPanelExpanded && (
          <button 
            className="reset-button"
            onClick={resetToDefaults}
          >
            🔄 重置預設
          </button>
        )}
      </div>

      {isMainPanelExpanded && (
        <div className="control-groups">
          {/* 檢測模式 */}
          <div className="control-group collapsible">
            <div 
              className="control-group-header"
              onClick={() => setIsDetectionModeExpanded(!isDetectionModeExpanded)}
            >
              <h4>🔍 檢測模式</h4>
              <span className={`collapse-icon ${isDetectionModeExpanded ? 'expanded' : ''}`}>
                ▼
              </span>
            </div>
            {isDetectionModeExpanded && (
              <div className="control-group-content">
                <div className="toggle-controls">
                  <label className="toggle-item">
                    <input
                      type="checkbox"
                      checked={settings.enableEdgeDetection}
                      onChange={(e) => updateSetting('enableEdgeDetection', e.target.checked)}
                    />
                    <span className="toggle-label">邊緣檢測</span>
                    <span className="toggle-description">使用 Canny 演算法檢測物體邊緣</span>
                  </label>
                  
                  <label className="toggle-item">
                    <input
                      type="checkbox"
                      checked={settings.enableColorDetection}
                      onChange={(e) => updateSetting('enableColorDetection', e.target.checked)}
                    />
                    <span className="toggle-label">色光檢測</span>
                    <span className="toggle-description">檢測高亮度色光區域</span>
                  </label>
                  
                  <label className="toggle-item">
                    <input
                      type="checkbox"
                      checked={settings.enableDetailedLogs}
                      onChange={(e) => updateSetting('enableDetailedLogs', e.target.checked)}
                    />
                    <span className="toggle-label">詳細 Log</span>
                    <span className="toggle-description">顯示詳細的檢測過程 log</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 邊緣檢測參數 */}
          {settings.enableEdgeDetection && (
            <div className="control-group collapsible">
              <div 
                className="control-group-header"
                onClick={() => setIsEdgeDetectionExpanded(!isEdgeDetectionExpanded)}
              >
                <h4>📐 邊緣檢測參數</h4>
                <span className={`collapse-icon ${isEdgeDetectionExpanded ? 'expanded' : ''}`}>
                  ▼
                </span>
              </div>
              {isEdgeDetectionExpanded && (
                <div className="control-group-content">
                  <div className="slider-controls">
                    <div className="slider-item">
                      <label className="slider-label">
                        低閾值: {settings.edgeThreshold1}
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="200"
                        value={settings.edgeThreshold1}
                        onChange={(e) => updateSetting('edgeThreshold1', parseInt(e.target.value))}
                        className="slider"
                      />
                      <div className="slider-description">
                        較低值會檢測到更多邊緣
                      </div>
                    </div>

                    <div className="slider-item">
                      <label className="slider-label">
                        高閾值: {settings.edgeThreshold2}
                      </label>
                      <input
                        type="range"
                        min="50"
                        max="300"
                        value={settings.edgeThreshold2}
                        onChange={(e) => updateSetting('edgeThreshold2', parseInt(e.target.value))}
                        className="slider"
                      />
                      <div className="slider-description">
                        較高值只保留強邊緣
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 通用參數 */}
          <div className="control-group collapsible">
            <div 
              className="control-group-header"
              onClick={() => setIsGeneralExpanded(!isGeneralExpanded)}
            >
              <h4>🎯 通用參數</h4>
              <span className={`collapse-icon ${isGeneralExpanded ? 'expanded' : ''}`}>
                ▼
              </span>
            </div>
            {isGeneralExpanded && (
              <div className="control-group-content">
                <div className="slider-controls">
                  <div className="slider-item">
                    <label className="slider-label">
                      最小區域: {settings.minArea}px²
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="50"
                      value={settings.minArea}
                      onChange={(e) => updateSetting('minArea', parseInt(e.target.value))}
                      className="slider"
                    />
                    <div className="slider-description">
                      過濾掉太小的檢測區域
                    </div>
                  </div>

                  <div className="slider-item">
                    <label className="slider-label">
                      模糊核大小: {settings.blurKernel}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="15"
                      step="2"
                      value={settings.blurKernel}
                      onChange={(e) => updateSetting('blurKernel', parseInt(e.target.value))}
                      className="slider"
                    />
                    <div className="slider-description">
                      減少圖像噪聲，奇數值
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ROI 與像素過濾參數 */}
          <div className="control-group collapsible">
            <div 
              className="control-group-header"
              onClick={() => setIsGeneralExpanded(!isGeneralExpanded)}
            >
              <h4>📦 ROI 與像素過濾</h4>
              <span className={`collapse-icon ${isGeneralExpanded ? 'expanded' : ''}`}>
                ▼
              </span>
            </div>
            {isGeneralExpanded && (
              <div className="control-group-content">
                <div className="slider-controls">
                  <div className="slider-item">
                    <label className="slider-label">
                      ROI 內縮比例: {settings.edgeMarginPercent}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="1"
                      value={settings.edgeMarginPercent}
                      onChange={(e) => updateSetting('edgeMarginPercent', parseInt(e.target.value))}
                      className="slider"
                    />
                  </div>

                  <div className="slider-item">
                    <label className="slider-label">
                      內縮最小像素: {settings.minEdgeMarginPx}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={settings.minEdgeMarginPx}
                      onChange={(e) => updateSetting('minEdgeMarginPx', parseInt(e.target.value))}
                      className="slider"
                    />
                  </div>

                  <div className="slider-item">
                    <label className="slider-label">
                      近白門檻: {settings.whiteThreshold}
                    </label>
                    <input
                      type="range"
                      min="200"
                      max="255"
                      step="1"
                      value={settings.whiteThreshold}
                      onChange={(e) => updateSetting('whiteThreshold', parseInt(e.target.value))}
                      className="slider"
                    />
                  </div>

                  <div className="slider-item">
                    <label className="slider-label">
                      近黑門檻: {settings.blackThreshold}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="1"
                      value={settings.blackThreshold}
                      onChange={(e) => updateSetting('blackThreshold', parseInt(e.target.value))}
                      className="slider"
                    />
                  </div>

                  <div className="slider-item">
                    <label className="slider-label">
                      最小飽和度: {settings.minSaturation}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      step="1"
                      value={settings.minSaturation}
                      onChange={(e) => updateSetting('minSaturation', parseInt(e.target.value))}
                      className="slider"
                    />
                  </div>

                  <div className="slider-item">
                    <label className="slider-label">
                      取樣步距: {settings.sampleStep}px
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      step="1"
                      value={settings.sampleStep}
                      onChange={(e) => updateSetting('sampleStep', parseInt(e.target.value))}
                      className="slider"
                    />
                    <div className="slider-description">
                      步距越大效能越好，但精度降低
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 使用提示 */}
          <div className="tips-section collapsible">
            <div 
              className="control-group-header"
              onClick={() => setIsTipsExpanded(!isTipsExpanded)}
            >
              <h4>💡 使用提示</h4>
              <span className={`collapse-icon ${isTipsExpanded ? 'expanded' : ''}`}>
                ▼
              </span>
            </div>
            {isTipsExpanded && (
              <div className="control-group-content">
                <ul className="tips-list">
                  <li>將攝影機對準燈珠或發光物體</li>
                  <li>確保光線充足，避免過度曝光</li>
                  <li>調整參數以適應不同的檢測環境</li>
                  <li>邊緣檢測適合有明顯輪廓的物體</li>
                  <li>色光檢測適合發光或高亮度區域</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DetectionControls;