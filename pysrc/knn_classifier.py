#!/usr/bin/env python3
"""
K-NN 色光分類器
使用現有資料作為基準，對新樣本進行分類
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
import re
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import classification_report, confusion_matrix
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

def prepare_data(df):
    """準備特徵和標籤"""
    feature_columns = ["R", "G", "B", "H (色相)", "S (飽和度)", "V (明度)", "色溫 (K)"]
    
    # 提取特徵
    X = df[feature_columns].copy()
    X = X.fillna(X.mean())
    
    # 提取標籤
    y = df['True_Label'].values
    
    return X, y, feature_columns

def train_knn(X, y, feature_columns, k=3):
    """
    訓練 K-NN 分類器
    
    Args:
        X: 特徵數據
        y: 標籤
        feature_columns: 特徵欄位列表
        k: 最近的 k 個鄰居
    """
    print(f"🤖 訓練 K-NN (k={k})...")
    print(f"📊 訓練樣本數: {len(X)}")
    print(f"🏷️  類別數: {len(np.unique(y))}")
    
    # 標準化特徵（K-NN 需要標準化）
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # 訓練 K-NN
    knn = KNeighborsClassifier(n_neighbors=k, weights='distance', metric='euclidean')
    knn.fit(X_scaled, y)
    
    # 評估（使用全部數據作為訓練集評估）
    y_pred = knn.predict(X_scaled)
    
    print(f"\n📊 訓練集準確率評估:")
    print(classification_report(y, y_pred))
    
    return knn, scaler, feature_columns

def save_model(knn, scaler, feature_columns, output_dir):
    """儲存模型"""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 儲存分類器
    knn_file = output_dir / "knn_classifier.joblib"
    joblib.dump(knn, knn_file)
    print(f"💾 儲存分類器: {knn_file}")
    
    # 儲存 scaler
    scaler_file = output_dir / "knn_scaler.joblib"
    joblib.dump(scaler, scaler_file)
    print(f"💾 儲存標準化器: {scaler_file}")
    
    # 儲存配置
    config = {
        'model_type': 'K-NN',
        'feature_columns': feature_columns,
        'k': knn.n_neighbors,
        'distance_metric': 'euclidean',
        'weights': 'distance'
    }
    
    config_file = output_dir / "knn_config.json"
    with open(config_file, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    print(f"💾 儲存配置: {config_file}")
    
    return config_file

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
    
    classes = sorted(df['True_Label'].unique())
    print(f"✅ 載入 {len(df)} 筆數據")
    print(f"🏷️  標籤類別 ({len(classes)} 個):")
    for i, cls in enumerate(classes, 1):
        count = len(df[df['True_Label'] == cls])
        print(f"   {i:2d}. {cls} ({count} 筆)")
    
    # 準備數據
    X, y, feature_columns = prepare_data(df)
    
    print(f"\n🎯 使用特徵 ({len(feature_columns)} 個):")
    for col in feature_columns:
        print(f"   • {col}")
    
    print()
    
    # 訓練 K-NN
    knn, scaler, _ = train_knn(X, y, feature_columns, k=3)
    
    # 儲存模型
    output_dir = "output/knn_model"
    config_file = save_model(knn, scaler, feature_columns, output_dir)
    
    # 讀取配置
    with open(config_file, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    print(f"\n✅ K-NN 模型訓練完成！")
    print(f"\n💡 使用方式:")
    print(f"""
# 載入模型
import joblib

knn = joblib.load('{config_file.parent}/knn_classifier.joblib')
scaler = joblib.load('{config_file.parent}/knn_scaler.joblib')

# 準備新樣本
new_sample = [
    100,   # R
    150,   # G
    200,   # B
    210,   # H (色相)
    50,    # S (飽和度)
    75,    # V (明度)
    6500   # 色溫 (K)
]

# 標準化
new_sample_scaled = scaler.transform([new_sample])

# 預測
prediction = knn.predict(new_sample_scaled)
probabilities = knn.predict_proba(new_sample_scaled)

print(f"預測類別: {{prediction[0]}}")
print(f"信心度: {{max(probabilities[0]):.3f}}")

# 查看所有類別的機率（按機率排序）
classes = knn.classes_
probs = probabilities[0]
sorted_results = sorted(zip(classes, probs), key=lambda x: x[1], reverse=True)

print(f"所有可能的類別:")
for cls, prob in sorted_results[:5]:  # 顯示前5個
    print(f"  {{cls}}: {{prob:.3f}}")
""")
    
    print(f"\n📁 模型檔案位置: {output_dir}")

if __name__ == "__main__":
    main()
