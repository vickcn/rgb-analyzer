/**
 * Google Sheets 管理介面
 * 提供 Sheet 綁定、建立、欄位映射等功能
 */

import React, { useState, useEffect } from 'react';
import { UserInfo } from '../App';
import { 
  createNewSheet, 
  getSheetInfo, 
  validateSheetColumns, 
  addMissingColumns,
  extractSpreadsheetId,
  REQUIRED_COLUMNS,
  EXTENDED_COLUMNS,
  SheetInfo
} from '../utils/googleSheetsApi';
import { 
  loadTrainingData, 
  previewSheetData, 
  getClassifierStats 
} from '../utils/sheetsSyncService';
import './SheetsManager.css';

interface SheetsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  userInfo: UserInfo;
  currentSpreadsheetId: string | null;
  onSpreadsheetChange: (spreadsheetId: string, sheetInfo: SheetInfo) => void;
}

type TabType = 'bind' | 'create' | 'preview' | 'classifier';

const SheetsManager: React.FC<SheetsManagerProps> = ({
  isOpen,
  onClose,
  userInfo,
  currentSpreadsheetId,
  onSpreadsheetChange
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('bind');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 綁定現有 Sheet 狀態
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [sheetInfo, setSheetInfo] = useState<SheetInfo | null>(null);

  // 建立新 Sheet 狀態
  const [newSheetTitle, setNewSheetTitle] = useState('RGB 色票資料庫');

  // 預覽資料狀態
  const [previewData, setPreviewData] = useState<{
    headers: string[];
    rows: any[][];
  } | null>(null);

  // 分類器狀態
  const [classifierStats, setClassifierStats] = useState<{
    isTrained: boolean;
    trainingCount: number;
    classes: string[];
  }>({ isTrained: false, trainingCount: 0, classes: [] });

  useEffect(() => {
    if (isOpen) {
      // 重置狀態
      setError(null);
      setSuccess(null);
      
      // 更新分類器狀態
      setClassifierStats(getClassifierStats());

      // 如果有當前 Sheet，載入資訊
      if (currentSpreadsheetId) {
        loadCurrentSheetInfo();
      }
    }
  }, [isOpen, currentSpreadsheetId]);

  /**
   * 載入當前 Sheet 資訊
   */
  const loadCurrentSheetInfo = async () => {
    if (!currentSpreadsheetId) return;

    try {
      setLoading(true);
      const info = await getSheetInfo(userInfo.accessToken, currentSpreadsheetId);
      setSheetInfo(info);
      setActiveTab('preview');
    } catch (err) {
      console.error('載入 Sheet 資訊失敗:', err);
      setError('無法載入當前 Sheet 資訊');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 綁定現有 Sheet
   */
  const handleBindExistingSheet = async () => {
    if (!spreadsheetUrl.trim()) {
      setError('請輸入 Google Sheets URL');
      return;
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      setError('無效的 Google Sheets URL');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 驗證 Sheet 存在並取得資訊
      const info = await getSheetInfo(userInfo.accessToken, spreadsheetId);
      
      // 驗證欄位
      const validation = await validateSheetColumns(userInfo.accessToken, spreadsheetId);
      
      if (!validation.hasAllRequired) {
        // 自動補充缺失欄位
        await addMissingColumns(userInfo.accessToken, spreadsheetId, [...REQUIRED_COLUMNS, ...EXTENDED_COLUMNS]);
        setSuccess(`已自動新增缺失欄位: ${validation.missingColumns.join(', ')}`);
      }

      // 更新 Sheet 資訊
      const updatedInfo = await getSheetInfo(userInfo.accessToken, spreadsheetId);
      setSheetInfo(updatedInfo);
      onSpreadsheetChange(spreadsheetId, updatedInfo);
      
      setSuccess('Sheet 綁定成功！');
      setActiveTab('preview');

    } catch (err) {
      console.error('綁定 Sheet 失敗:', err);
      setError(err instanceof Error ? err.message : '綁定失敗');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 建立新 Sheet
   */
  const handleCreateNewSheet = async () => {
    if (!newSheetTitle.trim()) {
      setError('請輸入 Sheet 名稱');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await createNewSheet(userInfo.accessToken, newSheetTitle);
      const info = await getSheetInfo(userInfo.accessToken, result.spreadsheetId);
      
      setSheetInfo(info);
      onSpreadsheetChange(result.spreadsheetId, info);
      
      setSuccess(`新 Sheet 建立成功！ID: ${result.spreadsheetId}`);
      setActiveTab('preview');

    } catch (err) {
      console.error('建立 Sheet 失敗:', err);
      setError(err instanceof Error ? err.message : '建立失敗');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 載入預覽資料
   */
  const handleLoadPreview = async () => {
    if (!currentSpreadsheetId) return;

    try {
      setLoading(true);
      const result = await previewSheetData(userInfo.accessToken, currentSpreadsheetId, 10);
      
      if (result.success) {
        setPreviewData({
          headers: result.headers,
          rows: result.rows
        });
      } else {
        setError(result.error || '載入預覽失敗');
      }
    } catch (err) {
      console.error('載入預覽失敗:', err);
      setError('載入預覽失敗');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 載入訓練資料到分類器
   */
  const handleLoadTrainingData = async () => {
    if (!currentSpreadsheetId) return;

    try {
      setLoading(true);
      setError(null);

      const result = await loadTrainingData(userInfo.accessToken, currentSpreadsheetId);
      
      if (result.success) {
        setSuccess(`訓練資料載入成功！${result.count} 筆資料，${result.classes.length} 個類別`);
        setClassifierStats(getClassifierStats());
      } else {
        setError(result.error || '載入訓練資料失敗');
      }
    } catch (err) {
      console.error('載入訓練資料失敗:', err);
      setError('載入訓練資料失敗');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 清除訊息
   */
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  if (!isOpen) return null;

  return (
    <div className="sheets-manager-overlay">
      <div className="sheets-manager-modal">
        <div className="sheets-manager-header">
          <h2>🗂️ 色票資料庫管理</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        {/* 用戶資訊 */}
        <div className="user-info-bar">
          <img src={userInfo.picture} alt={userInfo.name} className="user-avatar-small" />
          <span>{userInfo.name} ({userInfo.email})</span>
        </div>

        {/* 標籤頁 */}
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'bind' ? 'active' : ''}`}
            onClick={() => setActiveTab('bind')}
          >
            綁定現有 Sheet
          </button>
          <button 
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            建立新 Sheet
          </button>
          <button 
            className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
            disabled={!currentSpreadsheetId}
          >
            資料預覽
          </button>
          <button 
            className={`tab ${activeTab === 'classifier' ? 'active' : ''}`}
            onClick={() => setActiveTab('classifier')}
          >
            分類器狀態
          </button>
        </div>

        {/* 訊息顯示 */}
        {error && (
          <div className="message error">
            <span>❌ {error}</span>
            <button onClick={clearMessages}>✕</button>
          </div>
        )}
        
        {success && (
          <div className="message success">
            <span>✅ {success}</span>
            <button onClick={clearMessages}>✕</button>
          </div>
        )}

        {/* 標籤頁內容 */}
        <div className="tab-content">
          {activeTab === 'bind' && (
            <div className="bind-sheet-panel">
              <h3>綁定現有 Google Sheets</h3>
              <p>請貼上 Google Sheets 的 URL：</p>
              
              <div className="input-group">
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={spreadsheetUrl}
                  onChange={(e) => setSpreadsheetUrl(e.target.value)}
                  disabled={loading}
                />
                <button 
                  onClick={handleBindExistingSheet}
                  disabled={loading || !spreadsheetUrl.trim()}
                >
                  {loading ? '綁定中...' : '綁定'}
                </button>
              </div>

              <div className="help-text">
                <p><strong>注意事項：</strong></p>
                <ul>
                  <li>請確保您有該 Sheet 的編輯權限</li>
                  <li>系統會自動檢查並補充必要欄位</li>
                  <li>必要欄位：{REQUIRED_COLUMNS.join(', ')}</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="create-sheet-panel">
              <h3>建立新的 Google Sheets</h3>
              <p>系統將自動建立包含所有必要欄位的新 Sheet：</p>

              <div className="input-group">
                <label>Sheet 名稱：</label>
                <input
                  type="text"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  disabled={loading}
                />
                <button 
                  onClick={handleCreateNewSheet}
                  disabled={loading || !newSheetTitle.trim()}
                >
                  {loading ? '建立中...' : '建立'}
                </button>
              </div>

              <div className="columns-preview">
                <h4>將包含的欄位：</h4>
                <div className="columns-list">
                  <div className="column-group">
                    <strong>必要欄位：</strong>
                    {REQUIRED_COLUMNS.map(col => (
                      <span key={col} className="column-tag required">{col}</span>
                    ))}
                  </div>
                  <div className="column-group">
                    <strong>擴展欄位：</strong>
                    {EXTENDED_COLUMNS.map(col => (
                      <span key={col} className="column-tag extended">{col}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="preview-panel">
              <h3>資料預覽</h3>
              
              {sheetInfo && (
                <div className="sheet-info">
                  <h4>📊 Sheet 資訊</h4>
                  <div className="info-grid">
                    <div><strong>名稱：</strong>{sheetInfo.title}</div>
                    <div><strong>工作表：</strong>{sheetInfo.sheetName}</div>
                    <div><strong>資料筆數：</strong>{sheetInfo.rowCount}</div>
                    <div><strong>ID：</strong><code>{sheetInfo.spreadsheetId}</code></div>
                  </div>
                  <a href={sheetInfo.spreadsheetUrl} target="_blank" rel="noopener noreferrer">
                    🔗 在 Google Sheets 中開啟
                  </a>
                </div>
              )}

              <div className="preview-actions">
                <button onClick={handleLoadPreview} disabled={loading}>
                  {loading ? '載入中...' : '🔄 重新載入預覽'}
                </button>
                <button onClick={handleLoadTrainingData} disabled={loading}>
                  {loading ? '載入中...' : '📥 載入訓練資料'}
                </button>
              </div>

              {previewData && (
                <div className="data-preview">
                  <h4>前 10 筆資料：</h4>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          {previewData.headers.map((header, index) => (
                            <th key={index}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {previewData.headers.map((_, colIndex) => (
                              <td key={colIndex}>{row[colIndex] || ''}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'classifier' && (
            <div className="classifier-panel">
              <h3>K-NN 分類器狀態</h3>
              
              <div className="classifier-stats">
                <div className="stat-card">
                  <div className="stat-icon">
                    {classifierStats.isTrained ? '✅' : '❌'}
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">訓練狀態</div>
                    <div className="stat-value">
                      {classifierStats.isTrained ? '已訓練' : '未訓練'}
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-label">訓練資料數量</div>
                    <div className="stat-value">{classifierStats.trainingCount} 筆</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">🏷️</div>
                  <div className="stat-content">
                    <div className="stat-label">類別數量</div>
                    <div className="stat-value">{classifierStats.classes.length} 個</div>
                  </div>
                </div>
              </div>

              {classifierStats.classes.length > 0 && (
                <div className="classes-list">
                  <h4>已訓練的類別：</h4>
                  <div className="classes-tags">
                    {classifierStats.classes.map((className, index) => (
                      <span key={index} className="class-tag">{className}</span>
                    ))}
                  </div>
                </div>
              )}

              {!classifierStats.isTrained && (
                <div className="training-help">
                  <h4>如何開始使用分類器：</h4>
                  <ol>
                    <li>綁定或建立包含訓練資料的 Google Sheets</li>
                    <li>確保 Sheet 包含必要欄位：R, G, B, H, S, V, K, ClassName</li>
                    <li>在「資料預覽」標籤中點擊「載入訓練資料」</li>
                    <li>分類器將自動開始對新的檢測結果進行分類</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 載入指示器 */}
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner">⏳</div>
            <div>處理中...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SheetsManager;
