import React, { useRef, useEffect, useState } from 'react';
import { RGBData, ColorDisplayMode } from '../App';
import { rgbToHSV, rgbToHSL, rgbToColorTemp } from '../utils/colorConversion';
import './RGB3DVisualization.css';

interface RGB3DVisualizationProps {
  data: RGBData[];
  isVisible: boolean;
  colorDisplayMode?: ColorDisplayMode;
}

const RGB3DVisualization: React.FC<RGB3DVisualizationProps> = ({ data, isVisible, colorDisplayMode = 'rgb' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(0.25);
  const [rotationX, setRotationX] = useState(Math.PI / 4);
  const [rotationY, setRotationY] = useState(Math.PI / 6);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isTouching, setIsTouching] = useState(false);
  const [lastTouchPos, setLastTouchPos] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);

  // 滑鼠事件處理
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    
    setRotationY((prev: number) => prev + deltaX * 0.01);
    setRotationX((prev: number) => prev + deltaY * 0.01);
    
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 觸控事件處理
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;
    
    if (touches.length === 1) {
      // 單指觸控 - 旋轉
      setIsTouching(true);
      setLastTouchPos({ x: touches[0].clientX, y: touches[0].clientY });
    } else if (touches.length === 2) {
      // 雙指觸控 - 縮放
      setIsTouching(true);
      setLastTouchDistance(getTouchDistance(touches));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;
    
    if (touches.length === 1 && isTouching) {
      // 單指拖拽 - 旋轉
      const deltaX = touches[0].clientX - lastTouchPos.x;
      const deltaY = touches[0].clientY - lastTouchPos.y;
      
      setRotationY(prev => prev + deltaX * 0.01);
      setRotationX(prev => Math.max(-Math.PI/2, Math.min(Math.PI/2, prev - deltaY * 0.01)));
      
      setLastTouchPos({ x: touches[0].clientX, y: touches[0].clientY });
    } else if (touches.length === 2 && isTouching) {
      // 雙指縮放
      const currentDistance = getTouchDistance(touches);
      if (lastTouchDistance > 0) {
        const scaleChange = currentDistance / lastTouchDistance;
        setScale(prev => Math.max(0.1, Math.min(2.0, prev * scaleChange)));
      }
      setLastTouchDistance(currentDistance);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsTouching(false);
    setLastTouchDistance(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev: number) => Math.max(0.1, Math.min(2.0, prev * delta)));
  };

  // 根據色度模式轉換座標
  const getCoordinates = (rgbData: RGBData) => {
    switch (colorDisplayMode) {
      case 'rgb':
        return { x: rgbData.r, y: rgbData.g, z: rgbData.b };
        
      case 'hsv':
        const hsv = rgbData.hsv_h !== undefined ? 
          { h: rgbData.hsv_h, s: rgbData.hsv_s!, v: rgbData.hsv_v! } : 
          rgbToHSV(rgbData.r, rgbData.g, rgbData.b);
        return { 
          x: hsv.h * 255 / 360,  // 色相 0-360° 映射到 0-255
          y: hsv.s * 255 / 100,  // 飽和度 0-100% 映射到 0-255
          z: hsv.v * 255 / 100   // 明度 0-100% 映射到 0-255
        };
        
      case 'hsl':
        const hsl = rgbData.hsl_h !== undefined ? 
          { h: rgbData.hsl_h, s: rgbData.hsl_s!, l: rgbData.hsl_l! } : 
          rgbToHSL(rgbData.r, rgbData.g, rgbData.b);
        return { 
          x: hsl.h * 255 / 360,  // 色相 0-360° 映射到 0-255
          y: hsl.s * 255 / 100,  // 飽和度 0-100% 映射到 0-255
          z: hsl.l * 255 / 100   // 亮度 0-100% 映射到 0-255
        };
        
      case 'colortemp':
        const colorTemp = rgbData.colorTemp !== undefined ? 
          rgbData.colorTemp : 
          rgbToColorTemp(rgbData.r, rgbData.g, rgbData.b).kelvin;
        // 色溫模式：X=色溫(1000-10000K映射到0-255), Y=飽和度, Z=明度
        const hsvForTemp = rgbData.hsv_h !== undefined ? 
          { h: rgbData.hsv_h, s: rgbData.hsv_s!, v: rgbData.hsv_v! } : 
          rgbToHSV(rgbData.r, rgbData.g, rgbData.b);
        return {
          x: Math.min(255, Math.max(0, (colorTemp - 1000) * 255 / 9000)), // 1000-10000K 映射到 0-255
          y: hsvForTemp.s * 255 / 100,
          z: hsvForTemp.v * 255 / 100
        };
        
      default:
        return { x: rgbData.r, y: rgbData.g, z: rgbData.b };
    }
  };

  // 獲取軸標籤
  const getAxisLabels = () => {
    switch (colorDisplayMode) {
      case 'rgb':
        return { x: 'R', y: 'G', z: 'B' };
      case 'hsv':
        return { x: 'H (色相)', y: 'S (飽和度)', z: 'V (明度)' };
      case 'hsl':
        return { x: 'H (色相)', y: 'S (飽和度)', z: 'L (亮度)' };
      case 'colortemp':
        return { x: 'T (色溫)', y: 'S (飽和度)', z: 'V (明度)' };
      default:
        return { x: 'X', y: 'Y', z: 'Z' };
    }
  };

  // 獲取軸顏色
  const getAxisColors = () => {
    switch (colorDisplayMode) {
      case 'rgb':
        return { x: '#ff0000', y: '#00ff00', z: '#0000ff' };
      case 'hsv':
      case 'hsl':
        return { x: '#ff6b6b', y: '#4ecdc4', z: '#45b7d1' };
      case 'colortemp':
        return { x: '#ff9500', y: '#4ecdc4', z: '#45b7d1' }; // 橙色代表色溫
      default:
        return { x: '#666', y: '#666', z: '#666' };
    }
  };

  useEffect(() => {
    if (!isVisible || data.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('❌ Canvas 元素不存在');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('❌ 無法獲取 Canvas 2D 上下文');
      return;
    }
    
    console.log('✅ 開始繪製3D RGB視覺化，數據筆數:', data.length);

    // 設置畫布大小
    const size = Math.min(canvas.offsetWidth, canvas.offsetHeight);
    canvas.width = size;
    canvas.height = size;

    // 清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 設置3D投影參數
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const actualScale = (size * scale) / 255; // 縮放到RGB範圍 (0-255)
    const rotationZ = Math.PI / 12; // Z軸旋轉角度 (15度)

    // 3D到2D投影函數
    const project3D = (x: number, y: number, z: number) => {
      // 應用旋轉
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const cosZ = Math.cos(rotationZ);
      const sinZ = Math.sin(rotationZ);

      // 繞X軸旋轉
      const y1 = y * cosX - z * sinX;
      const z1 = y * sinX + z * cosX;

      // 繞Y軸旋轉
      const x2 = x * cosY + z1 * sinY;

      // 繞Z軸旋轉
      const x3 = x2 * cosZ - y1 * sinZ;
      const y3 = x2 * sinZ + y1 * cosZ;

      // 投影到2D
      return {
        x: centerX + x3 * actualScale,
        y: centerY - y3 * actualScale
      };
    };

    // 繪製座標軸
    const drawAxes = () => {
      const axisLabels = getAxisLabels();
      const axisColors = getAxisColors();
      ctx.lineWidth = 2;

      // X軸
      const xEnd = project3D(255, 0, 0);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(xEnd.x, xEnd.y);
      ctx.strokeStyle = axisColors.x;
      ctx.stroke();

      // Y軸
      const yEnd = project3D(0, 255, 0);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(yEnd.x, yEnd.y);
      ctx.strokeStyle = axisColors.y;
      ctx.stroke();

      // Z軸
      const zEnd = project3D(0, 0, 255);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(zEnd.x, zEnd.y);
      ctx.strokeStyle = axisColors.z;
      ctx.stroke();

      // 添加軸標籤
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(axisLabels.x, xEnd.x + 15, xEnd.y - 5);
      ctx.fillText(axisLabels.y, yEnd.x - 15, yEnd.y - 5);
      ctx.fillText(axisLabels.z, zEnd.x, zEnd.y + 25);
    };

    // 繪製RGB立方體框架
    const drawCube = () => {
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;

      // 立方體的8個頂點
      const vertices = [
        [0, 0, 0], [255, 0, 0], [255, 255, 0], [0, 255, 0], // 底面
        [0, 0, 255], [255, 0, 255], [255, 255, 255], [0, 255, 255]  // 頂面
      ];

      const projectedVertices = vertices.map(v => project3D(v[0], v[1], v[2]));

      // 繪製底面的邊 (較暗)
      ctx.strokeStyle = '#999';
      const bottomEdges = [[0, 1], [1, 2], [2, 3], [3, 0]];
      bottomEdges.forEach(([i, j]) => {
        ctx.beginPath();
        ctx.moveTo(projectedVertices[i].x, projectedVertices[i].y);
        ctx.lineTo(projectedVertices[j].x, projectedVertices[j].y);
        ctx.stroke();
      });

      // 繪製頂面的邊 (較亮)
      ctx.strokeStyle = '#ccc';
      const topEdges = [[4, 5], [5, 6], [6, 7], [7, 4]];
      topEdges.forEach(([i, j]) => {
        ctx.beginPath();
        ctx.moveTo(projectedVertices[i].x, projectedVertices[i].y);
        ctx.lineTo(projectedVertices[j].x, projectedVertices[j].y);
        ctx.stroke();
      });

      // 繪製垂直邊
      ctx.strokeStyle = '#bbb';
      const verticalEdges = [[0, 4], [1, 5], [2, 6], [3, 7]];
      verticalEdges.forEach(([i, j]) => {
        ctx.beginPath();
        ctx.moveTo(projectedVertices[i].x, projectedVertices[i].y);
        ctx.lineTo(projectedVertices[j].x, projectedVertices[j].y);
        ctx.stroke();
      });

      ctx.globalAlpha = 1.0;
    };

    // 智能資訊卡位置計算
    const calculateInfoCardPositions = () => {
      const infoCards: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        type: 'avg' | 'point';
        index?: number;
      }> = [];

      // 計算平均值點
      // 計算平均值（使用轉換後的座標）
      const avgCoords = data.map(item => getCoordinates(item));
      const avgX = avgCoords.reduce((sum, coord) => sum + coord.x, 0) / avgCoords.length;
      const avgY = avgCoords.reduce((sum, coord) => sum + coord.y, 0) / avgCoords.length;
      const avgZ = avgCoords.reduce((sum, coord) => sum + coord.z, 0) / avgCoords.length;
      const avgProjected = project3D(avgX, avgY, avgZ);
      
      // 原始RGB平均值（用於顯示）
      const avgR = data.reduce((sum, item) => sum + item.r, 0) / data.length;
      const avgG = data.reduce((sum, item) => sum + item.g, 0) / data.length;
      const avgB = data.reduce((sum, item) => sum + item.b, 0) / data.length;

      // 計算平均值資訊卡尺寸
      ctx.font = 'bold 10px Arial';
      const avgText = `平均值: RGB(${Math.round(avgR)},${Math.round(avgG)},${Math.round(avgB)})`;
      const avgTextWidth = ctx.measureText(avgText).width;
      const avgBoxWidth = avgTextWidth + 12;
      const avgBoxHeight = 16;

      // 為平均值資訊卡尋找最佳位置
      const avgPositions = [
        { x: avgProjected.x - avgBoxWidth / 2, y: avgProjected.y - 30 }, // 上方
        { x: avgProjected.x - avgBoxWidth / 2, y: avgProjected.y + 20 }, // 下方
        { x: avgProjected.x - avgBoxWidth - 10, y: avgProjected.y - avgBoxHeight / 2 }, // 左方
        { x: avgProjected.x + 10, y: avgProjected.y - avgBoxHeight / 2 }, // 右方
      ];

      let avgBoxX = avgPositions[0].x;
      let avgBoxY = avgPositions[0].y;

      // 檢查平均值資訊卡位置是否與畫布邊界衝突
      for (const pos of avgPositions) {
        if (pos.x >= 0 && pos.x + avgBoxWidth <= canvas.width && 
            pos.y >= 0 && pos.y + avgBoxHeight <= canvas.height) {
          avgBoxX = pos.x;
          avgBoxY = pos.y;
          break;
        }
      }

      infoCards.push({
        x: avgBoxX,
        y: avgBoxY,
        width: avgBoxWidth,
        height: avgBoxHeight,
        type: 'avg'
      });

      // 為每個數據點計算資訊卡位置
      data.forEach((point, index) => {
        const coords = getCoordinates(point);
        const projected = project3D(coords.x, coords.y, coords.z);
        const text = `#${index + 1}: RGB(${point.r},${point.g},${point.b})`;
        ctx.font = '9px Arial';
        const textWidth = ctx.measureText(text).width;
        const boxWidth = textWidth + 8;
        const boxHeight = 14;

        // 為數據點資訊卡尋找最佳位置
        const pointPositions = [
          { x: projected.x - boxWidth / 2, y: projected.y - 25 }, // 上方
          { x: projected.x - boxWidth / 2, y: projected.y + 15 }, // 下方
          { x: projected.x - boxWidth - 10, y: projected.y - boxHeight / 2 }, // 左方
          { x: projected.x + 10, y: projected.y - boxHeight / 2 }, // 右方
        ];

        let boxX = pointPositions[0].x;
        let boxY = pointPositions[0].y;

        // 檢查與其他資訊卡的衝突
        for (const pos of pointPositions) {
          const newCard = {
            x: pos.x,
            y: pos.y,
            width: boxWidth,
            height: boxHeight,
            type: 'point' as const,
            index
          };

          let hasCollision = false;
          for (const existingCard of infoCards) {
            if (isColliding(newCard, existingCard)) {
              hasCollision = true;
              break;
            }
          }

          // 檢查畫布邊界
          if (!hasCollision && pos.x >= 0 && pos.x + boxWidth <= canvas.width && 
              pos.y >= 0 && pos.y + boxHeight <= canvas.height) {
            boxX = pos.x;
            boxY = pos.y;
            break;
          }
        }

        infoCards.push({
          x: boxX,
          y: boxY,
          width: boxWidth,
          height: boxHeight,
          type: 'point',
          index
        });
      });

      return { infoCards, avgProjected, avgR, avgG, avgB, avgText };
    };

    // 檢查兩個資訊卡是否碰撞
    const isColliding = (card1: any, card2: any) => {
      return !(card1.x + card1.width < card2.x || 
               card2.x + card2.width < card1.x || 
               card1.y + card1.height < card2.y || 
               card2.y + card2.height < card1.y);
    };

    // 繪製數據點
    const drawDataPoints = () => {
      const { infoCards, avgProjected, avgR, avgG, avgB, avgText } = calculateInfoCardPositions();

      // 繪製平均值點（較大，紅色邊框）
      ctx.beginPath();
      ctx.arc(avgProjected.x, avgProjected.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(${Math.round(avgR)}, ${Math.round(avgG)}, ${Math.round(avgB)}, 0.8)`;
      ctx.fill();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 繪製平均值資訊卡
      const avgCard = infoCards.find(card => card.type === 'avg');
      if (avgCard) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
        ctx.fillRect(avgCard.x, avgCard.y, avgCard.width, avgCard.height);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(avgCard.x, avgCard.y, avgCard.width, avgCard.height);
        
        ctx.fillStyle = '#ff0000';
        ctx.textAlign = 'center';
        ctx.fillText(avgText, avgCard.x + avgCard.width / 2, avgCard.y + avgCard.height / 2 + 4);
      }

      // 繪製數據點
      console.log('🎯 開始繪製數據點，總數:', data.length);
      data.forEach((point, index) => {
        const coords = getCoordinates(point);
        const projected = project3D(coords.x, coords.y, coords.z);
        console.log(`📍 點 ${index + 1}: RGB(${point.r},${point.g},${point.b}) -> 座標(${coords.x.toFixed(1)},${coords.y.toFixed(1)},${coords.z.toFixed(1)}) -> 投影(${projected.x.toFixed(1)},${projected.y.toFixed(1)})`);
        
        // 繪製陰影效果
        ctx.beginPath();
        ctx.arc(projected.x + 2, projected.y + 2, 6, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fill();
        
        // 繪製主點
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${point.r}, ${point.g}, ${point.b}, 0.8)`;
        ctx.fill();
        
        // 添加邊框
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 繪製數據點資訊卡
        const pointCard = infoCards.find(card => card.type === 'point' && card.index === index);
        if (pointCard) {
          const text = `#${index + 1}: RGB(${point.r},${point.g},${point.b})`;
          
          // 繪製背景框
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillRect(pointCard.x, pointCard.y, pointCard.width, pointCard.height);
          ctx.strokeStyle = `rgb(${point.r}, ${point.g}, ${point.b})`;
          ctx.lineWidth = 1;
          ctx.strokeRect(pointCard.x, pointCard.y, pointCard.width, pointCard.height);
          
          // 繪製RGB值文字
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.fillText(text, pointCard.x + pointCard.width / 2, pointCard.y + pointCard.height / 2 + 3);
        }

        // 繪製到平均值的連線（淺色）
        ctx.beginPath();
        ctx.moveTo(projected.x, projected.y);
        ctx.lineTo(avgProjected.x, avgProjected.y);
        ctx.strokeStyle = `rgba(${point.r}, ${point.g}, ${point.b}, 0.2)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    };

    // 繪製原點
    const drawOrigin = () => {
      const origin = project3D(0, 0, 0);
      
      // 繪製原點陰影
      ctx.beginPath();
      ctx.arc(origin.x + 1, origin.y + 1, 4, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
      
      // 繪製原點
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#333';
      ctx.fill();
      
      // 添加原點標籤
      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('原點 (0,0,0)', origin.x, origin.y - 10);
    };

    // 執行繪製
    drawAxes();
    drawCube();
    drawOrigin();
    drawDataPoints();
    console.log('✅ 3D視覺化繪製完成，模式:', colorDisplayMode);
  }, [data, isVisible, scale, rotationX, rotationY, colorDisplayMode]);

  // 添加滾輪事件監聽器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev: number) => Math.max(0.1, Math.min(2.0, prev * delta)));
    };

    canvas.addEventListener('wheel', wheelHandler, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', wheelHandler);
    };
  }, []);

  if (!isVisible || data.length === 0) {
    return null;
  }
  return (
    <div className="rgb-3d-visualization">
      <div className="rgb-3d-controls">
        <p>🖱️ 滑鼠拖拽旋轉 • 🔄 滾輪縮放 • 📱 觸控拖拽旋轉 • 🤏 雙指縮放</p>
      </div>
      <canvas
        ref={canvasRef}
        className="rgb-3d-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ 
          width: '100%', 
          height: '300px', 
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none' // 防止觸控時頁面滾動
        }}
      />
    </div>
  );
};

export default RGB3DVisualization;
