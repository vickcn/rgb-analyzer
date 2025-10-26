import * as XLSX from 'xlsx';
import { RGBData, ColorDisplayMode } from '../App';
import { rgbToHSV, rgbToHSL, rgbToColorTemp } from './colorConversion';

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
    // 使用新的色度數據，如果不存在則回退到舊的計算方式
    const hsv = item.hsv_h !== undefined ? 
      { h: item.hsv_h, s: item.hsv_s, v: item.hsv_v } : 
      rgbToHsv(item.r, item.g, item.b);
    
    return {
      '序號': index + 1,
      '時間戳記': formatTimestamp(item.timestamp),
      // RGB 數據
      'R': item.r,
      'G': item.g,
      'B': item.b,
      'HEX': item.hex.toUpperCase(),
      // HSV 數據
      'HSV_H (色相)': item.hsv_h ?? hsv.h,
      'HSV_S (飽和度)': item.hsv_s ?? hsv.s,
      'HSV_V (明度)': item.hsv_v ?? hsv.v,
      // HSL 數據
      'HSL_H (色相)': item.hsl_h ?? '',
      'HSL_S (飽和度)': item.hsl_s ?? '',
      'HSL_L (亮度)': item.hsl_l ?? '',
      // 色溫數據
      '色溫 (K)': item.colorTemp ?? '',
      '色溫描述': item.colorTempDesc ?? '',
      '色溫類別': item.colorTempCategory ?? '',
      // 座標
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
    { wch: 12 }, // HSV_H
    { wch: 12 }, // HSV_S
    { wch: 12 }, // HSV_V
    { wch: 12 }, // HSL_H
    { wch: 12 }, // HSL_S
    { wch: 12 }, // HSL_L
    { wch: 10 }, // 色溫
    { wch: 15 }, // 色溫描述
    { wch: 10 }, // 色溫類別
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
  filename?: string,
  colorDisplayMode: ColorDisplayMode = 'rgb'
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
  const annotatedCanvas = await createAnnotatedImage(canvas, data, colorDisplayMode);
  const annotatedImageData = annotatedCanvas.toDataURL('image/png');
  downloadImage(annotatedImageData, `${baseFilename}_標註圖.png`);
};

// 根據色度模式格式化標註資訊
const formatAnnotationInfo = (rgbData: RGBData, mode: ColorDisplayMode): string[] => {
  const lines: string[] = [];
  
  switch (mode) {
    case 'rgb':
      lines.push(`HEX: ${rgbData.hex.toUpperCase()}`);
      lines.push(`RGB: (${rgbData.r}, ${rgbData.g}, ${rgbData.b})`);
      break;
      
    case 'hsv':
      const hsv = rgbData.hsv_h !== undefined ? 
        { h: rgbData.hsv_h, s: rgbData.hsv_s!, v: rgbData.hsv_v! } : 
        rgbToHSV(rgbData.r, rgbData.g, rgbData.b);
      lines.push(`HSV: (${hsv.h}°, ${hsv.s}%, ${hsv.v}%)`);
      lines.push(`色相: ${hsv.h}°`);
      lines.push(`飽和度: ${hsv.s}%`);
      lines.push(`明度: ${hsv.v}%`);
      break;
      
    case 'hsl':
      const hsl = rgbData.hsl_h !== undefined ? 
        { h: rgbData.hsl_h, s: rgbData.hsl_s!, l: rgbData.hsl_l! } : 
        rgbToHSL(rgbData.r, rgbData.g, rgbData.b);
      lines.push(`HSL: (${hsl.h}°, ${hsl.s}%, ${hsl.l}%)`);
      lines.push(`色相: ${hsl.h}°`);
      lines.push(`飽和度: ${hsl.s}%`);
      lines.push(`亮度: ${hsl.l}%`);
      break;
      
    case 'colortemp':
      const colorTemp = rgbData.colorTemp !== undefined ? 
        { kelvin: rgbData.colorTemp, description: rgbData.colorTempDesc!, category: rgbData.colorTempCategory! } : 
        rgbToColorTemp(rgbData.r, rgbData.g, rgbData.b);
      lines.push(`色溫: ${colorTemp.kelvin}K`);
      lines.push(`${colorTemp.description}`);
      lines.push(`類別: ${colorTemp.category}`);
      break;
      
    case 'all':
      lines.push(`HEX: ${rgbData.hex.toUpperCase()}`);
      lines.push(`RGB: (${rgbData.r}, ${rgbData.g}, ${rgbData.b})`);
      
      const hsvAll = rgbData.hsv_h !== undefined ? 
        { h: rgbData.hsv_h, s: rgbData.hsv_s!, v: rgbData.hsv_v! } : 
        rgbToHSV(rgbData.r, rgbData.g, rgbData.b);
      lines.push(`HSV: (${hsvAll.h}°, ${hsvAll.s}%, ${hsvAll.v}%)`);
      
      if (rgbData.hsl_h !== undefined) {
        lines.push(`HSL: (${rgbData.hsl_h}°, ${rgbData.hsl_s}%, ${rgbData.hsl_l}%)`);
      }
      
      if (rgbData.colorTemp) {
        lines.push(`色溫: ${rgbData.colorTemp}K`);
        lines.push(`${rgbData.colorTempDesc}`);
      }
      break;
  }
  
  return lines;
};

// 創建標註圖
const createAnnotatedImage = async (originalCanvas: HTMLCanvasElement, data: RGBData[], colorDisplayMode: ColorDisplayMode = 'rgb'): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法創建 Canvas 上下文');

  // 設置畫布大小
  canvas.width = originalCanvas.width;
  canvas.height = originalCanvas.height;

  // 複製原圖
  ctx.drawImage(originalCanvas, 0, 0);

  // 添加色彩資訊
  if (data.length > 0) {
    const latestData = data[data.length - 1];
    const hsv = latestData.hsv_h !== undefined ? 
      { h: latestData.hsv_h, s: latestData.hsv_s, v: latestData.hsv_v } : 
      rgbToHsv(latestData.r, latestData.g, latestData.b);

    // 創建資訊卡
    const infoCard = {
      x: 20,
      y: 20,
      width: 220,
      height: 160,
      padding: 10
    };

    // 繪製資訊卡背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(infoCard.x, infoCard.y, infoCard.width, infoCard.height);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(infoCard.x, infoCard.y, infoCard.width, infoCard.height);

    // 繪製色塊
    const colorBlockSize = 40;
    const colorBlockX = infoCard.x + infoCard.padding;
    const colorBlockY = infoCard.y + infoCard.padding;
    
    ctx.fillStyle = latestData.hex;
    ctx.fillRect(colorBlockX, colorBlockY, colorBlockSize, colorBlockSize);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(colorBlockX, colorBlockY, colorBlockSize, colorBlockSize);

    // 添加文字資訊
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    
    const textX = colorBlockX + colorBlockSize + 10;
    let textY = colorBlockY + 12;
    
    // 使用格式化函數獲取要顯示的資訊
    const infoLines = formatAnnotationInfo(latestData, colorDisplayMode);
    
    // 繪製每一行資訊
    infoLines.forEach((line, index) => {
      if (index === 0) {
        ctx.font = 'bold 11px Arial';
      } else {
        ctx.font = '10px Arial';
      }
      ctx.fillText(line, textX, textY);
      textY += 14;
    });
    
    // 底部資訊
    textY = infoCard.y + infoCard.height - 25;
    ctx.fillText(`記錄數: ${data.length} 筆`, colorBlockX, textY);
    textY += 14;
    ctx.font = '9px Arial';
    ctx.fillText(`${formatTimestamp(latestData.timestamp)}`, colorBlockX, textY);
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
