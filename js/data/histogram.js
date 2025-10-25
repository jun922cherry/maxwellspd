// 速度直方图（纯函数版）
// 输入：particles[], temperature(K), molarMass(g/mol)
// 输出：[{x, y}]，x为分箱中心速度（px/frame），y为计数或概率密度
import { mapTemperatureToPixelSigma2D } from '../physics.js';

/**
 * 统计速度直方图（计数版）
 * @param {Array} particles - Matter Bodies 粒子数组（需具备 velocity.x/velocity.y 或 vx/vy）
 * @param {number} temperature - 温度(K)
 * @param {number} molarMass - 摩尔质量(g/mol)
 * @param {Object} options - { binCount: number, maxFactor: number }
 * @returns {Array<{x:number,y:number}>}
 */
export function getSpeedDistributionHistogram(particles, temperature, molarMass, options = {}) {
  try {
    const FIXED_BIN_COUNT = Number.isFinite(options.binCount) ? options.binCount : 60;
    const MAX_FACTOR = Number.isFinite(options.maxFactor) ? options.maxFactor : 4;
    const sigmaPx = mapTemperatureToPixelSigma2D(
      Number.isFinite(temperature) ? temperature : 300,
      Number.isFinite(molarMass) ? molarMass : 28
    );
    const maxSpeed = Math.max(10, sigmaPx * MAX_FACTOR);
    const binSize = maxSpeed / FIXED_BIN_COUNT;
    const bins = new Array(FIXED_BIN_COUNT).fill(0);
    for (const p of (Array.isArray(particles) ? particles : [])) {
      const vx = (p.velocity?.x ?? p.vx ?? 0);
      const vy = (p.velocity?.y ?? p.vy ?? 0);
      const speed = Math.sqrt(vx * vx + vy * vy);
      let idx = Math.floor(speed / binSize);
      if (idx < 0) idx = 0;
      if (idx >= bins.length) idx = bins.length - 1;
      bins[idx]++;
    }
    return bins.map((count, i) => ({ x: (i + 0.5) * binSize, y: count }));
  } catch (e) {
    console.warn('[Histogram] failed:', e);
    return [];
  }
}

/**
 * 时间平滑后的概率密度直方图
 * @param {Array<Array<{x:number,y:number}>>} history - 历史帧队列（每帧为计数直方图）
 * @param {Array} particles - 当前粒子数组（用于归一化 N）
 * @param {number} alpha - EMA 平滑系数，默认 0.3
 * @returns {Array<{x:number,y:number}>}
 */
export function getSmoothedHistogram(history, particles, alpha = 0.3) {
  try {
    const frames = Array.isArray(history) ? history.length : 0;
    if (frames === 0) return [];
    const template = history[frames - 1] || [];
    const numBins = template.length;
    if (numBins === 0) return [];

    let binWidth = 0;
    if (numBins > 1) {
      const dx = Math.abs((template[1]?.x || 0) - (template[0]?.x || 0));
      binWidth = Number.isFinite(dx) && dx > 0 ? dx : 0;
    }

    // 归一化权重
    const weights = new Array(frames).fill(0);
    let wsum = 0;
    for (let f = 0; f < frames; f++) {
      const w = alpha * Math.pow(1 - alpha, frames - 1 - f);
      weights[f] = w; wsum += w;
    }

    const ewmaCounts = new Array(numBins).fill(0);
    for (let f = 0; f < frames; f++) {
      const frame = history[f] || [];
      const wf = (wsum > 0 ? (weights[f] / wsum) : 0);
      for (let i = 0; i < numBins; i++) {
        const c = frame[i]?.y ?? 0;
        ewmaCounts[i] += wf * c;
      }
    }

    const N = Array.isArray(particles) ? particles.length : 0;
    const density = new Array(numBins).fill(0);
    const normDenom = (N > 0 && binWidth > 0) ? (N * binWidth) : 0;
    for (let i = 0; i < numBins; i++) {
      const pd = normDenom > 0 ? (ewmaCounts[i] / normDenom) : 0;
      density[i] = pd;
    }

    return new Array(numBins).fill(0).map((_, i) => ({
      x: template[i]?.x ?? (i + 0.5) * (binWidth || 1),
      y: density[i]
    }));
  } catch (e) {
    console.warn('[Histogram Smooth] failed:', e);
    return [];
  }
}