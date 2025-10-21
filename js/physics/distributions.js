// 速度分布生成器（纯函数版）
// 将 temperature (K) 与 molarMass (g/mol) 明确作为输入，移除任何 DOM/全局依赖。
import { calculateCharacteristicSpeeds, convertMsToPxFrame } from '../physics.js';

// Maxwell-Boltzmann 近似：二维速度分量服从正态，速率峰值 vp 由物理模块计算
export function generateMaxwellVelocity(temperature, molarMass) {
  const { vp } = calculateCharacteristicSpeeds(
    Number.isFinite(temperature) ? temperature : 300,
    Number.isFinite(molarMass) ? molarMass : 28.0134
  );
  const speed = convertMsToPxFrame(vp);
  // Box-Muller 生成正态分布分量
  const u1 = Math.random() || 1e-12;
  const u2 = Math.random();
  const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
  const speedStd = speed / Math.sqrt(2);
  return { vx: z1 * speedStd, vy: z2 * speedStd };
}

// 单速率分布：所有粒子速率相同，方向均匀随机
export function generateSingleSpeedVelocity(temperature, molarMass) {
  const { vp } = calculateCharacteristicSpeeds(
    Number.isFinite(temperature) ? temperature : 300,
    Number.isFinite(molarMass) ? molarMass : 28.0134
  );
  const speed = convertMsToPxFrame(vp);
  const theta = Math.random() * 2 * Math.PI;
  return { vx: speed * Math.cos(theta), vy: speed * Math.sin(theta) };
}

// 双速率分布：以 0.6*vp 与 1.6*vp 两簇为例，权重各 50%
export function generateDualSpeedVelocity(temperature, molarMass) {
  const { vp } = calculateCharacteristicSpeeds(
    Number.isFinite(temperature) ? temperature : 300,
    Number.isFinite(molarMass) ? molarMass : 28.0134
  );
  const s1 = convertMsToPxFrame(vp * 0.6);
  const s2 = convertMsToPxFrame(vp * 1.6);
  const theta = Math.random() * 2 * Math.PI;
  const speed = (Math.random() < 0.5) ? s1 : s2;
  return { vx: speed * Math.cos(theta), vy: speed * Math.sin(theta) };
}