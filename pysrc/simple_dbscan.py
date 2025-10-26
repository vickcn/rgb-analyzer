#!/usr/bin/env python3
"""
簡化版 DBSCAN 分析腳本
使用標記樣本（圖片名稱）進行聚類驗證
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import adjusted_rand_score, silhouette_score
import re

def main():
    """主程式"""
    # 檔案路徑（使用已清理單位後的檔案）
    excel_path = Path("output/color_analysis_result_numeric.xlsx")
    
    if not excel_path.exists():
        print(f"❌ 檔案不存在: {excel_path}")
        print(f"💡 請先執行 clean_excel_columns.py 來清理單位")
        return
    
    # 讀取數據
    print("📂 載入數據...")
    df = pd.read_excel(excel_path)
    print(f"✅ 載入 {len(df)} 筆數據")
    
    # 從圖片名稱提取真實標籤
    true_labels = []
    for filename in df["圖片名稱"]:
        # 移除副檔名和數字後綴
        clean_name = re.sub(r'\d+$', '', filename.replace('.png', ''))
        true_labels.append(clean_name)
    
    print(f"🏷️  真實類別: {set(true_labels)}")
    
    # 選擇特徵欄位
    # 可選擇的特徵組合
    feature_sets = {
        "default": ["R", "G", "B", "H (色相)", "S (飽和度)", "V (明度)", "色溫 (K)"],
        "rgb_only": ["R", "G", "B"],
        "hsv_only": ["H (色相)", "S (飽和度)", "V (明度)"],
        "color_temp_focused": ["色溫 (K)", "S (飽和度)", "V (明度)"],
        "comprehensive": ["R", "G", "B", "H (色相)", "S (飽和度)", "V (明度)", "色溫 (K)", "HSL_H", "HSL_S", "HSL_L"]
    }
    
    # 使用預設組合
    feature_columns = feature_sets["default"]
    print(f"🎯 使用特徵 ({len(feature_columns)} 個):")
    for i, col in enumerate(feature_columns, 1):
        print(f"   {i}. {col}")
    
    # 如果用戶想使用其他組合，可以取消註解以下代碼
    # import sys
    # if len(sys.argv) > 1:
    #     choice = sys.argv[1]
    #     if choice in feature_sets:
    #         feature_columns = feature_sets[choice]
    #         print(f"改用組合: {choice}")
    
    # 準備數據
    X = df[feature_columns].fillna(df[feature_columns].mean())
    
    # 標準化
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # DBSCAN 參數搜索
    print("🔍 尋找最佳參數...")
    best_score = -1
    best_params = None
    
    for eps in np.arange(0.5, 2.0, 0.1):
        for min_samples in range(3, 8):
            dbscan = DBSCAN(eps=eps, min_samples=min_samples)
            labels = dbscan.fit_predict(X_scaled)
            
            n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
            
            if n_clusters > 1:
                try:
                    ari = adjusted_rand_score(true_labels, labels)
                    silhouette = silhouette_score(X_scaled, labels)
                    score = 0.7 * ari + 0.3 * silhouette
                    
                    if score > best_score:
                        best_score = score
                        best_params = {
                            'eps': eps,
                            'min_samples': min_samples,
                            'labels': labels,
                            'ari': ari,
                            'silhouette': silhouette,
                            'n_clusters': n_clusters
                        }
                except:
                    continue
    
    if best_params is None:
        print("❌ 無法找到合適參數")
        return
    
    # 輸出結果
    print(f"\n✅ 最佳參數:")
    print(f"   eps: {best_params['eps']:.2f}")
    print(f"   min_samples: {best_params['min_samples']}")
    print(f"   群集數: {best_params['n_clusters']}")
    print(f"   ARI: {best_params['ari']:.3f}")
    print(f"   Silhouette: {best_params['silhouette']:.3f}")
    
    # 分析結果
    df_result = df.copy()
    df_result['真實標籤'] = true_labels
    df_result['聚類標籤'] = best_params['labels']
    
    print(f"\n📊 聚類結果:")
    confusion = pd.crosstab(df_result['真實標籤'], df_result['聚類標籤'], margins=True)
    print(confusion)
    
    # 各群集特徵統計
    print(f"\n🎯 各群集特徵平均值:")
    cluster_stats = df_result.groupby('聚類標籤')[feature_columns].mean().round(1)
    print(cluster_stats)
    
    # 儲存結果
    output_dir = Path("output/dbscan_simple")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    df_result.to_csv(output_dir / "dbscan_results.csv", index=False, encoding='utf-8-sig')
    
    # 儲存參數和評估結果
    with open(output_dir / "best_params.json", 'w', encoding='utf-8') as f:
        json.dump({
            'eps': best_params['eps'],
            'min_samples': best_params['min_samples'],
            'n_clusters': best_params['n_clusters'],
            'ari_score': best_params['ari'],
            'silhouette_score': best_params['silhouette'],
            'feature_columns': feature_columns
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 結果已儲存至: {output_dir}")
    print("📁 輸出檔案:")
    print("   • dbscan_results.csv - 完整結果")
    print("   • best_params.json - 最佳參數")

if __name__ == "__main__":
    main()
