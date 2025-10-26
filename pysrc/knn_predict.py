#!/usr/bin/env python3
"""
使用訓練好的 K-NN 模型預測新樣本
"""

import joblib
import json
from pathlib import Path
import numpy as np

def load_knn_model(model_dir="output/knn_model"):
    """載入 K-NN 模型"""
    model_dir = Path(model_dir)
    
    # 檢查檔案是否存在
    knn_file = model_dir / "knn_classifier.joblib"
    scaler_file = model_dir / "knn_scaler.joblib"
    config_file = model_dir / "knn_config.json"
    
    if not knn_file.exists() or not scaler_file.exists():
        print(f"❌ 模型檔案不存在在: {model_dir}")
        print(f"💡 請先執行 knn_classifier.py 訓練模型")
        return None
    
    # 載入模型
    knn = joblib.load(knn_file)
    scaler = joblib.load(scaler_file)
    
    # 載入配置
    with open(config_file, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    print(f"✅ 載入 K-NN 模型 (k={config['k']})")
    print(f"🎯 特徵欄位: {config['feature_columns']}")
    
    return knn, scaler, config

def predict_color(knn, scaler, feature_columns, new_sample):
    """
    預測新樣本的色光類別
    
    Args:
        knn: K-NN 分類器
        scaler: 標準化器
        feature_columns: 特徵欄位列表
        new_sample: 新樣本的特徵字典或列表
    
    Returns:
        result: 包含預測結果的字典
    """
    # 如果是字典，轉換為列表
    if isinstance(new_sample, dict):
        features = [new_sample.get(col, 0) for col in feature_columns]
    else:
        features = new_sample
    
    # 確保是正確的長度
    if len(features) != len(feature_columns):
        raise ValueError(f"特徵數量不匹配: 需要 {len(feature_columns)} 個，提供 {len(features)} 個")
    
    # 標準化
    features_scaled = scaler.transform([features])
    
    # 預測
    prediction = knn.predict(features_scaled)
    probabilities = knn.predict_proba(features_scaled)
    
    # 獲取類別和機率
    classes = knn.classes_
    probs = probabilities[0]
    
    # 建立結果
    sorted_results = sorted(zip(classes, probs), key=lambda x: x[1], reverse=True)
    
    result = {
        'prediction': prediction[0],
        'confidence': float(max(probs)),
        'all_probabilities': {cls: float(prob) for cls, prob in sorted_results}
    }
    
    return result

def main():
    """主程式 - 範例使用"""
    
    # 載入模型
    print("📂 載入 K-NN 模型...\n")
    result = load_knn_model()
    
    if result is None:
        return
    
    knn, scaler, config = result
    feature_columns = config['feature_columns']
    
    print(f"\n🔍 範例預測:\n")
    
    # 範例 1: 藍色光
    print("1. 藍色光樣本:")
    sample_blue = {
        'R': 50,
        'G': 100,
        'B': 200,
        'H (色相)': 215,
        'S (飽和度)': 75,
        'V (明度)': 80,
        '色溫 (K)': 6500
    }
    
    result = predict_color(knn, scaler, feature_columns, sample_blue)
    print(f"   特徵: R={sample_blue['R']}, G={sample_blue['G']}, B={sample_blue['B']}")
    print(f"         H={sample_blue['H (色相)']:.1f}°, S={sample_blue['S (飽和度)']:.1f}%, V={sample_blue['V (明度)']:.1f}%")
    print(f"         色溫={sample_blue['色溫 (K)']}K")
    print(f"   ✅ 預測類別: {result['prediction']}")
    print(f"   信心度: {result['confidence']:.3f}")
    print(f"   前3個可能:")
    for i, (cls, prob) in enumerate(list(result['all_probabilities'].items())[:3], 1):
        print(f"      {i}. {cls}: {prob:.3f}")
    print()
    
    # 範例 2: 暖白色光
    print("2. 暖白色光樣本:")
    sample_warm_white = {
        'R': 255,
        'G': 220,
        'B': 180,
        'H (色相)': 35,
        'S (飽和度)': 25,
        'V (明度)': 90,
        '色溫 (K)': 3000
    }
    
    result = predict_color(knn, scaler, feature_columns, sample_warm_white)
    print(f"   特徵: R={sample_warm_white['R']}, G={sample_warm_white['G']}, B={sample_warm_white['B']}")
    print(f"         H={sample_warm_white['H (色相)']:.1f}°, S={sample_warm_white['S (飽和度)']:.1f}%, V={sample_warm_white['V (明度)']:.1f}%")
    print(f"         色溫={sample_warm_white['色溫 (K)']}K")
    print(f"   ✅ 預測類別: {result['prediction']}")
    print(f"   信心度: {result['confidence']:.3f}")
    print(f"   前3個可能:")
    for i, (cls, prob) in enumerate(list(result['all_probabilities'].items())[:3], 1):
        print(f"      {i}. {cls}: {prob:.3f}")
    print()
    
    # 範例 3: 純紅色光
    print("3. 純紅色光樣本:")
    sample_red = {
        'R': 255,
        'G': 50,
        'B': 50,
        'H (色相)': 0,
        'S (飽和度)': 80,
        'V (明度)': 100,
        '色溫 (K)': 2000
    }
    
    result = predict_color(knn, scaler, feature_columns, sample_red)
    print(f"   特徵: R={sample_red['R']}, G={sample_red['G']}, B={sample_red['B']}")
    print(f"         H={sample_red['H (色相)']:.1f}°, S={sample_red['S (飽和度)']:.1f}%, V={sample_red['V (明度)']:.1f}%")
    print(f"         色溫={sample_red['色溫 (K)']}K")
    print(f"   ✅ 預測類別: {result['prediction']}")
    print(f"   信心度: {result['confidence']:.3f}")
    print(f"   前3個可能:")
    for i, (cls, prob) in enumerate(list(result['all_probabilities'].items())[:3], 1):
        print(f"      {i}. {cls}: {prob:.3f}")
    
    print(f"\n✅ 完成！")
    print(f"\n💡 在您的代碼中使用:")
    print(f"""
from knn_predict import load_knn_model, predict_color

# 載入模型
knn, scaler, config = load_knn_model()

# 準備新樣本
new_sample = {{
    'R': 100,
    'G': 150,
    'B': 200,
    'H (色相)': 210,
    'S (飽和度)': 50,
    'V (明度)': 75,
    '色溫 (K)': 6500
}}

# 預測
result = predict_color(knn, scaler, config['feature_columns'], new_sample)
print(f"預測類別: {{result['prediction']}}")
print(f"信心度: {{result['confidence']:.3f}}")
""")

if __name__ == "__main__":
    main()
