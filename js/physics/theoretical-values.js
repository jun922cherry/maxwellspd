// 理论值计算函数模块
// 负责计算各种物理量的理论值，用于与模拟值对比

import { PHYSICS_CONSTANTS, pixelsToMeters } from '../physics.js';

/**
 * 计算理论熵值（基于Maxwell分布的理论熵）
 * @param {number} temperature - 温度(K)
 * @param {number} molarMass - 摩尔质量(g/mol)
 * @returns {number} 理论熵值（归一化后，无单位）
 */
export function calculateTheoreticalEntropy(temperature, molarMass) {
  // Maxwell分布的理论熵是一个常数（对于给定的分箱数）
  // 这里返回一个接近1的值，因为完美的Maxwell分布应该有较高的熵
  return 0.95;
}

/**
 * 计算理论温度值
 * @param {number} temperature - 设定温度(K)
 * @returns {number} 理论温度值(K)
 */
export function calculateTheoreticalTemperature(temperature) {
  // 理论上，模拟的有效温度应该等于设定温度
  return temperature;
}

/**
 * 计算理论粒子数
 * @param {number} particleCount - 设定的粒子数
 * @returns {number} 理论粒子数(个)
 */
export function calculateTheoreticalParticleCount(particleCount) {
  // 理论上，模拟中的粒子数应该等于设定的粒子数
  return particleCount;
}

/**
 * 计算理论总动能
 * @param {number} temperature - 温度(K)
 * @param {number} particleCount - 粒子数
 * @returns {number} 理论总动能(J)
 */
export function calculateTheoreticalTotalKineticEnergy(temperature, particleCount) {
  // 根据能量均分定理，每个自由度平均有1/2kT的能量
  // 2D系统中每个粒子有2个自由度，总动能为N*kT
  return particleCount * PHYSICS_CONSTANTS.k * temperature;
}

/**
 * 计算理论平均动能
 * @param {number} temperature - 温度(K)
 * @returns {number} 理论平均动能(J)
 */
export function calculateTheoreticalAverageKineticEnergy(temperature) {
  // 每个粒子的平均动能为kT
  return PHYSICS_CONSTANTS.k * temperature;
}

/**
 * 计算理论相对压强
 * @param {number} temperature - 温度(K)
 * @param {number} particleCount - 粒子数
 * @param {number} area - 容器面积（像素^2）
 * @returns {number} 理论相对压强(相对值)
 */
export function calculateTheoreticalPressure(temperature, particleCount, area) {
  // 理想气体状态方程：P = NkT/V（2D中为P = NkT/A）
  // 这里返回相对单位的值
  const baseTemp = 300; // 基准温度(K)
  const baseCount = 300; // 基准粒子数
  
  return (particleCount * temperature) / (baseCount * baseTemp);
}

/**
 * 计算理论时间尺度
 * @returns {number} 理论时间尺度(x)
 */
export function calculateTheoreticalTimeScale() {
  // 理论时间尺度通常是固定的，这里返回默认值
  return 1.0;
}

/**
 * 计算理论平均自由程
 * @param {number} temperature - 温度(K)
 * @param {number} molarMass - 摩尔质量(g/mol)
 * @param {number} particleCount - 粒子数
 * @param {number} particleRadius - 粒子半径（像素）
 * @param {number} area - 容器面积（像素^2）
 * @returns {number} 理论平均自由程(m)
 */
export function calculateTheoreticalMeanFreePath(temperature, molarMass, particleCount, particleRadius, area) {
  // 平均自由程公式：λ = 1/(√2 * π * n * d^2)
  // 其中n是单位面积粒子数，d是粒子直径
  
  const n = particleCount / area; // 单位像素面积粒子数
  const d = 2 * particleRadius; // 粒子直径（像素）
  
  // 计算像素单位的平均自由程
  const mfp_px = 1 / (Math.sqrt(2) * Math.PI * n * d * d);
  
  // 转换为物理单位(m)
  return pixelsToMeters(mfp_px);
}

// 导出所有函数
export default {
  calculateTheoreticalEntropy,
  calculateTheoreticalTemperature,
  calculateTheoreticalParticleCount,
  calculateTheoreticalTotalKineticEnergy,
  calculateTheoreticalAverageKineticEnergy,
  calculateTheoreticalPressure,
  calculateTheoreticalTimeScale,
  calculateTheoreticalMeanFreePath
};