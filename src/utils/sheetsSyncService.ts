/**
 * Google Sheets 資料同步服務
 * 負責訓練資料載入與檢測結果儲存
 */

import { RGBData } from '../App';
import { TrainingDataPoint, getGlobalClassifier } from './colorClassifier';
import { getSheetData, appendSheetData, getColumnMapping } from './googleSheetsApi';

/**
 * 從 Google Sheets 載入訓練資料到 K-NN 分類器
 */
export async function loadTrainingData(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  success: boolean;
  count: number;
  classes: string[];
  error?: string;
}> {
  try {
    console.log('📥 開始載入訓練資料...');

    // 讀取所有資料
    const data = await getSheetData(accessToken, spreadsheetId, 'A:Z');
    
    if (data.length < 2) {
      return {
        success: false,
        count: 0,
        classes: [],
        error: 'Sheet 中沒有足夠的資料（至少需要標題列 + 1 筆資料）'
      };
    }

    // 第一列是標題
    const headers = data[0];
    
    // 找出必要欄位的索引
    const rIndex = headers.indexOf('R');
    const gIndex = headers.indexOf('G');
    const bIndex = headers.indexOf('B');
    const hIndex = headers.indexOf('H');
    const sIndex = headers.indexOf('S');
    const vIndex = headers.indexOf('V');
    const kIndex = headers.indexOf('K');
    const classIndex = headers.indexOf('ClassName');

    // 驗證必要欄位
    if ([rIndex, gIndex, bIndex, hIndex, sIndex, vIndex, kIndex, classIndex].includes(-1)) {
      return {
        success: false,
        count: 0,
        classes: [],
        error: '缺少必要欄位：R, G, B, H, S, V, K, ClassName'
      };
    }

    // 轉換資料
    const trainingData: TrainingDataPoint[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 跳過空列或不完整的列
      if (!row || row.length === 0) continue;
      
      try {
        const r = parseFloat(row[rIndex]);
        const g = parseFloat(row[gIndex]);
        const b = parseFloat(row[bIndex]);
        const h = parseFloat(row[hIndex]);
        const s = parseFloat(row[sIndex]);
        const v = parseFloat(row[vIndex]);
        const k = parseFloat(row[kIndex]);
        const className = row[classIndex]?.toString().trim();

        // 驗證數值有效性
        if (isNaN(r) || isNaN(g) || isNaN(b) || 
            isNaN(h) || isNaN(s) || isNaN(v) || isNaN(k) ||
            !className) {
          console.warn(`⚠️ 跳過第 ${i + 1} 列：數值無效或缺少類別名稱`);
          continue;
        }

        trainingData.push({
          features: [r, g, b, h, s, v, k],
          className: className
        });
      } catch (error) {
        console.warn(`⚠️ 跳過第 ${i + 1} 列：`, error);
      }
    }

    if (trainingData.length === 0) {
      return {
        success: false,
        count: 0,
        classes: [],
        error: '沒有有效的訓練資料'
      };
    }

    // 訓練分類器
    const classifier = getGlobalClassifier();
    classifier.train(trainingData);

    const classes = classifier.getClasses();

    console.log(`✅ 訓練資料載入完成：${trainingData.length} 筆，${classes.length} 個類別`);

    return {
      success: true,
      count: trainingData.length,
      classes: classes
    };
  } catch (error) {
    console.error('❌ 載入訓練資料失敗:', error);
    return {
      success: false,
      count: 0,
      classes: [],
      error: error instanceof Error ? error.message : '未知錯誤'
    };
  }
}

/**
 * 將檢測結果儲存到 Google Sheets
 */
export async function saveDetectionResult(
  accessToken: string,
  spreadsheetId: string,
  rgbData: RGBData,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('💾 儲存檢測結果到 Google Sheets...');

    // 取得欄位映射
    const columnMapping = await getColumnMapping(accessToken, spreadsheetId);
    
    // 讀取標題列以確定欄位順序
    const data = await getSheetData(accessToken, spreadsheetId, 'A1:Z1');
    const headers = data.length > 0 ? data[0] : [];

    if (headers.length === 0) {
      return {
        success: false,
        error: 'Sheet 標題列為空'
      };
    }

    // 產生 hashID
    const hashID = generateHashID(rgbData);

    // 取得當前時間
    const now = new Date().toISOString();

    // 準備資料列（按照 Sheet 的欄位順序）
    const row: any[] = new Array(headers.length).fill('');

    // 填入資料
    const fieldMap: { [key: string]: any } = {
      'R': rgbData.r,
      'G': rgbData.g,
      'B': rgbData.b,
      'H': rgbData.hsv_h,
      'S': rgbData.hsv_s,
      'V': rgbData.hsv_v,
      'K': rgbData.colorTemp,
      'ClassName': rgbData.className || '',
      'CreateTime': now,
      'UpdateTime': now,
      'CreateUser': userName,
      'UpdateUser': userName,
      'hashID': hashID
    };

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (fieldMap.hasOwnProperty(header)) {
        row[i] = fieldMap[header];
      }
    }

    // 追加資料
    await appendSheetData(
      accessToken,
      spreadsheetId,
      'A:Z',
      [row]
    );

    console.log('✅ 檢測結果已儲存');

    return { success: true };
  } catch (error) {
    console.error('❌ 儲存檢測結果失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    };
  }
}

/**
 * 產生唯一識別碼（hashID）
 * 使用 R,G,B,timestamp 的簡單雜湊
 */
export function generateHashID(rgbData: RGBData): string {
  const str = `${rgbData.r}-${rgbData.g}-${rgbData.b}-${rgbData.timestamp}`;
  
  // 簡單的雜湊函數（FNV-1a）
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  
  // 轉換為 16 進位字串
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * 從 Sheet 資料預覽前 N 筆
 */
export async function previewSheetData(
  accessToken: string,
  spreadsheetId: string,
  limit: number = 10
): Promise<{
  success: boolean;
  headers: string[];
  rows: any[][];
  error?: string;
}> {
  try {
    const data = await getSheetData(accessToken, spreadsheetId, 'A:Z');
    
    if (data.length === 0) {
      return {
        success: false,
        headers: [],
        rows: [],
        error: 'Sheet 為空'
      };
    }

    const headers = data[0];
    const rows = data.slice(1, Math.min(data.length, limit + 1));

    return {
      success: true,
      headers: headers,
      rows: rows
    };
  } catch (error) {
    console.error('❌ 預覽 Sheet 資料失敗:', error);
    return {
      success: false,
      headers: [],
      rows: [],
      error: error instanceof Error ? error.message : '未知錯誤'
    };
  }
}

/**
 * 檢查分類器是否已訓練
 */
export function isClassifierReady(): boolean {
  const classifier = getGlobalClassifier();
  return classifier.isModelTrained();
}

/**
 * 取得分類器統計資訊
 */
export function getClassifierStats(): {
  isTrained: boolean;
  trainingCount: number;
  classes: string[];
} {
  const classifier = getGlobalClassifier();
  
  return {
    isTrained: classifier.isModelTrained(),
    trainingCount: classifier.getTrainingDataCount(),
    classes: classifier.isModelTrained() ? classifier.getClasses() : []
  };
}

