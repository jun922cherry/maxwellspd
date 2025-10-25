// 直方图工具函数 - 用于计算模拟值和熵
import { getSpeedDistributionHistogram, getSmoothedHistogram } from './histogram.js';
import { pixelsPerFrameToMetersPerSecond } from '../physics.js';

/**
 * 计算模拟的最概然速率 (Vp)
 * @param {Array<{x:number,y:number}>} smoothedHistogramData - 平滑后的直方图数据
 * @returns {number} 最概然速率 (m/s)
 */
export function calculateSimulatedVp(smoothedHistogramData) {
  try {
    if (!Array.isArray(smoothedHistogramData) || smoothedHistogramData.length === 0) {
      return null;
    }
    
    // 找到概率密度最高的点
    let maxDensityPoint = smoothedHistogramData[0];
    for (const point of smoothedHistogramData) {
      if (point.y > maxDensityPoint.y) {
        maxDensityPoint = point;
      }
    }
    
    // 转换为物理单位 (m/s)
    return pixelsPerFrameToMetersPerSecond(maxDensityPoint.x);
  } catch (e) {
    console.warn('[calculateSimulatedVp] failed:', e);
    return null;
  }
}

/**
 * 计算分布熵 (Distribution Entropy)
 * @param {Array<{x:number,y:number}>} smoothedHistogramData - 平滑后的直方图数据
 * @param {number} totalParticles - 粒子总数
 * @returns {number} 归一化后的熵值 (0-1)
 */
export function calculateDistributionEntropy(smoothedHistogramData, totalParticles) {
  try {
    if (!Array.isArray(smoothedHistogramData) || smoothedHistogramData.length === 0) {
      return null;
    }
    
    // 计算总概率（应该接近1，但为了确保归一化）
    let totalProbability = 0;
    for (const point of smoothedHistogramData) {
      if (point.y > 0) {
        totalProbability += point.y;
      }
    }
    
    if (totalProbability <= 0) {
      return 0;
    }
    
    // 计算香农熵 S = -∑(p_i * ln p_i)
    let entropy = 0;
    for (const point of smoothedHistogramData) {
      if (point.y > 0) {
        // 归一化概率
        const p = point.y / totalProbability;
        entropy -= p * Math.log(p);
      }
    }
    
    // 归一化熵值 (除以ln(bins数量))
    const maxEntropy = Math.log(smoothedHistogramData.length);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
    
    return normalizedEntropy;
  } catch (e) {
    console.warn('[calculateDistributionEntropy] failed:', e);
    return null;
  }
}