// 温控器特性插件：在指定周期对速度进行重标定以维持目标动能或温度
import Matter from '../lib/matter.js';
import { getKineticEnergy } from '../energy/metrics.js';

/**
 * Thermostat 插件状态与配置
 */
function defaultConfig() {
  return {
    enabled: false,
    intervalMs: 1000,
    targetEnergy: null, // 若为 null 则不强制总动能
    perParticleMass: 1,
  };
}

export function setup(engine, config = {}) {
  const Composite = Matter.Composite;
  const Runner = Matter.Runner;
  const Events = Matter.Events;

  const state = { ...defaultConfig(), ...config, lastAt: 0 };
  engine.plugins = engine.plugins || {};
  engine.plugins.thermostat = { state };

  const rescale = () => {
    const bodies = Composite.allBodies(engine).filter(b => !b.isStatic);
    if (!bodies.length) return;
    if (!state.enabled) return;

    const currentEk = getKineticEnergy(bodies, state.perParticleMass);
    if (state.targetEnergy && state.targetEnergy > 0 && currentEk > 0) {
      const factor = Math.sqrt(state.targetEnergy / currentEk);
      for (const b of bodies) {
        b.velocity.x *= factor;
        b.velocity.y *= factor;
      }
    }
  };

  Events.on(engine, 'afterUpdate', (evt) => {
    const t = (Runner.timestamp || 0);
    const now = performance.now();
    if (now - state.lastAt >= state.intervalMs) {
      state.lastAt = now;
      rescale();
    }
  });

  return engine.plugins.thermostat;
}