import React, { useRef, useEffect, useState } from 'react';
import { RGBData } from '../App';
import './RGB3DVisualization.css';

interface RGB3DVisualizationProps {
  data: RGBData[];
  isVisible: boolean;
}

const RGB3DVisualization: React.FC<RGB3DVisualizationProps> = ({ data, isVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(0.25);
  const [rotationX, setRotationX] = useState(Math.PI / 4);
  const [rotationY, setRotationY] = useState(Math.PI / 6);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev: number) => Math.max(0.1, Math.min(2.0, prev * delta)));
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

    // 繪製RGB座標軸
    const drawAxes = () => {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;

      // R軸 (紅色)
      const rEnd = project3D(255, 0, 0);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(rEnd.x, rEnd.y);
      ctx.strokeStyle = '#ff0000';
      ctx.stroke();

      // G軸 (綠色)
      const gEnd = project3D(0, 255, 0);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(gEnd.x, gEnd.y);
      ctx.strokeStyle = '#00ff00';
      ctx.stroke();

      // B軸 (藍色)
      const bEnd = project3D(0, 0, 255);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(bEnd.x, bEnd.y);
      ctx.strokeStyle = '#0000ff';
      ctx.stroke();

      // 添加軸標籤
      ctx.fillStyle = '#333';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('R', rEnd.x + 10, rEnd.y - 10);
      ctx.fillText('G', gEnd.x - 10, gEnd.y - 10);
      ctx.fillText('B', bEnd.x, bEnd.y + 20);
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

    // 繪製數據點
    const drawDataPoints = () => {
      // 計算平均值點
      const avgR = data.reduce((sum, item) => sum + item.r, 0) / data.length;
      const avgG = data.reduce((sum, item) => sum + item.g, 0) / data.length;
      const avgB = data.reduce((sum, item) => sum + item.b, 0) / data.length;
      const avgProjected = project3D(avgR, avgG, avgB);

      // 繪製平均值點（較大，紅色邊框）
      ctx.beginPath();
      ctx.arc(avgProjected.x, avgProjected.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(${Math.round(avgR)}, ${Math.round(avgG)}, ${Math.round(avgB)}, 0.8)`;
      ctx.fill();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 添加平均值標籤和RGB值顯示框
      const avgLabelY = avgProjected.y - 20;
      const avgText = `平均值: RGB(${Math.round(avgR)},${Math.round(avgG)},${Math.round(avgB)})`;
      
      // 繪製平均值顯示框
      ctx.font = 'bold 10px Arial';
      const avgTextWidth = ctx.measureText(avgText).width;
      const avgBoxWidth = avgTextWidth + 12;
      const avgBoxHeight = 16;
      const avgBoxX = avgProjected.x - avgBoxWidth / 2;
      const avgBoxY = avgLabelY - avgBoxHeight / 2;
      
      // 繪製平均值背景框（紅色邊框）
      ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.fillRect(avgBoxX, avgBoxY, avgBoxWidth, avgBoxHeight);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(avgBoxX, avgBoxY, avgBoxWidth, avgBoxHeight);
      
      // 繪製平均值文字
      ctx.fillStyle = '#ff0000';
      ctx.textAlign = 'center';
      ctx.fillText(avgText, avgProjected.x, avgLabelY + 4);

      // 繪製數據點
      console.log('🎯 開始繪製數據點，總數:', data.length);
      data.forEach((point, index) => {
        const projected = project3D(point.r, point.g, point.b);
        console.log(`📍 點 ${index + 1}: RGB(${point.r},${point.g},${point.b}) -> 投影(${projected.x.toFixed(1)},${projected.y.toFixed(1)})`);
        
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

        // 添加點標籤和RGB值顯示框
        const labelY = projected.y - 15;
        
        // 繪製RGB值顯示框
        const text = `#${index + 1}: RGB(${point.r},${point.g},${point.b})`;
        ctx.font = '9px Arial';
        const textWidth = ctx.measureText(text).width;
        const boxWidth = textWidth + 8;
        const boxHeight = 14;
        const boxX = projected.x - boxWidth / 2;
        const boxY = labelY - boxHeight / 2;
        
        // 繪製背景框
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        ctx.strokeStyle = `rgb(${point.r}, ${point.g}, ${point.b})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        
        // 繪製RGB值文字
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText(text, projected.x, labelY + 3);

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
    console.log('✅ 3D RGB視覺化繪製完成');
  }, [data, isVisible, scale, rotationX, rotationY]);

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
        <p>🖱️ 滑鼠拖拽旋轉 • 🔄 滾輪縮放</p>
      </div>
      <canvas
        ref={canvasRef}
        className="rgb-3d-canvas"
        style={{ width: '100%', height: '300px', cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};

export default RGB3DVisualization;
