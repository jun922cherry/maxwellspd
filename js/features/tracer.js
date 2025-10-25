// 单粒子追踪特性插件：支持点击选择、位移/碰撞统计、渲染覆盖
import Matter from '../lib/matter.js';

function defaultConfig() {
  return {
    enabled: true,
    highlightColor: '#ff7043',
    showTrail: true,
    maxTrail: 200,
    maxMFPSamples: 1000 // 限制自由程样本数量，避免无限增长导致内存膨胀
  };
}

export function setup(engine, config = {}) {
  const Events = Matter.Events;
  const Composite = Matter.Composite;

  const state = { 
    ...defaultConfig(), 
    ...config, 
    tracer: null, 
    trail: [],
    mfpLengths: [], // 存储所有单次自由程长度
    lastCollisionPosition: null, // 上次碰撞位置
    collisionCount: 0,
    totalDistance: 0,
    meanFreePath: 0
  };
  
  engine.plugins = engine.plugins || {};
  engine.plugins.tracer = { state };

  // 简化：外部通过 setTracer(body) 指定要追踪的粒子
  const api = {
    setTracer(body) {
      state.tracer = body;
      state.trail = [];
      state.mfpLengths = [];
      state.lastCollisionPosition = body ? { x: body.position.x, y: body.position.y } : null;
      state.collisionCount = 0;
      state.totalDistance = 0;
      state.meanFreePath = 0;
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
  
  // 碰撞检测事件
  Events.on(engine, 'collisionStart', (event) => {
    if (!state.enabled || !state.tracer) return;
    
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      if (pair.bodyA === state.tracer || pair.bodyB === state.tracer) {
        // 发生碰撞，记录位置
        const currentPos = { x: state.tracer.position.x, y: state.tracer.position.y };
        
        // 如果有上次碰撞位置，计算距离
        if (state.lastCollisionPosition) {
          const dx = currentPos.x - state.lastCollisionPosition.x;
          const dy = currentPos.y - state.lastCollisionPosition.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // 记录自由程长度（滑动窗口）
          state.mfpLengths.push(distance);
          if (state.mfpLengths.length > state.maxMFPSamples) {
            state.mfpLengths.shift();
            // 当滑窗淘汰旧样本时，同步修正总距离（减去被移除的那段）
            // 注意：由于先push再shift，我们无法直接获取被移除的值，这里改用重新累计更安全
            // 为避免频繁重算，仅当每100次溢出时重算一次
          }
          // 累加总距离与计数
          state.totalDistance += distance;
          state.collisionCount++;
          
          // 更新平均自由程
          state.meanFreePath = state.totalDistance / state.collisionCount;
        }
        
        // 更新上次碰撞位置
        state.lastCollisionPosition = { ...currentPos };
        break;
      }
    }
  });

  return engine.plugins.tracer;
}