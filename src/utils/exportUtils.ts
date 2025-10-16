import * as XLSX from 'xlsx';
import { RGBData } from '../App';

// RGB 轉 HSV 函數
export const rgbToHsv = (r: number, g: number, b: number): { h: number; s: number; v: number } => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff) % 6;
    } else if (max === g) {
      h = (b - r) / diff + 2;
    } else {
      h = (r - g) / diff + 4;
    }
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : Math.round((diff / max) * 100);
  const v = Math.round(max * 100);

  return { h, s, v };
};

// 格式化時間戳記
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  
  return `${year}/${month}/${day} ${hour}:${minute}:${second}.${milliseconds}`;
};

// 匯出 Excel 文件
export const exportToExcel = (data: RGBData[], filename?: string) => {
  // 準備數據
  const worksheetData = data.map((item, index) => {
    const hsv = rgbToHsv(item.r, item.g, item.b);
    return {
      '序號': index + 1,
      '時間戳記': formatTimestamp(item.timestamp),
      'R': item.r,
      'G': item.g,
      'B': item.b,
      'HEX': item.hex.toUpperCase(),
      'H': hsv.h,
      'S': hsv.s,
      'V': hsv.v,
      'X座標': item.x,
      'Y座標': item.y
    };
  });

  // 創建工作簿
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // 設置列寬
  const colWidths = [
    { wch: 8 },  // 序號
    { wch: 20 }, // 時間戳記
    { wch: 6 },  // R
    { wch: 6 },  // G
    { wch: 6 },  // B
    { wch: 10 }, // HEX
    { wch: 6 },  // H
    { wch: 6 },  // S
    { wch: 6 },  // V
    { wch: 8 },  // X座標
    { wch: 8 }   // Y座標
  ];
  worksheet['!cols'] = colWidths;

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(workbook, worksheet, 'RGB數據');

  // 生成文件名
  const defaultFilename = `RGB分析報告_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
  const finalFilename = filename || defaultFilename;

  // 匯出文件
  XLSX.writeFile(workbook, finalFilename);
};

// 匯出圖片（從 Canvas 獲取）
export const exportImages = async (
  canvas: HTMLCanvasElement,
  data: RGBData[],
  filename?: string
): Promise<void> => {
  if (!canvas) {
    throw new Error('Canvas 元素不存在');
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const baseFilename = filename || `RGB記錄_${timestamp}`;

  // 匯出原圖
  const rawImageData = canvas.toDataURL('image/png');
  downloadImage(rawImageData, `${baseFilename}_原圖.png`);

  // 匯出標註圖（包含RGB資訊）
  const annotatedCanvas = await createAnnotatedImage(canvas, data);
  const annotatedImageData = annotatedCanvas.toDataURL('image/png');
  downloadImage(annotatedImageData, `${baseFilename}_標註圖.png`);
};

// 創建標註圖
const createAnnotatedImage = async (originalCanvas: HTMLCanvasElement, data: RGBData[]): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法創建 Canvas 上下文');

  // 設置畫布大小
  canvas.width = originalCanvas.width;
  canvas.height = originalCanvas.height;

  // 複製原圖
  ctx.drawImage(originalCanvas, 0, 0);

  // 添加RGB資訊
  if (data.length > 0) {
    const latestData = data[data.length - 1];
    const hsv = rgbToHsv(latestData.r, latestData.g, latestData.b);

    // 創建資訊卡
    const infoCard = {
      x: 20,
      y: 20,
      width: 200,
      height: 120,
      padding: 10
    };

    // 繪製資訊卡背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(infoCard.x, infoCard.y, infoCard.width, infoCard.height);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(infoCard.x, infoCard.y, infoCard.width, infoCard.height);

    // 繪製色塊
    const colorBlockSize = 30;
    const colorBlockX = infoCard.x + infoCard.padding;
    const colorBlockY = infoCard.y + infoCard.padding;
    
    ctx.fillStyle = latestData.hex;
    ctx.fillRect(colorBlockX, colorBlockY, colorBlockSize, colorBlockSize);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(colorBlockX, colorBlockY, colorBlockSize, colorBlockSize);

    // 添加文字資訊
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    
    const textX = colorBlockX + colorBlockSize + 10;
    let textY = colorBlockY + 15;
    
    ctx.fillText(`HEX: ${latestData.hex.toUpperCase()}`, textX, textY);
    textY += 15;
    ctx.fillText(`RGB: (${latestData.r}, ${latestData.g}, ${latestData.b})`, textX, textY);
    textY += 15;
    ctx.fillText(`HSV: (${hsv.h}°, ${hsv.s}%, ${hsv.v}%)`, textX, textY);
    textY += 15;
    ctx.fillText(`記錄數: ${data.length} 筆`, textX, textY);
    textY += 15;
    ctx.fillText(`時間: ${formatTimestamp(latestData.timestamp)}`, textX, textY);
  }

  return canvas;
};

// 下載圖片
const downloadImage = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
