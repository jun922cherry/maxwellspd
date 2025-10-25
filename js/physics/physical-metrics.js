// 物理量计算函数模块
// 负责计算模拟中的物理量，使用物理单位

import { PHYSICS_CONSTANTS, pixelsPerFrameToMetersPerSecond, pixelsToMeters } from '../physics.js';

/**
 * 计算有效温度
 * @param {Array} particles - 粒子数组
 * @param {number} molarMass - 摩尔质量(g/mol)
 * @returns {number} 有效温度(K)
 */
export function calculateEffectiveTemperature(particles, molarMass) {
  if (!Array.isArray(particles) || particles.length === 0) {
    return null;
  }
  
  // 计算单个分子质量(kg)
  const M_kg_per_mol = (Number.isFinite(molarMass) ? molarMass : 28.0134) / 1000;
  const m = M_kg_per_mol / PHYSICS_CONSTANTS.NA;
  
  // 计算平均动能
  let totalKE = 0;
  for (const p of particles) {
    // 获取粒子速度(px/frame)
    const vx = (p.velocity?.x ?? p.vx ?? 0);
    const vy = (p.velocity?.y ?? p.vy ?? 0);
    
    // 转换为物理速度(m/s)
    const vx_ms = pixelsPerFrameToMetersPerSecond(vx);
    const vy_ms = pixelsPerFrameToMetersPerSecond(vy);
    
    // 计算动能 E = 0.5 * m * v^2
    const v_squared = vx_ms * vx_ms + vy_ms * vy_ms;
    const ke = 0.5 * m * v_squared;
    
    totalKE += ke;
  }
  
  // 计算平均动能
  const avgKE = totalKE / particles.length;
  
  // 使用二维系统的能量均分定理: <E> = kT
  // 对于二维系统，每个粒子有2个自由度，每个自由度贡献0.5kT的能量
  // 因此 T = <E>/k
  const T_eff = avgKE / PHYSICS_CONSTANTS.k;
  
  return T_eff;
}

/**
 * 计算总动能
 * @param {Array} particles - 粒子数组
 * @param {number} molarMass - 摩尔质量(g/mol)
 * @returns {number} 总动能(J)
 */
export function calculateTotalKineticEnergy(particles, molarMass) {
  if (!Array.isArray(particles) || particles.length === 0) {
    return null;
  }
  
  // 计算单个分子质量(kg)
  const M_kg_per_mol = (Number.isFinite(molarMass) ? molarMass : 28.0134) / 1000;
  const m = M_kg_per_mol / PHYSICS_CONSTANTS.NA;
  
  // 计算总动能
  let totalKE = 0;
  for (const p of particles) {
    // 获取粒子速度(px/frame)
    const vx = (p.velocity?.x ?? p.vx ?? 0);
    const vy = (p.velocity?.y ?? p.vy ?? 0);
    
    // 转换为物理速度(m/s)
    const vx_ms = pixelsPerFrameToMetersPerSecond(vx);
    const vy_ms = pixelsPerFrameToMetersPerSecond(vy);
    
    // 计算动能 E = 0.5 * m * v^2
    const v_squared = vx_ms * vx_ms + vy_ms * vy_ms;
    const ke = 0.5 * m * v_squared;
    
    totalKE += ke;
  }
  
  return totalKE;
}

/**
 * 计算平均动能
 * @param {Array} particles - 粒子数组
 * @param {number} molarMass - 摩尔质量(g/mol)
 * @returns {number} 平均动能(J)
 */
export function calculateAverageKineticEnergy(particles, molarMass) {
  if (!Array.isArray(particles) || particles.length === 0) {
    return null;
  }
  
  const totalKE = calculateTotalKineticEnergy(particles, molarMass);
  return totalKE / particles.length;
}

/**
 * 计算模拟的平均自由程
 * @param {Object} tracerData - 追踪数据
 * @returns {number} 平均自由程(m)
 */
export function calculateSimulatedMeanFreePath(tracerData) {
  if (!tracerData || typeof tracerData.meanFreePath !== 'number') {
    return null;
  }
  
  // 转换为物理单位(m)
  return pixelsToMeters(tracerData.meanFreePath);
}

// 导出所有函数
export default {
  calculateEffectiveTemperature,
  calculateTotalKineticEnergy,
  calculateAverageKineticEnergy,
  calculateSimulatedMeanFreePath
};