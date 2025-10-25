// 能量与速度重标定（纯函数版）
// 支持输入 engine 或 bodies 数组，移除 DOM/全局依赖。

/**
 * 计算系统总动能（px/frame 度量下的近似）
 * @param {Array} bodies - 粒子数组，或 Matter.Composite.allBodies(engine) 的过滤结果
 * @param {number} massPerParticle - 每个粒子的质量（px制下的等效质量，或以 kg 为单位后统一换算）
 * @returns {number} kinetic energy
 */
export function getKineticEnergy(bodies, massPerParticle = 1) {
  let total = 0;
  const arr = Array.isArray(bodies) ? bodies : [];
  for (const b of arr) {
    const vx = (b.velocity?.x ?? b.vx ?? 0);
    const vy = (b.velocity?.y ?? b.vy ?? 0);
    total += 0.5 * massPerParticle * (vx * vx + vy * vy);
  }
  return total;
}

/**
 * 为新的气体类型重标定所有粒子速度（保持总动能不变或按指定规则缩放）
 * @param {Array} bodies - 粒子数组
 * @param {number} molarMassOld - 旧摩尔质量
 * @param {number} molarMassNew - 新摩尔质量
 * @param {Object} options - { conserveKineticEnergy: boolean }
 */
export function rescaleParticleVelocitiesForNewGas(bodies, molarMassOld, molarMassNew, options = {}) {
  const conserve = options.conserveKineticEnergy ?? true;
  const arr = Array.isArray(bodies) ? bodies : [];
  if (arr.length === 0) return;
  const factor = (() => {
    if (!conserve) return 1;
    // 简化：质量成比例 -> 速度按 sqrt(m_old/m_new) 缩放以保持 E_k ~ m v^2 总和不变
    const mOld = Number.isFinite(molarMassOld) ? molarMassOld : 28;
    const mNew = Number.isFinite(molarMassNew) ? molarMassNew : 28;
    if (mOld <= 0 || mNew <= 0) return 1;
    return Math.sqrt(mOld / mNew);
  })();
  for (const b of arr) {
    const vx = (b.velocity?.x ?? b.vx ?? 0) * factor;
    const vy = (b.velocity?.y ?? b.vy ?? 0) * factor;
    if (b.velocity) {
      b.velocity.x = vx; b.velocity.y = vy;
    } else {
      b.vx = vx; b.vy = vy;
    }
  }
}