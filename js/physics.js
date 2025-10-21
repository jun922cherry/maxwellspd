// 统一物理常数与速率计算模块（Single Source of Truth）
// 提供：常数、特征速率计算、速度域转换（m/s -> px/frame）

export const PHYSICS_CONSTANTS = {
  k: 1.38064852e-23,  // 玻尔兹曼常数 J/K
  R: 8.314,           // 气体常数 J/(mol·K)
  NA: 6.02214076e23   // 阿伏伽德罗常数 mol^-1
};

// 像素域速度缩放（可根据需要统一调参）
let SPEED_SCALE = 0.0075; // 进一步降低缩放，减小每步位移，降低数值耗散（长时间运行更稳）

export function setSpeedScale(scale) {
  if (Number.isFinite(scale) && scale > 0) SPEED_SCALE = scale;
}

export function getSpeedScale() { return SPEED_SCALE; }

// 2D 瑞利分布参数 σ（m/s），满足 σ^2 = kT/m
export function calculateSigma2D(temperature, molarMass) {
  const T = Number.isFinite(temperature) ? temperature : 300;
  const M_kg_per_mol = (Number.isFinite(molarMass) ? molarMass : 28.0134) / 1000;
  const m = M_kg_per_mol / PHYSICS_CONSTANTS.NA; // 单分子质量 kg
  const sigma_ms = Math.sqrt(PHYSICS_CONSTANTS.k * T / m);
  return sigma_ms;
}

export function mapTemperatureToPixelSigma2D(temperature, molarMass) {
  return convertMsToPxFrame(calculateSigma2D(temperature, molarMass));
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
  return v_ms * SPEED_SCALE;
}

// 基于温度和摩尔质量，返回像素域的最概然速率
export function mapTemperatureToPixelVp(temperature, molarMass) {
  const { vp } = calculateCharacteristicSpeeds(temperature, molarMass);
  return convertMsToPxFrame(vp);
}

// 暴露到全局以便非模块脚本访问（同时保持ESM导出）
if (typeof window !== 'undefined') {
  window.PHYSICS = {
    CONSTANTS: PHYSICS_CONSTANTS,
    calculateCharacteristicSpeeds,
    calculateSigma2D,
    convertMsToPxFrame,
    mapTemperatureToPixelVp,
    mapTemperatureToPixelSigma2D,
    setSpeedScale,
    getSpeedScale
  };
}