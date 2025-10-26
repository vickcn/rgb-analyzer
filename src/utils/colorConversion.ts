/**
 * 色彩轉換工具模組
 * 提供 RGB、HSV、HSL、色溫之間的轉換功能
 */

export interface HSVColor {
  h: number; // 色相 (0-360°)
  s: number; // 飽和度 (0-100%)
  v: number; // 明度 (0-100%)
}

export interface HSLColor {
  h: number; // 色相 (0-360°)
  s: number; // 飽和度 (0-100%)
  l: number; // 亮度 (0-100%)
}

export interface ColorTempResult {
  kelvin: number;       // 色溫 (Kelvin)
  description: string;  // 色溫描述
  category: string;     // 色溫類別
}

/**
 * RGB 轉 HSV
 * @param r 紅色通道 (0-255)
 * @param g 綠色通道 (0-255)
 * @param b 藍色通道 (0-255)
 * @returns HSV 色彩物件
 */
export function rgbToHSV(r: number, g: number, b: number): HSVColor {
  // 正規化 RGB 值到 0-1 範圍
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  // 計算色相 (Hue)
  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (max === gNorm) {
      h = 60 * ((bNorm - rNorm) / delta + 2);
    } else {
      h = 60 * ((rNorm - gNorm) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  // 計算飽和度 (Saturation)
  const s = max === 0 ? 0 : (delta / max) * 100;

  // 計算明度 (Value)
  const v = max * 100;

  return {
    h: Math.round(h),
    s: Math.round(s * 10) / 10,
    v: Math.round(v * 10) / 10
  };
}

/**
 * RGB 轉 HSL
 * @param r 紅色通道 (0-255)
 * @param g 綠色通道 (0-255)
 * @param b 藍色通道 (0-255)
 * @returns HSL 色彩物件
 */
export function rgbToHSL(r: number, g: number, b: number): HSLColor {
  // 正規化 RGB 值到 0-1 範圍
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  // 計算亮度 (Lightness)
  const l = (max + min) / 2;

  // 計算色相 (Hue)
  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (max === gNorm) {
      h = 60 * ((bNorm - rNorm) / delta + 2);
    } else {
      h = 60 * ((rNorm - gNorm) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  // 計算飽和度 (Saturation)
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(h),
    s: Math.round(s * 100 * 10) / 10,
    l: Math.round(l * 100 * 10) / 10
  };
}

/**
 * RGB 轉 XYZ 色彩空間 (使用 sRGB 標準)
 * @param r 紅色通道 (0-255)
 * @param g 綠色通道 (0-255)
 * @param b 藍色通道 (0-255)
 * @returns XYZ 色彩物件
 */
function rgbToXYZ(r: number, g: number, b: number): { x: number; y: number; z: number } {
  // 正規化並應用 gamma 校正
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  // sRGB gamma 校正
  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  // 轉換為 XYZ (使用 D65 illuminant)
  const x = rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375;
  const y = rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.0721750;
  const z = rNorm * 0.0193339 + gNorm * 0.1191920 + bNorm * 0.9503041;

  return { x, y, z };
}

/**
 * 使用 McCamy's approximation 計算色溫
 * @param r 紅色通道 (0-255)
 * @param g 綠色通道 (0-255)
 * @param b 藍色通道 (0-255)
 * @returns 色溫結果物件
 */
export function rgbToColorTemp(r: number, g: number, b: number): ColorTempResult {
  // 特殊情況：全黑
  if (r === 0 && g === 0 && b === 0) {
    return {
      kelvin: 0,
      description: '無光源',
      category: 'None'
    };
  }

  // 轉換為 XYZ
  const { x, y, z } = rgbToXYZ(r, g, b);

  // 計算色度坐標
  const sum = x + y + z;
  if (sum === 0) {
    return {
      kelvin: 0,
      description: '無效色彩',
      category: 'Invalid'
    };
  }

  const xChroma = x / sum;
  const yChroma = y / sum;

  // McCamy's approximation formula
  // n = (x - 0.3320) / (0.1858 - y)
  // CCT = 449n³ + 3525n² + 6823.3n + 5520.33
  const n = (xChroma - 0.3320) / (0.1858 - yChroma);
  const cct = 449 * Math.pow(n, 3) + 3525 * Math.pow(n, 2) + 6823.3 * n + 5520.33;

  // 限制色溫範圍在合理值內 (1000K - 25000K)
  const kelvin = Math.max(1000, Math.min(25000, Math.round(cct)));

  return {
    kelvin,
    description: getColorTempDescription(kelvin),
    category: getColorTempCategory(kelvin)
  };
}

/**
 * 獲取色溫描述
 */
function getColorTempDescription(kelvin: number): string {
  if (kelvin < 2000) return '極暖光（燭光）';
  if (kelvin < 3000) return '暖光（鎢絲燈）';
  if (kelvin < 3500) return '暖白光';
  if (kelvin < 4500) return '中性白光';
  if (kelvin < 5500) return '自然光';
  if (kelvin < 6500) return '日光';
  if (kelvin < 8000) return '冷白光';
  if (kelvin < 10000) return '冷光（陰天）';
  return '極冷光（藍天）';
}

/**
 * 獲取色溫類別
 */
function getColorTempCategory(kelvin: number): string {
  if (kelvin < 3000) return 'Warm';
  if (kelvin < 5000) return 'Neutral';
  if (kelvin < 6500) return 'Cool';
  return 'Daylight';
}

/**
 * 獲取色相名稱
 */
export function getHueName(hue: number): string {
  if (hue < 0 || hue > 360) return '未知';
  if (hue < 15 || hue >= 345) return '紅色';
  if (hue < 45) return '橙紅色';
  if (hue < 75) return '橙色';
  if (hue < 105) return '黃色';
  if (hue < 135) return '黃綠色';
  if (hue < 165) return '綠色';
  if (hue < 195) return '青綠色';
  if (hue < 225) return '青色';
  if (hue < 255) return '藍色';
  if (hue < 285) return '藍紫色';
  if (hue < 315) return '紫色';
  return '紫紅色';
}

/**
 * 格式化 HSV 字串
 */
export function formatHSV(hsv: HSVColor): string {
  return `hsv(${hsv.h}°, ${hsv.s}%, ${hsv.v}%)`;
}

/**
 * 格式化 HSL 字串
 */
export function formatHSL(hsl: HSLColor): string {
  return `hsl(${hsl.h}°, ${hsl.s}%, ${hsl.l}%)`;
}

/**
 * 格式化色溫字串
 */
export function formatColorTemp(temp: ColorTempResult): string {
  return `${temp.kelvin}K (${temp.description})`;
}


