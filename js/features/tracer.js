// 单粒子追踪特性插件：支持点击选择、位移/碰撞统计、渲染覆盖
import Matter from '../lib/matter.js';

function defaultConfig() {
  return {
    enabled: true,
    highlightColor: '#ff7043',
    showTrail: true,
    maxTrail: 200,
  };
}

export function setup(engine, config = {}) {
  const Events = Matter.Events;
  const Composite = Matter.Composite;

  const state = { ...defaultConfig(), ...config, tracer: null, trail: [] };
  engine.plugins = engine.plugins || {};
  engine.plugins.tracer = { state };

  // 简化：外部通过 setTracer(body) 指定要追踪的粒子
  const api = {
    setTracer(body) {
      state.tracer = body;
      state.trail = [];
    },
    getState() { return { ...state }; }
  };
  engine.plugins.tracer.api = api;

  Events.on(engine, 'afterUpdate', () => {
    if (!state.enabled || !state.tracer) return;
    const p = state.tracer;
    state.trail.push({ x: p.position.x, y: p.position.y });
    if (state.trail.length > state.maxTrail) state.trail.shift();
  });

  return engine.plugins.tracer;
}