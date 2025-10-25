// 能量与速度指标工具函数
import { getKineticEnergy } from './metrics.js';
import { pixelsPerFrameToMetersPerSecond } from '../physics.js';

/**
 * 计算模拟的方均根速率 (Vrms)
 * @param {Array} particles - 粒子数组
 * @returns {number} 方均根速率 (m/s)
 */
export function calculateSimulatedVrms(particles) {
  try {
    if (!Array.isArray(particles) || particles.length === 0) {
      return null;
    }
    
    let sumSquaredSpeeds = 0;
    let count = 0;
    
    for (const p of particles) {
      const vx = (p.velocity?.x ?? p.vx ?? 0);
      const vy = (p.velocity?.y ?? p.vy ?? 0);
      const speedSquared = vx * vx + vy * vy;
      sumSquaredSpeeds += speedSquared;
      count++;
    }
    
    if (count === 0) {
      return null;
    }
    
    // 方均根速率 = sqrt(平均速度平方)
    const vrms_px_frame = Math.sqrt(sumSquaredSpeeds / count);
    
    // 转换为物理单位 (m/s)
    return pixelsPerFrameToMetersPerSecond(vrms_px_frame);
  } catch (e) {
    console.warn('[calculateSimulatedVrms] failed:', e);
    return null;
  }
}