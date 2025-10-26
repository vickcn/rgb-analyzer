/**
 * Google Sheets API 工具模組
 * 提供與 Google Sheets 互動的核心功能
 */

// 必要欄位定義
export const REQUIRED_COLUMNS = [
  'R', 'G', 'B', 
  'H', 'S', 'V', 
  'K', 
  'ClassName'
];

// 擴展欄位定義
export const EXTENDED_COLUMNS = [
  'CreateTime',
  'UpdateTime',
  'CreateUser',
  'UpdateUser',
  'hashID'
];

// 所有欄位
export const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...EXTENDED_COLUMNS];

/**
 * 欄位映射介面
 */
export interface ColumnMapping {
  [systemName: string]: string; // systemName -> sheetColumnName
}

/**
 * Sheet 資訊介面
 */
export interface SheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheetName: string;
  columnMapping: ColumnMapping;
  rowCount: number;
}

/**
 * 初始化 Google API 客戶端
 */
export async function initGoogleAPI(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 載入 gapi 腳本
    if (typeof window.gapi === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: apiKey,
              discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
            });
            console.log('✅ Google API 初始化完成');
            resolve();
          } catch (error) {
            console.error('❌ Google API 初始化失敗:', error);
            reject(error);
          }
        });
      };
      script.onerror = () => reject(new Error('無法載入 Google API 腳本'));
      document.head.appendChild(script);
    } else {
      // 已載入，直接初始化
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            apiKey: apiKey,
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
          });
          console.log('✅ Google API 初始化完成');
          resolve();
        } catch (error) {
          console.error('❌ Google API 初始化失敗:', error);
          reject(error);
        }
      });
    }
  });
}

/**
 * 建立新的 Spreadsheet
 */
export async function createNewSheet(
  accessToken: string,
  title: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  try {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: title
        },
        sheets: [{
          properties: {
            title: '色票資料'
          }
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`建立 Sheet 失敗: ${response.statusText}`);
    }

    const data = await response.json();
    
    // 自動新增必要欄位
    await addMissingColumns(accessToken, data.spreadsheetId, ALL_COLUMNS);

    return {
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl
    };
  } catch (error) {
    console.error('❌ 建立 Sheet 失敗:', error);
    throw error;
  }
}

/**
 * 讀取 Sheet 資料
 */
export async function getSheetData(
  accessToken: string,
  spreadsheetId: string,
  range: string = 'A:Z'
): Promise<any[][]> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`讀取 Sheet 失敗: ${response.statusText}`);
    }

    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error('❌ 讀取 Sheet 失敗:', error);
    throw error;
  }
}

/**
 * 新增資料到 Sheet（追加到最後）
 */
export async function appendSheetData(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: values
        })
      }
    );

    if (!response.ok) {
      throw new Error(`新增資料失敗: ${response.statusText}`);
    }

    console.log('✅ 資料已新增到 Sheet');
  } catch (error) {
    console.error('❌ 新增資料失敗:', error);
    throw error;
  }
}

/**
 * 更新 Sheet 資料
 */
export async function updateSheetData(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: values
        })
      }
    );

    if (!response.ok) {
      throw new Error(`更新資料失敗: ${response.statusText}`);
    }

    console.log('✅ Sheet 資料已更新');
  } catch (error) {
    console.error('❌ 更新資料失敗:', error);
    throw error;
  }
}

/**
 * 驗證 Sheet 欄位
 */
export async function validateSheetColumns(
  accessToken: string,
  spreadsheetId: string
): Promise<{ 
  hasAllRequired: boolean; 
  missingColumns: string[];
  existingColumns: string[];
}> {
  try {
    const data = await getSheetData(accessToken, spreadsheetId, 'A1:Z1');
    const existingColumns = data.length > 0 ? data[0] : [];

    const missingColumns = REQUIRED_COLUMNS.filter(
      col => !existingColumns.includes(col)
    );

    return {
      hasAllRequired: missingColumns.length === 0,
      missingColumns: missingColumns,
      existingColumns: existingColumns
    };
  } catch (error) {
    console.error('❌ 驗證欄位失敗:', error);
    throw error;
  }
}

/**
 * 補充缺失欄位（新增到第一列）
 */
export async function addMissingColumns(
  accessToken: string,
  spreadsheetId: string,
  columns: string[]
): Promise<void> {
  try {
    // 讀取現有欄位
    const data = await getSheetData(accessToken, spreadsheetId, 'A1:Z1');
    const existingColumns = data.length > 0 ? data[0] : [];

    // 找出缺失的欄位
    const missingColumns = columns.filter(
      col => !existingColumns.includes(col)
    );

    if (missingColumns.length === 0) {
      console.log('✅ 所有必要欄位已存在');
      return;
    }

    // 合併現有與新欄位
    const newHeader = [...existingColumns, ...missingColumns];

    // 更新第一列
    await updateSheetData(
      accessToken,
      spreadsheetId,
      `A1:${String.fromCharCode(65 + newHeader.length - 1)}1`,
      [newHeader]
    );

    console.log(`✅ 已新增缺失欄位: ${missingColumns.join(', ')}`);
  } catch (error) {
    console.error('❌ 新增欄位失敗:', error);
    throw error;
  }
}

/**
 * 取得欄位映射關係
 */
export async function getColumnMapping(
  accessToken: string,
  spreadsheetId: string
): Promise<ColumnMapping> {
  try {
    const data = await getSheetData(accessToken, spreadsheetId, 'A1:Z1');
    const columns = data.length > 0 ? data[0] : [];

    const mapping: ColumnMapping = {};
    
    // 建立映射（假設系統欄位名稱與 Sheet 欄位名稱相同）
    for (const col of REQUIRED_COLUMNS) {
      if (columns.includes(col)) {
        mapping[col] = col;
      }
    }

    return mapping;
  } catch (error) {
    console.error('❌ 取得欄位映射失敗:', error);
    throw error;
  }
}

/**
 * 取得 Sheet 資訊
 */
export async function getSheetInfo(
  accessToken: string,
  spreadsheetId: string
): Promise<SheetInfo> {
  try {
    // 取得 Spreadsheet metadata
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`取得 Sheet 資訊失敗: ${response.statusText}`);
    }

    const metadata = await response.json();
    const data = await getSheetData(accessToken, spreadsheetId);
    const columnMapping = await getColumnMapping(accessToken, spreadsheetId);

    return {
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: metadata.spreadsheetUrl,
      title: metadata.properties.title,
      sheetName: metadata.sheets[0].properties.title,
      columnMapping: columnMapping,
      rowCount: data.length
    };
  } catch (error) {
    console.error('❌ 取得 Sheet 資訊失敗:', error);
    throw error;
  }
}

/**
 * 從 Spreadsheet URL 提取 ID
 */
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// TypeScript 全域型別擴展
declare global {
  interface Window {
    gapi: any;
  }
}

