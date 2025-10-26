#!/usr/bin/env python3
"""
使用 DBSCAN 對色光數據進行聚類分析
利用圖片名稱作為標記樣本進行驗證
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import adjusted_rand_score, silhouette_score
import matplotlib.pyplot as plt
import seaborn as sns
from collections import Counter

def load_data_and_headers(excel_path, headers_json_path):
    """載入數據和 header 資訊"""
    # 讀取 Excel 數據
    df = pd.read_excel(excel_path)
    
    # 讀取 header 資訊
    with open(headers_json_path, 'r', encoding='utf-8') as f:
        headers_info = json.load(f)
    
    return df, headers_info

def extract_true_labels_from_filename(df, filename_col="圖片名稱"):
    """從圖片名稱提取真實標籤"""
    true_labels = []
    
    for filename in df[filename_col]:
        # 移除副檔名和數字後綴
        base_name = filename.replace('.png', '').replace('.jpg', '')
        
        # 移除數字後綴（如 暖白1, 暖白2）
        import re
        clean_name = re.sub(r'\d+$', '', base_name)
        
        true_labels.append(clean_name)
    
    return true_labels

def select_features_interactive(headers_info):
    """互動式選擇特徵欄位"""
    print("🔍 可用的特徵欄位:")
    suggested = headers_info.get("suggested_features_for_dbscan", headers_info.get("suggested_features_for_kmeans", []))
    
    for i, header in enumerate(headers_info["headers"]):
        marker = "✓" if header in suggested else " "
        print(f"  {i:2d}: [{marker}] {header}")
    
    print(f"\n💡 建議的特徵欄位（適合 DBSCAN）:")
    for feature in suggested:
        print(f"   • {feature}")
    
    # 讓用戶選擇
    print(f"\n請選擇特徵欄位:")
    print(f"1. 使用建議的特徵欄位")
    print(f"2. 自定義選擇")
    
    choice = input("選擇 (1/2): ").strip()
    
    if choice == "1":
        return suggested
    else:
        print("請輸入欄位索引，用逗號分隔 (例: 3,4,5,7,8,9):")
        indices = input().strip().split(',')
        try:
            selected_features = [headers_info["headers"][int(i.strip())] for i in indices]
            return selected_features
        except:
            print("輸入格式錯誤，使用建議特徵")
            return suggested

def perform_dbscan_analysis(df, feature_columns, true_labels, eps_range=None, min_samples_range=None):
    """執行 DBSCAN 分析"""
    # 準備特徵數據
    X = df[feature_columns].copy()
    
    # 處理缺失值
    X = X.fillna(X.mean())
    
    # 標準化特徵
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # 參數範圍
    if eps_range is None:
        eps_range = np.arange(0.3, 2.0, 0.1)
    if min_samples_range is None:
        min_samples_range = range(2, 10)
    
    best_params = None
    best_score = -1
    results = []
    
    print("🔍 尋找最佳 DBSCAN 參數...")
    
    for eps in eps_range:
        for min_samples in min_samples_range:
            # 執行 DBSCAN
            dbscan = DBSCAN(eps=eps, min_samples=min_samples)
            cluster_labels = dbscan.fit_predict(X_scaled)
            
            # 計算評估指標
            n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
            n_noise = list(cluster_labels).count(-1)
            
            if n_clusters > 1:  # 至少要有2個群集才能計算 silhouette score
                try:
                    silhouette = silhouette_score(X_scaled, cluster_labels)
                    ari = adjusted_rand_score(true_labels, cluster_labels)
                    
                    # 綜合評分（ARI 權重較高，因為有真實標籤）
                    combined_score = 0.7 * ari + 0.3 * silhouette
                    
                    results.append({
                        'eps': eps,
                        'min_samples': min_samples,
                        'n_clusters': n_clusters,
                        'n_noise': n_noise,
                        'silhouette': silhouette,
                        'ari': ari,
                        'combined_score': combined_score,
                        'cluster_labels': cluster_labels
                    })
                    
                    if combined_score > best_score:
                        best_score = combined_score
                        best_params = {
                            'eps': eps,
                            'min_samples': min_samples,
                            'cluster_labels': cluster_labels
                        }
                        
                except:
                    continue
    
    return best_params, results, X_scaled, scaler

def analyze_clusters(df, cluster_labels, true_labels, feature_columns):
    """分析聚類結果"""
    # 添加聚類標籤到數據框
    df_analysis = df.copy()
    df_analysis['Cluster'] = cluster_labels
    df_analysis['True_Label'] = true_labels
    
    print("📊 聚類結果分析:")
    print(f"總群集數: {len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)}")
    print(f"噪音點數: {list(cluster_labels).count(-1)}")
    
    # 群集統計
    cluster_stats = df_analysis.groupby('Cluster').agg({
        'True_Label': ['count', lambda x: Counter(x).most_common(1)[0]],
        **{col: 'mean' for col in feature_columns}
    }).round(2)
    
    print("\n🎯 各群集特徵:")
    print(cluster_stats)
    
    # 真實標籤 vs 聚類標籤對照表
    print("\n🔍 真實標籤 vs 聚類標籤:")
    confusion_matrix = pd.crosstab(df_analysis['True_Label'], df_analysis['Cluster'], margins=True)
    print(confusion_matrix)
    
    return df_analysis, cluster_stats

def visualize_results(df_analysis, feature_columns, output_dir):
    """視覺化結果"""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 設定中文字體
    plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei']
    plt.rcParams['axes.unicode_minus'] = False
    
    # 1. 聚類結果散點圖（使用前兩個主要特徵）
    if len(feature_columns) >= 2:
        plt.figure(figsize=(12, 5))
        
        # 真實標籤
        plt.subplot(1, 2, 1)
        for label in df_analysis['True_Label'].unique():
            mask = df_analysis['True_Label'] == label
            plt.scatter(df_analysis[mask][feature_columns[0]], 
                       df_analysis[mask][feature_columns[1]], 
                       label=label, alpha=0.7)
        plt.xlabel(feature_columns[0])
        plt.ylabel(feature_columns[1])
        plt.title('真實標籤分布')
        plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
        
        # 聚類結果
        plt.subplot(1, 2, 2)
        for cluster in df_analysis['Cluster'].unique():
            mask = df_analysis['Cluster'] == cluster
            label = f'Cluster {cluster}' if cluster != -1 else 'Noise'
            plt.scatter(df_analysis[mask][feature_columns[0]], 
                       df_analysis[mask][feature_columns[1]], 
                       label=label, alpha=0.7)
        plt.xlabel(feature_columns[0])
        plt.ylabel(feature_columns[1])
        plt.title('DBSCAN 聚類結果')
        plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
        
        plt.tight_layout()
        plt.savefig(output_dir / 'dbscan_clusters.png', dpi=300, bbox_inches='tight')
        plt.show()
    
    # 2. 特徵分布熱圖
    plt.figure(figsize=(10, 8))
    cluster_means = df_analysis.groupby('Cluster')[feature_columns].mean()
    sns.heatmap(cluster_means.T, annot=True, cmap='viridis', fmt='.1f')
    plt.title('各群集特徵平均值熱圖')
    plt.tight_layout()
    plt.savefig(output_dir / 'cluster_features_heatmap.png', dpi=300, bbox_inches='tight')
    plt.show()

def main():
    """主程式"""
    # 檔案路徑
    base_dir = Path(__file__).parent
    excel_path = base_dir / "output" / "color_analysis_result.xlsx"
    headers_json_path = base_dir / "output" / "color_analysis_result_headers.json"
    output_dir = base_dir / "output" / "dbscan_analysis"
    
    # 檢查檔案是否存在
    if not excel_path.exists():
        print(f"❌ Excel 檔案不存在: {excel_path}")
        return
    
    if not headers_json_path.exists():
        print(f"❌ Headers JSON 不存在: {headers_json_path}")
        print("請先執行 extract_headers.py")
        return
    
    # 載入數據
    print("📂 載入數據...")
    df, headers_info = load_data_and_headers(excel_path, headers_json_path)
    
    # 提取真實標籤
    true_labels = extract_true_labels_from_filename(df)
    print(f"✅ 載入 {len(df)} 筆數據，{len(set(true_labels))} 個真實類別")
    
    # 選擇特徵
    feature_columns = select_features_interactive(headers_info)
    print(f"🎯 選擇的特徵: {feature_columns}")
    
    # 執行 DBSCAN 分析
    print("🤖 執行 DBSCAN 分析...")
    best_params, results, X_scaled, scaler = perform_dbscan_analysis(
        df, feature_columns, true_labels
    )
    
    if best_params is None:
        print("❌ 無法找到合適的 DBSCAN 參數")
        return
    
    print(f"✅ 最佳參數: eps={best_params['eps']:.2f}, min_samples={best_params['min_samples']}")
    
    # 分析聚類結果
    df_analysis, cluster_stats = analyze_clusters(
        df, best_params['cluster_labels'], true_labels, feature_columns
    )
    
    # 視覺化結果
    print("📊 生成視覺化圖表...")
    visualize_results(df_analysis, feature_columns, output_dir)
    
    # 儲存結果
    df_analysis.to_csv(output_dir / "dbscan_results.csv", index=False, encoding='utf-8-sig')
    
    # 儲存參數調優結果
    results_df = pd.DataFrame(results)
    results_df.to_csv(output_dir / "parameter_tuning_results.csv", index=False)
    
    print(f"💾 結果已儲存至: {output_dir}")
    print("📁 輸出檔案:")
    print("   • dbscan_results.csv - 完整分析結果")
    print("   • parameter_tuning_results.csv - 參數調優結果")
    print("   • dbscan_clusters.png - 聚類視覺化")
    print("   • cluster_features_heatmap.png - 特徵熱圖")

if __name__ == "__main__":
    main()
