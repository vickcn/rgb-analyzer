import React, { useState } from 'react';
import { RGBData, ColorDisplayMode } from '../App';
import { getHueName, formatHSV, formatHSL } from '../utils/colorConversion';
import './RGBDisplay.css';

interface RGBDisplayProps {
  currentRGB: RGBData | null;
  isActive: boolean;
  displayMode: ColorDisplayMode;
}

const RGBDisplay: React.FC<RGBDisplayProps> = ({ currentRGB, isActive, displayMode }) => {
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    rgb: true,
    hsv: true,
    hsl: true,
    colortemp: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!currentRGB) {
    return (
      <div className="rgb-display">
        <h3>🎨 色彩值顯示</h3>
        <div className="no-data">
          <div className="no-data-icon">🔍</div>
          <p>等待檢測數據...</p>
          <small>{isActive ? '將攝影機對準色光區域' : '請先啟動攝影機'}</small>
        </div>
      </div>
    );
  }

  const { r, g, b, hex, timestamp, hsv_h, hsv_s, hsv_v, hsl_h, hsl_s, hsl_l, colorTemp, colorTempDesc } = currentRGB;

  // 複製到剪貼簿
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // 可以添加成功提示
      console.log(`已複製 ${label}: ${text}`);
    } catch (err) {
      console.error('複製失敗:', err);
    }
  };

  // 渲染 RGB 模式
  const renderRGBMode = () => (
    <>
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

      <div className="copy-actions">
        <button 
          className="copy-button"
          onClick={() => copyToClipboard(hex, 'HEX')}
        >
          📋 複製 HEX
        </button>
        <button 
          className="copy-button"
          onClick={() => copyToClipboard(`rgb(${r}, ${g}, ${b})`, 'RGB')}
        >
          📋 複製 RGB
        </button>
      </div>
    </>
  );

  // 渲染 HSV 模式
  const renderHSVMode = () => (
    <>
      <div className="color-preview">
        <div 
          className="color-swatch"
          style={{ backgroundColor: hex }}
        />
        <div className="color-info">
          <div className="hex-value">{getHueName(hsv_h || 0)}</div>
          <div className="timestamp">
            {new Date(timestamp).toLocaleTimeString('zh-TW')}
          </div>
        </div>
      </div>

      <div className="hsv-values">
        <div className="hsv-channel">
          <div className="channel-label">H (色相)</div>
          <div className="channel-value hue">{hsv_h}°</div>
          <div className="channel-bar">
            <div 
              className="channel-fill hue-fill"
              style={{ 
                width: `${((hsv_h || 0) / 360) * 100}%`,
                background: `linear-gradient(to right, 
                  hsl(0, 100%, 50%), 
                  hsl(60, 100%, 50%), 
                  hsl(120, 100%, 50%), 
                  hsl(180, 100%, 50%), 
                  hsl(240, 100%, 50%), 
                  hsl(300, 100%, 50%), 
                  hsl(360, 100%, 50%))`
              }}
            />
          </div>
        </div>

        <div className="hsv-channel">
          <div className="channel-label">S (飽和度)</div>
          <div className="channel-value saturation">{hsv_s}%</div>
          <div className="channel-bar">
            <div 
              className="channel-fill saturation-fill"
              style={{ width: `${hsv_s}%` }}
            />
          </div>
        </div>

        <div className="hsv-channel">
          <div className="channel-label">V (明度)</div>
          <div className="channel-value value">{hsv_v}%</div>
          <div className="channel-bar">
            <div 
              className="channel-fill value-fill"
              style={{ width: `${hsv_v}%` }}
            />
          </div>
        </div>
      </div>

      <div className="copy-actions">
        <button 
          className="copy-button"
          onClick={() => copyToClipboard(formatHSV({ h: hsv_h || 0, s: hsv_s || 0, v: hsv_v || 0 }), 'HSV')}
        >
          📋 複製 HSV
        </button>
      </div>
    </>
  );

  // 渲染 HSL 模式
  const renderHSLMode = () => (
    <>
      <div className="color-preview">
        <div 
          className="color-swatch"
          style={{ backgroundColor: hex }}
        />
        <div className="color-info">
          <div className="hex-value">{getHueName(hsl_h || 0)}</div>
          <div className="timestamp">
            {new Date(timestamp).toLocaleTimeString('zh-TW')}
          </div>
        </div>
      </div>

      <div className="hsl-values">
        <div className="hsl-channel">
          <div className="channel-label">H (色相)</div>
          <div className="channel-value hue">{hsl_h}°</div>
          <div className="channel-bar">
            <div 
              className="channel-fill hue-fill"
              style={{ 
                width: `${((hsl_h || 0) / 360) * 100}%`,
                background: `linear-gradient(to right, 
                  hsl(0, 100%, 50%), 
                  hsl(60, 100%, 50%), 
                  hsl(120, 100%, 50%), 
                  hsl(180, 100%, 50%), 
                  hsl(240, 100%, 50%), 
                  hsl(300, 100%, 50%), 
                  hsl(360, 100%, 50%))`
              }}
            />
          </div>
        </div>

        <div className="hsl-channel">
          <div className="channel-label">S (飽和度)</div>
          <div className="channel-value saturation">{hsl_s}%</div>
          <div className="channel-bar">
            <div 
              className="channel-fill saturation-fill"
              style={{ width: `${hsl_s}%` }}
            />
          </div>
        </div>

        <div className="hsl-channel">
          <div className="channel-label">L (亮度)</div>
          <div className="channel-value lightness">{hsl_l}%</div>
          <div className="channel-bar">
            <div 
              className="channel-fill lightness-fill"
              style={{ width: `${hsl_l}%` }}
            />
          </div>
        </div>
      </div>

      <div className="copy-actions">
        <button 
          className="copy-button"
          onClick={() => copyToClipboard(formatHSL({ h: hsl_h || 0, s: hsl_s || 0, l: hsl_l || 0 }), 'HSL')}
        >
          📋 複製 HSL
        </button>
      </div>
    </>
  );

  // 渲染色溫模式
  const renderColorTempMode = () => (
    <>
      <div className="color-preview">
        <div 
          className="color-swatch"
          style={{ backgroundColor: hex }}
        />
        <div className="color-info">
          <div className="hex-value">{colorTemp}K</div>
          <div className="timestamp">
            {new Date(timestamp).toLocaleTimeString('zh-TW')}
          </div>
        </div>
      </div>

      <div className="colortemp-values">
        <div className="colortemp-info">
          <div className="colortemp-main">
            <div className="colortemp-label">色溫</div>
            <div className="colortemp-value">{colorTemp} K</div>
          </div>
          <div className="colortemp-description">{colorTempDesc}</div>
        </div>

        <div className="colortemp-bar-container">
          <div className="colortemp-bar">
            <div 
              className="colortemp-indicator"
              style={{ 
                left: `${Math.min(100, Math.max(0, ((colorTemp || 0) - 1000) / (25000 - 1000) * 100))}%`
              }}
            />
          </div>
          <div className="colortemp-labels">
            <span>1000K<br/>(暖)</span>
            <span>6500K<br/>(日光)</span>
            <span>25000K<br/>(冷)</span>
          </div>
        </div>
      </div>

      <div className="copy-actions">
        <button 
          className="copy-button"
          onClick={() => copyToClipboard(`${colorTemp}K (${colorTempDesc})`, '色溫')}
        >
          📋 複製色溫
        </button>
      </div>
    </>
  );

  // 渲染全部模式（可展開/收合）
  const renderAllMode = () => (
    <>
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

      {/* RGB 區塊 */}
      <div className="collapsible-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('rgb')}
        >
          <h4>RGB 三原色</h4>
          <span className={`collapse-icon ${expandedSections.rgb ? 'expanded' : ''}`}>▼</span>
        </div>
        {expandedSections.rgb && (
          <div className="section-content">
            <div className="rgb-values">
              <div className="rgb-channel">
                <div className="channel-label">R (紅)</div>
                <div className="channel-value red">{r}</div>
                <div className="channel-bar">
                  <div className="channel-fill red-fill" style={{ width: `${(r / 255) * 100}%` }} />
                </div>
              </div>
              <div className="rgb-channel">
                <div className="channel-label">G (綠)</div>
                <div className="channel-value green">{g}</div>
                <div className="channel-bar">
                  <div className="channel-fill green-fill" style={{ width: `${(g / 255) * 100}%` }} />
                </div>
              </div>
              <div className="rgb-channel">
                <div className="channel-label">B (藍)</div>
                <div className="channel-value blue">{b}</div>
                <div className="channel-bar">
                  <div className="channel-fill blue-fill" style={{ width: `${(b / 255) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* HSV 區塊 */}
      <div className="collapsible-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('hsv')}
        >
          <h4>HSV 色彩空間</h4>
          <span className={`collapse-icon ${expandedSections.hsv ? 'expanded' : ''}`}>▼</span>
        </div>
        {expandedSections.hsv && (
          <div className="section-content">
            <div className="hsv-values">
              <div className="hsv-channel">
                <div className="channel-label">H (色相)</div>
                <div className="channel-value hue">{hsv_h}° - {getHueName(hsv_h || 0)}</div>
                <div className="channel-bar">
                  <div className="channel-fill hue-fill" style={{ width: `${((hsv_h || 0) / 360) * 100}%` }} />
                </div>
              </div>
              <div className="hsv-channel">
                <div className="channel-label">S (飽和度)</div>
                <div className="channel-value saturation">{hsv_s}%</div>
                <div className="channel-bar">
                  <div className="channel-fill saturation-fill" style={{ width: `${hsv_s}%` }} />
                </div>
              </div>
              <div className="hsv-channel">
                <div className="channel-label">V (明度)</div>
                <div className="channel-value value">{hsv_v}%</div>
                <div className="channel-bar">
                  <div className="channel-fill value-fill" style={{ width: `${hsv_v}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* HSL 區塊 */}
      <div className="collapsible-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('hsl')}
        >
          <h4>HSL 色彩空間</h4>
          <span className={`collapse-icon ${expandedSections.hsl ? 'expanded' : ''}`}>▼</span>
        </div>
        {expandedSections.hsl && (
          <div className="section-content">
            <div className="hsl-values">
              <div className="hsl-channel">
                <div className="channel-label">H (色相)</div>
                <div className="channel-value hue">{hsl_h}° - {getHueName(hsl_h || 0)}</div>
                <div className="channel-bar">
                  <div className="channel-fill hue-fill" style={{ width: `${((hsl_h || 0) / 360) * 100}%` }} />
                </div>
              </div>
              <div className="hsl-channel">
                <div className="channel-label">S (飽和度)</div>
                <div className="channel-value saturation">{hsl_s}%</div>
                <div className="channel-bar">
                  <div className="channel-fill saturation-fill" style={{ width: `${hsl_s}%` }} />
                </div>
              </div>
              <div className="hsl-channel">
                <div className="channel-label">L (亮度)</div>
                <div className="channel-value lightness">{hsl_l}%</div>
                <div className="channel-bar">
                  <div className="channel-fill lightness-fill" style={{ width: `${hsl_l}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 色溫區塊 */}
      <div className="collapsible-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('colortemp')}
        >
          <h4>色溫</h4>
          <span className={`collapse-icon ${expandedSections.colortemp ? 'expanded' : ''}`}>▼</span>
        </div>
        {expandedSections.colortemp && (
          <div className="section-content">
            <div className="colortemp-values">
              <div className="colortemp-info">
                <div className="colortemp-main">
                  <div className="colortemp-label">色溫</div>
                  <div className="colortemp-value">{colorTemp} K</div>
                </div>
                <div className="colortemp-description">{colorTempDesc}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* K-NN 分類結果 */}
      {currentRGB.className && (
        <div className="collapsible-section">
          <div 
            className="section-header"
            onClick={() => toggleSection('classification')}
          >
            <h4>K-NN 分類</h4>
            <span className={`collapse-icon ${expandedSections.classification !== false ? 'expanded' : ''}`}>▼</span>
          </div>
          {expandedSections.classification !== false && (
            <div className="section-content">
              <div className="classification-result">
                <div className="classification-main">
                  <div className="classification-label">類別</div>
                  <div className="classification-value">{currentRGB.className}</div>
                </div>
                {currentRGB.confidence !== undefined && (
                  <div className="confidence-bar-container">
                    <div className="confidence-label">
                      信心度: {(currentRGB.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="confidence-bar">
                      <div 
                        className={`confidence-fill ${
                          currentRGB.confidence >= 0.7 ? 'high-confidence' :
                          currentRGB.confidence >= 0.4 ? 'medium-confidence' :
                          'low-confidence'
                        }`}
                        style={{ width: `${currentRGB.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="copy-actions">
        <button className="copy-button" onClick={() => copyToClipboard(hex, 'HEX')}>📋 HEX</button>
        <button className="copy-button" onClick={() => copyToClipboard(`rgb(${r}, ${g}, ${b})`, 'RGB')}>📋 RGB</button>
        <button className="copy-button" onClick={() => copyToClipboard(formatHSV({ h: hsv_h || 0, s: hsv_s || 0, v: hsv_v || 0 }), 'HSV')}>📋 HSV</button>
        <button className="copy-button" onClick={() => copyToClipboard(formatHSL({ h: hsl_h || 0, s: hsl_s || 0, l: hsl_l || 0 }), 'HSL')}>📋 HSL</button>
      </div>
    </>
  );

  return (
    <div className="rgb-display">
      <h3>🎨 色彩值顯示</h3>
      
      {displayMode === 'rgb' && renderRGBMode()}
      {displayMode === 'hsv' && renderHSVMode()}
      {displayMode === 'hsl' && renderHSLMode()}
      {displayMode === 'colortemp' && renderColorTempMode()}
      {displayMode === 'all' && renderAllMode()}
    </div>
  );
};

export default RGBDisplay;
