/**
 * K-NN 色彩分類器
 * 使用 K-Nearest Neighbors 演算法進行色光分類
 */

export interface TrainingDataPoint {
  features: number[]; // [R, G, B, H, S, V, K]
  className: string;
  label?: string; // 原始圖片名稱（可選）
}

export interface ClassificationResult {
  className: string;
  confidence: number; // 0-1 之間
  nearestNeighbors: {
    className: string;
    distance: number;
  }[];
}

/**
 * 特徵標準化器（Z-score 標準化）
 */
class FeatureScaler {
  private means: number[] = [];
  private stds: number[] = [];
  private fitted: boolean = false;

  /**
   * 使用訓練資料計算平均值和標準差
   */
  fit(data: number[][]): void {
    if (data.length === 0) return;

    const numFeatures = data[0].length;
    this.means = new Array(numFeatures).fill(0);
    this.stds = new Array(numFeatures).fill(0);

    // 計算平均值
    for (const row of data) {
      for (let i = 0; i < numFeatures; i++) {
        this.means[i] += row[i];
      }
    }
    this.means = this.means.map(sum => sum / data.length);

    // 計算標準差
    for (const row of data) {
      for (let i = 0; i < numFeatures; i++) {
        this.stds[i] += Math.pow(row[i] - this.means[i], 2);
      }
    }
    this.stds = this.stds.map(sum => Math.sqrt(sum / data.length));

    // 避免除以零
    this.stds = this.stds.map(std => std === 0 ? 1 : std);

    this.fitted = true;
  }

  /**
   * 標準化特徵
   */
  transform(features: number[]): number[] {
    if (!this.fitted) {
      throw new Error('Scaler not fitted. Call fit() first.');
    }

    return features.map((value, index) => {
      return (value - this.means[index]) / this.stds[index];
    });
  }

  /**
   * 反標準化（還原原始尺度）
   */
  inverseTransform(scaledFeatures: number[]): number[] {
    if (!this.fitted) {
      throw new Error('Scaler not fitted. Call fit() first.');
    }

    return scaledFeatures.map((value, index) => {
      return value * this.stds[index] + this.means[index];
    });
  }

  /**
   * 獲取標準化參數
   */
  getParams(): { means: number[]; stds: number[] } {
    return { means: [...this.means], stds: [...this.stds] };
  }

  /**
   * 設定標準化參數（用於從外部載入）
   */
  setParams(means: number[], stds: number[]): void {
    this.means = [...means];
    this.stds = [...stds];
    this.fitted = true;
  }
}

/**
 * K-NN 分類器
 */
export class KNNClassifier {
  private trainingData: TrainingDataPoint[] = [];
  private scaler: FeatureScaler = new FeatureScaler();
  private k: number = 3; // K 值（最近鄰數量）
  private isTrained: boolean = false;

  constructor(k: number = 3) {
    this.k = k;
  }

  /**
   * 訓練分類器
   */
  train(data: TrainingDataPoint[]): void {
    if (data.length === 0) {
      throw new Error('訓練資料不能為空');
    }

    // 儲存訓練資料
    this.trainingData = data.map(d => ({ ...d }));

    // 擬合標準化器
    const features = data.map(d => d.features);
    this.scaler.fit(features);

    // 標準化訓練資料
    this.trainingData.forEach(d => {
      d.features = this.scaler.transform(d.features);
    });

    this.isTrained = true;

    console.log(`✅ K-NN 分類器訓練完成：${data.length} 筆訓練資料，K=${this.k}`);
  }

  /**
   * 計算歐氏距離
   */
  private euclideanDistance(features1: number[], features2: number[]): number {
    if (features1.length !== features2.length) {
      throw new Error('特徵維度不匹配');
    }

    let sum = 0;
    for (let i = 0; i < features1.length; i++) {
      sum += Math.pow(features1[i] - features2[i], 2);
    }

    return Math.sqrt(sum);
  }

  /**
   * 預測單一樣本
   */
  predict(features: number[]): ClassificationResult {
    if (!this.isTrained) {
      throw new Error('分類器尚未訓練。請先呼叫 train() 方法。');
    }

    // 標準化輸入特徵
    const scaledFeatures = this.scaler.transform(features);

    // 計算與所有訓練樣本的距離
    const distances = this.trainingData.map(trainPoint => ({
      className: trainPoint.className,
      distance: this.euclideanDistance(scaledFeatures, trainPoint.features),
      label: trainPoint.label
    }));

    // 按距離排序
    distances.sort((a, b) => a.distance - b.distance);

    // 取前 K 個最近鄰
    const kNearest = distances.slice(0, this.k);

    // 投票：使用距離倒數加權
    const votes: { [className: string]: number } = {};
    let totalWeight = 0;

    for (const neighbor of kNearest) {
      // 距離倒數加權（避免除以零）
      const weight = 1 / (neighbor.distance + 1e-6);
      votes[neighbor.className] = (votes[neighbor.className] || 0) + weight;
      totalWeight += weight;
    }

    // 找出得票最高的類別
    let maxVotes = 0;
    let predictedClass = '';

    for (const [className, voteCount] of Object.entries(votes)) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        predictedClass = className;
      }
    }

    // 計算信心度（該類別的加權票數 / 總加權票數）
    const confidence = maxVotes / totalWeight;

    return {
      className: predictedClass,
      confidence: confidence,
      nearestNeighbors: kNearest.map(n => ({
        className: n.className,
        distance: n.distance
      }))
    };
  }

  /**
   * 批次預測
   */
  predictBatch(featuresList: number[][]): ClassificationResult[] {
    return featuresList.map(features => this.predict(features));
  }

  /**
   * 取得訓練資料數量
   */
  getTrainingDataCount(): number {
    return this.trainingData.length;
  }

  /**
   * 取得訓練狀態
   */
  isModelTrained(): boolean {
    return this.isTrained;
  }

  /**
   * 取得所有類別
   */
  getClasses(): string[] {
    const classes = new Set(this.trainingData.map(d => d.className));
    return Array.from(classes);
  }

  /**
   * 匯出模型（用於儲存）
   */
  exportModel(): {
    trainingData: TrainingDataPoint[];
    scalerParams: { means: number[]; stds: number[] };
    k: number;
  } {
    return {
      trainingData: this.trainingData.map(d => ({ ...d })),
      scalerParams: this.scaler.getParams(),
      k: this.k
    };
  }

  /**
   * 匯入模型（用於載入）
   */
  importModel(model: {
    trainingData: TrainingDataPoint[];
    scalerParams: { means: number[]; stds: number[] };
    k: number;
  }): void {
    this.trainingData = model.trainingData.map(d => ({ ...d }));
    this.scaler.setParams(model.scalerParams.means, model.scalerParams.stds);
    this.k = model.k;
    this.isTrained = true;

    console.log(`✅ K-NN 分類器載入完成：${this.trainingData.length} 筆訓練資料，K=${this.k}`);
  }

  /**
   * 清空分類器
   */
  clear(): void {
    this.trainingData = [];
    this.scaler = new FeatureScaler();
    this.isTrained = false;
  }
}

/**
 * 建立全域分類器實例（單例模式）
 */
let globalClassifier: KNNClassifier | null = null;

/**
 * 取得全域分類器
 */
export function getGlobalClassifier(): KNNClassifier {
  if (!globalClassifier) {
    globalClassifier = new KNNClassifier(3);
  }
  return globalClassifier;
}

/**
 * 重置全域分類器
 */
export function resetGlobalClassifier(): void {
  globalClassifier = null;
}

