#!/usr/bin/env python3
"""
色光分類器訓練腳本
使用現有資料作為核心基準，訓練分類器用於識別新的色光樣本
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
import re
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import joblib

def load_training_data(excel_path):
    """載入訓練數據"""
    df = pd.read_excel(excel_path)
    
    # 從圖片名稱提取真實標籤
    true_labels = []
    for filename in df["圖片名稱"]:
        clean_name = re.sub(r'\d+$', '', filename.replace('.png', ''))
        true_labels.append(clean_name)
    
    df['True_Label'] = true_labels
    
    return df

def prepare_features(df, feature_columns=None):
    """準備特徵和標籤"""
    if feature_columns is None:
        feature_columns = ["R", "G", "B", "H (色相)", "S (飽和度)", "V (明度)", "色溫 (K)"]
    
    # 提取特徵
    X = df[feature_columns].copy()
    X = X.fillna(X.mean())
    
    # 提取標籤（從圖片名稱）
    y = df['True_Label'].values
    
    return X, y, feature_columns

def train_classifiers(X, y, test_size=0.15):
    """訓練多種分類器"""
    
    print("⚠️  對於小樣本情況，調整分割比例")
    
    # 簡單分割（不使用 stratify）
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
    
    # 標準化
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # 未標準化的數據（用於某些算法）
    X_train_raw = X_train.values
    X_test_raw = X_test.values
    
    classifiers = {
        'KNN': KNeighborsClassifier(n_neighbors=3, weights='distance'),
        'RandomForest': RandomForestClassifier(n_estimators=100, random_state=42, max_depth=10),
        'SVM': SVC(kernel='rbf', C=1.0, gamma='scale', probability=True)
    }
    
    results = {}
    
    print("🤖 訓練分類器...")
    print(f"📊 訓練集: {len(X_train)} 筆")
    print(f"📊 測試集: {len(X_test)} 筆\n")
    
    # 訓練每個分類器
    for name, clf in classifiers.items():
        print(f"訓練 {name}...")
        
        # KNN 使用標準化數據，RF 使用原始數據
        if name == 'KNN':
            clf.fit(X_train_scaled, y_train)
            y_pred = clf.predict(X_test_scaled)
            y_pred_proba = clf.predict_proba(X_test_scaled)
        elif name == 'SVM':
            clf.fit(X_train_scaled, y_train)
            y_pred = clf.predict(X_test_scaled)
            y_pred_proba = clf.predict_proba(X_test_scaled)
        else:  # RandomForest
            clf.fit(X_train_raw, y_train)
            y_pred = clf.predict(X_test_raw)
            y_pred_proba = clf.predict_proba(X_test_raw)
        
        # 評估
        accuracy = accuracy_score(y_test, y_pred)
        
        results[name] = {
            'classifier': clf,
            'accuracy': accuracy,
            'y_pred': y_pred,
            'y_test': y_test,
            'scaler': scaler if name in ['KNN', 'SVM'] else None,
            'feature_columns': feature_columns,
            'probabilities': y_pred_proba
        }
        
        print(f"✓ {name} - 準確率: {accuracy:.3f}")
        print(f"  分類報告:")
        print(classification_report(y_test, y_pred))
        print()
    
    return results, X_test, y_test

def predict_new_samples(classifier, scaler, feature_columns, new_data):
    """
    預測新樣本
    
    Args:
        classifier: 訓練好的分類器
        scaler: 標準化器（如果需要的話）
        feature_columns: 特徵欄位列表
        new_data: 新樣本的 RGB, HSV, 色溫等特徵
    
    Returns:
        prediction: 預測的類別
        probabilities: 各類別的機率
    """
    # 準備新數據
    new_df = pd.DataFrame([new_data], columns=feature_columns)
    
    # 如果需要標準化
    if scaler is not None:
        new_scaled = scaler.transform(new_df)
        prediction = classifier.predict(new_scaled)
        probabilities = classifier.predict_proba(new_scaled)
    else:
        prediction = classifier.predict(new_df.values)
        probabilities = classifier.predict_proba(new_df.values)
    
    # 獲取類別標籤
    classes = classifier.classes_
    
    # 組合類別和機率
    result = {
        'prediction': prediction[0],
        'confidence': max(probabilities[0]),
        'all_probabilities': {class_name: prob for class_name, prob in zip(classes, probabilities[0])}
    }
    
    return result

def save_models(results, output_dir):
    """儲存訓練好的模型"""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"💾 儲存模型到: {output_dir}")
    
    for name, result in results.items():
        # 儲存分類器
        clf_file = output_dir / f"classifier_{name.lower()}.joblib"
        joblib.dump(result['classifier'], clf_file)
        print(f"   • {clf_file.name}")
        
        # 儲存 scaler（如果有的話）
        if result['scaler'] is not None:
            scaler_file = output_dir / f"scaler_{name.lower()}.joblib"
            joblib.dump(result['scaler'], scaler_file)
            print(f"   • {scaler_file.name}")
        
        # 儲存配置
        config_file = output_dir / f"config_{name.lower()}.json"
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump({
                'model_type': name,
                'accuracy': result['accuracy'],
                'feature_columns': result['feature_columns']
            }, f, ensure_ascii=False, indent=2)
        print(f"   • {config_file.name}")

def main():
    """主程式"""
    # 檔案路徑
    excel_path = Path("output/color_analysis_result_numeric.xlsx")
    
    if not excel_path.exists():
        print(f"❌ 檔案不存在: {excel_path}")
        print(f"💡 請先執行 color_classification_validator.py 和 clean_excel_columns.py")
        return
    
    # 載入數據
    print("📂 載入訓練數據...")
    df = load_training_data(excel_path)
    
    classes = df['True_Label'].unique()
    print(f"✅ 載入 {len(df)} 筆數據")
    print(f"🏷️  標籤類別 ({len(classes)} 個): {list(classes)}")
    
    # 準備特徵
    feature_columns = ["R", "G", "B", "H (色相)", "S (飽和度)", "V (明度)", "色溫 (K)"]
    X, y, _ = prepare_features(df, feature_columns)
    
    print(f"🎯 使用特徵: {feature_columns}\n")
    
    # 訓練分類器
    results, X_test, y_test = train_classifiers(X, y)
    
    # 儲存模型
    output_dir = "output/trained_models"
    save_models(results, output_dir)
    
    # 選擇最佳模型
    best_model_name = max(results, key=lambda x: results[x]['accuracy'])
    print(f"\n🏆 最佳模型: {best_model_name} (準確率: {results[best_model_name]['accuracy']:.3f})")
    
    # 儲存模型使用說明
    readme_file = Path(output_dir) / "README.md"
    with open(readme_file, 'w', encoding='utf-8') as f:
        f.write(f"""# 色光分類模型使用說明

## 最佳模型: {best_model_name}
準確率: {results[best_model_name]['accuracy']:.3f}

## 載入模型

```python
import joblib

# 載入分類器和 scaler
classifier = joblib.load('classifier_{best_model_name.lower()}.joblib')
scaler = joblib.load('scaler_{best_model_name.lower()}.joblib')  # 如果需要

# 準備新樣本的特徵
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
features = [new_sample[col] for col in feature_columns]
if scaler:
    features_scaled = scaler.transform([features])
    prediction = classifier.predict(features_scaled)
    probabilities = classifier.predict_proba(features_scaled)
else:
    prediction = classifier.predict([features])
    probabilities = classifier.predict_proba([features])

print(f"預測類別: {{prediction[0]}}")
print(f"信心度: {{max(probabilities[0]):.3f}}")
```

## 特徵欄位
{feature_columns}
""")
    
    print(f"\n✅ 模型已儲存至: {output_dir}")
    print(f"📚 使用說明: {readme_file}")

if __name__ == "__main__":
    main()
