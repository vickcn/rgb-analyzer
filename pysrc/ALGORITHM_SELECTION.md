# 演算法選擇指南

## 問題場景

**當前狀況**：已有標記好的色光數據（23筆）
**目標**：未來收到新的色光樣本時，要能夠自動識別其類別

## 推薦方案：監督式學習 (Supervised Learning)

既然您有**標記樣本**（圖片名稱就是真實標籤），應該使用**監督式學習**而非無監督學習。

### 為什麼不用 DBSCAN / K-means？

這些是**無監督學習**算法：
- ❌ 不知道哪個群集對應哪個真實類別
- ❌ 需要手動映射群集到標籤
- ❌ 無法直接給出新樣本的類別

### ✅ 推薦的方案

#### 方案 1: K-NN (K-Nearest Neighbors) - **最簡單**
```
原理：找新樣本的 K 個最近鄰，投票決定類別
優點：簡單、不需要訓練、適合小樣本
缺點：預測時需要載入全部訓練數據
```

#### 方案 2: 隨機森林 (Random Forest) - **最穩健**
```
原理：訓練多個決策樹，投票決定類別
優點：穩定、抗過擬合、可視化特徵重要性
缺點：需要訓練階段
```

#### 方案 3: SVM (Support Vector Machine) - **最高準確率**
```
原理：找到最佳分界平面
優點：準確率高、適合高維數據
缺點：黑盒模型、參數調優較複雜
```

## 實際使用流程

### 階段 1: 訓練階段
```bash
# 訓練分類器（一次即可）
python color_classifier_training.py
```

**輸出**:
- `output/trained_models/classifier_*.joblib` - 訓練好的模型
- `output/trained_models/scaler_*.joblib` - 標準化器
- `output/trained_models/config_*.json` - 模型配置

### 階段 2: 預測階段
```python
# 載入模型
import joblib
classifier = joblib.load('classifier_knn.joblib')

# 新樣本的特徵
new_sample = {
    'R': 100,
    'G': 150,
    'B': 200,
    'H (色相)': 210,
    'S (飽和度)': 50,
    'V (明度)': 75,
    '色溫 (K)': 6500
}

# 預測
prediction = classifier.predict([list(new_sample.values())])
print(f"預測類別: {prediction[0]}")
```

## 各算法的比較

| 算法 | 準確率 | 速度 | 可解釋性 | 需要訓練 | 適用場景 |
|------|--------|------|----------|----------|----------|
| K-NN | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ❌ | 小樣本、相似度分類 |
| Random Forest | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ✅ | 通用、穩定 |
| SVM | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ✅ | 高準確率需求 |

## 建議

### 如果是小樣本（20-50筆）：**K-NN**
```python
# 最簡單，無需訓練
from sklearn.neighbors import KNeighborsClassifier
clf = KNeighborsClassifier(n_neighbors=3)
clf.fit(X_train, y_train)
prediction = clf.predict(new_sample)
```

### 如果樣本會持續增加：**Random Forest**
```python
# 更穩健，可視化特徵重要性
from sklearn.ensemble import RandomForestClassifier
clf = RandomForestClassifier(n_estimators=100)
clf.fit(X_train, y_train)
prediction = clf.predict(new_sample)
```

### 如果需要最高準確率：**SVM**
```python
# 最高準確率
from sklearn.svm import SVC
clf = SVC(kernel='rbf', probability=True)
clf.fit(X_train, y_train)
prediction = clf.predict(new_sample)
```

## 使用腳本

我已經為您創建了完整的訓練和使用腳本：

### 1. `color_classifier_training.py`
- 訓練 3 種分類器（K-NN, RF, SVM）
- 自動選擇最佳模型
- 儲存模型供後續使用

### 2. `color_classifier_predict.py`
- 載入訓練好的模型
- 預測新樣本
- 顯示信心度

### 使用步驟

```bash
# Step 1: 訓練模型（只需一次）
cd /Users/kexuen/projects/rgbAnalyzer/pysrc
python color_classifier_training.py

# Step 2: 使用模型預測新樣本
python color_classifier_predict.py

# Step 3: 在你的代碼中使用
from color_classifier_predict import load_trained_model, predict_new_color

classifier, scaler, feature_columns, _, _ = load_trained_model()

# 準備新樣本
new_sample = {
    'R': 100, 'G': 150, 'B': 200,
    'H (色相)': 210,
    'S (飽和度)': 50, 'V (明度)': 75,
    '色溫 (K)': 6500
}

# 預測
result = predict_new_color(classifier, scaler, feature_columns, new_sample)
print(f"類別: {result['prediction']}, 信心度: {result['confidence']}")
```

## 總結

**您的需求 = 監督式學習**

推薦使用 **K-NN** 或 **Random Forest**，因為：
1. ✅ 有標記樣本（23筆）
2. ✅ 需要給新樣本分類類別
3. ✅ 簡單易用，效果穩定
4. ✅ 可視化分類結果

**DBSCAN 不適合**，因為：
- 是無監督學習
- 不知道群集對應的類別
- 每次預測都要重新聚類
