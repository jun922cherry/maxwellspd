// 统一物理常数与速率计算模块（Single Source of Truth）
// 提供：常数、特征速率计算、速度域转换（m/s -> px/frame）

export const PHYSICS_CONSTANTS = {
  k: 1.38064852e-23,  // 玻尔兹曼常数 J/K
  R: 8.314,           // 气体常数 J/(mol·K)
  NA: 6.02214076e23,  // 阿伏伽德罗常数 mol^-1
  
  // 气体摩尔质量 (g/mol)
  MOLAR_MASSES: {
    H2: 2.0079,       // 氢气
    He: 4.0026,       // 氦气
    N2: 28.0134,      // 氮气
    O2: 31.9988,      // 氧气
    CO2: 44.01        // 二氧化碳
  }
};

// 像素域速度缩放（可根据需要统一调参）
let SPEED_SCALE = 0.0075; // 进一步降低缩放，减小每步位移，降低数值耗散（长时间运行更稳）

// 空间和时间换算因子
export let PIXELS_PER_METER = 1 / SPEED_SCALE; // 每米对应的像素数
export let SECONDS_PER_FRAME = 1 / 60; // 每帧对应的秒数，默认60fps

// 设置时间步长
export function setSecondsPerFrame(seconds) {
  if (Number.isFinite(seconds) && seconds > 0) {
    SECONDS_PER_FRAME = seconds;
  }
}

// 更新时间步长（基于引擎时间步长和时间尺度）
export function updateSecondsPerFrame(engineDelta, timeScale) {
  SECONDS_PER_FRAME = (engineDelta / 1000) * (timeScale || 1);
}

export function setSpeedScale(scale) {
  if (Number.isFinite(scale) && scale > 0) {
    SPEED_SCALE = scale;
    // 更新空间换算因子
    PIXELS_PER_METER = 1 / SPEED_SCALE;
  }
}

export function getSpeedScale() { return SPEED_SCALE; }

/**
 * 将物理速度（m/s）转换为像素速度（px/frame）
 * @param {number} v_ms - 物理速度 (m/s)
 * @returns {number} 像素速度 (px/frame)
 */
export function metersPerSecondToPixelsPerFrame(v_ms) {
  return v_ms * SPEED_SCALE;
}

/**
 * 将像素速度（px/frame）转换为物理速度（m/s）
 * @param {number} v_px_frame - 像素速度 (px/frame)
 * @returns {number} 物理速度 (m/s)
 */
export function pixelsPerFrameToMetersPerSecond(v_px_frame) {
  return v_px_frame / SPEED_SCALE;
}

/**
 * 将像素距离转换为物理距离（米）
 * @param {number} distance_px - 像素距离
 * @returns {number} 物理距离 (m)
 */
export function pixelsToMeters(distance_px) {
  return distance_px / PIXELS_PER_METER;
}

/**
 * 将物理距离（米）转换为像素距离
 * @param {number} distance_m - 物理距离 (m)
 * @returns {number} 像素距离
 */
export function metersToPixels(distance_m) {
  return distance_m * PIXELS_PER_METER;
}

// 2D 瑞利分布参数 σ（m/s），满足 σ^2 = kT/m
export function calculateSigma2D(temperature, molarMass) {
  const T = Number.isFinite(temperature) ? temperature : 300;
  const M_kg_per_mol = (Number.isFinite(molarMass) ? molarMass : 28.0134) / 1000;
  const m = M_kg_per_mol / PHYSICS_CONSTANTS.NA; // 单分子质量 kg
  const sigma_ms = Math.sqrt(PHYSICS_CONSTANTS.k * T / m);
  return sigma_ms;
}

export function mapTemperatureToPixelSigma2D(temperature, molarMass) {
  return metersPerSecondToPixelsPerFrame(calculateSigma2D(temperature, molarMass));
}

// 计算特征速率（m/s）
export function calculateCharacteristicSpeeds(temperature, molarMass) {
  const M = (Number.isFinite(molarMass) ? molarMass : 28.0134) / 1000; // kg/mol
  const T = Number.isFinite(temperature) ? temperature : 300;
  const vp = Math.sqrt(2 * PHYSICS_CONSTANTS.R * T / M);
  const vavg = Math.sqrt(8 * PHYSICS_CONSTANTS.R * T / (Math.PI * M));
  const vrms = Math.sqrt(3 * PHYSICS_CONSTANTS.R * T / M);
  return { vp, vavg, vrms };
}

// 将物理速度（m/s）转换为像素速度（px/frame）
export function convertMsToPxFrame(v_ms) {
  return metersPerSecondToPixelsPerFrame(v_ms);
}

// 基于温度和摩尔质量，返回像素域的最概然速率
export function mapTemperatureToPixelVp(temperature, molarMass) {
  const { vp } = calculateCharacteristicSpeeds(temperature, molarMass);
  return metersPerSecondToPixelsPerFrame(vp);
}

// 暴露到全局以便非模块脚本访问（同时保持ESM导出）
if (typeof window !== 'undefined') {
  window.PHYSICS = {
    CONSTANTS: PHYSICS_CONSTANTS,
    PIXELS_PER_METER,
    SECONDS_PER_FRAME,
    calculateCharacteristicSpeeds,
    calculateSigma2D,
    metersPerSecondToPixelsPerFrame,
    pixelsPerFrameToMetersPerSecond,
    pixelsToMeters,
    metersToPixels,
    convertMsToPxFrame,
    mapTemperatureToPixelVp,
    mapTemperatureToPixelSigma2D,
    setSpeedScale,
    getSpeedScale,
    setSecondsPerFrame,
    updateSecondsPerFrame
  };
}