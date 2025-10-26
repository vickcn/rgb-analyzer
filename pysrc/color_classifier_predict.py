#!/usr/bin/env python3
"""
使用訓練好的分類器預測新樣本
"""

import joblib
import json
from pathlib import Path

def load_trained_model(model_dir="output/trained_models"):
    """載入訓練好的模型"""
    model_dir = Path(model_dir)
    
    # 讀取最佳模型配置
    best_model = None
    best_acc = 0
    
    for config_file in model_dir.glob("config_*.json"):
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
            if config['accuracy'] > best_acc:
                best_acc = config['accuracy']
                best_model = config
    
    if best_model is None:
        print("❌ 找不到訓練好的模型")
        return None
    
    model_name = best_model['model_type']
    feature_columns = best_model['feature_columns']
    
    # 載入分類器
    classifier_file = model_dir / f"classifier_{model_name.lower()}.joblib"
    classifier = joblib.load(classifier_file)
    
    # 載入 scaler（如果需要）
    scaler = None
    scaler_file = model_dir / f"scaler_{model_name.lower()}.joblib"
    if scaler_file.exists():
        scaler = joblib.load(scaler_file)
    
    return classifier, scaler, feature_columns, model_name, best_acc

def predict_new_color(classifier, scaler, feature_columns, new_sample):
    """
    預測新樣本的色光類別
    
    Args:
        classifier: 分類器
        scaler: 標準化器
        feature_columns: 特徵欄位列表
        new_sample: 新樣本的特徵字典或數值列表
    
    Returns:
        prediction: 預測的類別
        confidence: 信心度
        all_probabilities: 所有類別的機率
    """
    # 如果是字典，轉換為數值列表
    if isinstance(new_sample, dict):
        features = [new_sample.get(col, 0) for col in feature_columns]
    else:
        features = new_sample
    
    # 標準化（如果需要）
    if scaler is not None:
        features_scaled = scaler.transform([features])
        prediction = classifier.predict(features_scaled)
        probabilities = classifier.predict_proba(features_scaled)
    else:
        prediction = classifier.predict([features])
        probabilities = classifier.predict_proba([features])
    
    # 獲取類別和機率
    classes = classifier.classes_
    result = {
        'prediction': prediction[0],
        'confidence': float(max(probabilities[0])),
        'all_probabilities': {
            class_name: float(prob) 
            for class_name, prob in zip(classes, probabilities[0])
        }
    }
    
    return result

def main():
    """主程式 - 範例使用"""
    
    # 載入模型
    print("📂 載入訓練好的模型...")
    result = load_trained_model()
    
    if result is None:
        return
    
    classifier, scaler, feature_columns, model_name, acc = result
    print(f"✅ 載入模型: {model_name} (準確率: {acc:.3f})")
    print(f"🎯 特徵欄位: {feature_columns}\n")
    
    # 範例：預測新樣本
    print("🔍 範例預測:\n")
    
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
    
    result = predict_new_color(classifier, scaler, feature_columns, sample_blue)
    print(f"   特徵: RGB({sample_blue['R']},{sample_blue['G']},{sample_blue['B']}), HSV({sample_blue['H (色相)']:.1f}°,{sample_blue['S (飽和度)']:.1f}%,{sample_blue['V (明度)']:.1f}%)")
    print(f"   預測: {result['prediction']}")
    print(f"   信心度: {result['confidence']:.3f}")
    print(f"   前3個可能:")
    sorted_probs = sorted(result['all_probabilities'].items(), key=lambda x: x[1], reverse=True)
    for i, (cls, prob) in enumerate(sorted_probs[:3], 1):
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
    
    result = predict_new_color(classifier, scaler, feature_columns, sample_warm_white)
    print(f"   特徵: RGB({sample_warm_white['R']},{sample_warm_white['G']},{sample_warm_white['B']}), HSV({sample_warm_white['H (色相)']:.1f}°,{sample_warm_white['S (飽和度)']:.1f}%,{sample_warm_white['V (明度)']:.1f}%)")
    print(f"   預測: {result['prediction']}")
    print(f"   信心度: {result['confidence']:.3f}")
    print()
    
    print("✅ 完成！")
    print("\n💡 使用方式:")
    print("   from color_classifier_predict import predict_new_color, load_trained_model")
    print("   classifier, scaler, feature_columns, _, _ = load_trained_model()")
    print("   result = predict_new_color(classifier, scaler, feature_columns, your_sample)")

if __name__ == "__main__":
    main()
