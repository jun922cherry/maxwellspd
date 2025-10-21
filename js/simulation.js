// Maxwell速率分布粒子动画模拟模块 (v3.0 - Ultimate Refactoring)
import { calculateCharacteristicSpeeds, convertMsToPxFrame, mapTemperatureToPixelVp, mapTemperatureToPixelSigma2D, PHYSICS_CONSTANTS, getSpeedScale } from './physics.js';
import { generateMaxwellVelocity as generateMaxwellVelocityImported, generateSingleSpeedVelocity as generateSingleSpeedVelocityImported, generateDualSpeedVelocity as generateDualSpeedVelocityImported } from './physics/distributions.js';
import { getKineticEnergy as getKineticEnergyImported, rescaleParticleVelocitiesForNewGas as rescaleParticleVelocitiesForNewGasImported } from './energy/metrics.js';
import { getSpeedDistributionHistogram as getSpeedDistributionHistogramImported, getSmoothedHistogram as getSmoothedHistogramImported } from './data/histogram.js';
console.log('Maxwell粒子动画模拟模块 (v3.0) 加载中...');

// 从Matter.js导入所需模块
const { Engine, Render, Runner, World, Bodies, Composite, Events, Body } = Matter;

// --- 模块级核心变量 ---
let engine, render, runner;

// --- 模拟状态与配置 ---
let simulationState = {
    isRunning: false,
    particles: [],
    walls: [],
    chartIntervalId: null,
    chartUpdatesEnabled: true,
    initialKineticEnergy: 0,
    thermostatFrameCounter: 0,
    // 单粒子追踪状态（TASK-FEATURE-V2.1-TRACER）
    tracedParticleId: null,
    tracerData: {
        collisionCount: 0,
        totalDistance: 0,
        meanFreePath: 0
    },
    tracerFrameCounter: 0,
    // 初始分布模式（默认平衡态），用于 createParticles 生成初始速度
    initialDistributionMode: 'equilibrium'
};

// 粒子数量范围常量（V2.2 规范）
const MIN_PARTICLE_COUNT = 100;
const DEFAULT_PARTICLE_COUNT = 300;
const MAX_PARTICLE_COUNT = 800;

const SIMULATION_CONFIG = {
    width: 640,
    height: 400,
    particleRadius: 3,
    wallThickness: 20, // 使用较厚的墙体以增强视觉和物理稳定性
    particleColor: '#3B82F6',
    wallColor: '#94a3b8' // 更柔和的墙体颜色
};

// 工程性温控器（方案C）：周期性等比缩放所有粒子速度，使系统总动能维持在初始基准附近
const THERMOSTAT_CONFIG = {
    enabled: true,       // 默认开启以快速抑制能量单向下降
    intervalFrames: 120, // 每隔约2秒执行一次校准（按60FPS）
    clampMin: 0.95,      // 单次调整的速度缩放下限（防止过猛）
    clampMax: 1.05       // 单次调整的速度缩放上限（防止过猛）
};

// --- 核心初始化函数 (基于蓝图) ---
function init(containerElement, initialState, onReadyCallback) {
    console.log("正在按照终极方案初始化模拟器...");

    // 动态测量 canvas 的实际可见尺寸，避免右侧边界被缩放或裁切
    const measured = measureCanvasSize(containerElement);
    const canvasWidth = measured.width || SIMULATION_CONFIG.width;
    const canvasHeight = measured.height || SIMULATION_CONFIG.height;

    // 1. 创建引擎 (精确复现蓝图配置)
    engine = Engine.create({
        enableSleeping: false, // 禁用休眠，这是稳定运行的基础
        timing: {
            delta: 16.666, // 强制按约60FPS的步长更新物理
            timeScale: (initialState && typeof initialState.simulationTimeScale === 'number')
                ? initialState.simulationTimeScale
                : ((window.State && typeof window.State.getState === 'function' && typeof window.State.getState().simulationTimeScale === 'number')
                    ? window.State.getState().simulationTimeScale
                    : ((window.appState && typeof window.appState.simulationTimeScale === 'number')
                        ? window.appState.simulationTimeScale
                        : 0.1))
        },
        // 提升求解器精度，进一步防止穿透与能量漂移
        positionIterations: 16,
        velocityIterations: 16,

        // 【关键】Baumgarte稳定系数，增强位置错误修正的“刚性”
        constraintDefaults: {
            baumgarte: { x: 0.85, y: 0.85 } // 略降以减少过度位置修正带来的能量耗散
        },

        // 【关键】更严格的宽相碰撞检测网格尺寸
        broadphase: {
            bucketWidth: 48,
            bucketHeight: 48
        }
    });
    // 【关键】全局零重叠容忍
    engine.world.slop = 0;
    engine.world.gravity.y = 0; // 无重力

    // 2. 创建渲染器（支持传入现有canvas或容器元素）
    const isCanvas = containerElement && containerElement.tagName && containerElement.tagName.toLowerCase() === 'canvas';
    if (isCanvas) {
        render = Render.create({
            engine: engine,
            canvas: containerElement,
            options: {
                width: canvasWidth,
                height: canvasHeight,
                wireframes: false,
                background: 'transparent',
                // 为避免高 DPI 场景下出现边缘半像素裁切，这里固定为 1
                pixelRatio: 1
            }
        });
    } else {
        render = Render.create({
            element: containerElement || (document.getElementById('simulation-panel') || document.body),
            engine: engine,
            options: {
                width: canvasWidth,
                height: canvasHeight,
                wireframes: false,
                background: 'transparent',
                pixelRatio: 1
            }
        });
    }

    // 3. 创建刚体 (墙体和粒子)
    createWalls(canvasWidth, canvasHeight);
    // V2.2 要求：初始生成的粒子数严格等于默认值 300（不依赖UI初始值）
    const defaultParticleCount = DEFAULT_PARTICLE_COUNT;
    const defaultTemperature = (initialState && typeof initialState.temperature === 'number')
        ? initialState.temperature
        : (function() {
            const el = document.getElementById('temperature-slider');
            const v = el ? parseFloat(el.value) : NaN;
            return Number.isFinite(v) ? v : 300;
        })();
    createParticles(defaultParticleCount, defaultTemperature);
    // 记录初始动能用于后续保持率对比
    try {
        simulationState.initialKineticEnergy = getKineticEnergy();
    } catch (e) {
        simulationState.initialKineticEnergy = 0;
    }
    // 绑定温控器：周期性等比缩放粒子速度，使总动能维持在初始基准附近
    setupVelocityRescalingThermostat();
    // 绑定单粒子追踪的交互、碰撞统计、距离更新与渲染叠加
    setupTracerClickHandler();
    setupTracerCollisionTracker();
    setupTracerMetricsUpdater();
    setupTracerRenderOverlay();


    // 移除硬边界强制回退，交由物理引擎与墙体弹性碰撞自然处理，避免额外的位移修正带来的动能损失

    // 5. 启动官方Runner (最关键的稳定性保证)
    runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    // 监听窗口尺寸变化，保持渲染器与墙体与实际 canvas 尺寸同步
    setupResponsiveResize(containerElement);

    console.log("模拟器已按照终极方案重构并启动。");
    if (typeof onReadyCallback === 'function') {
        onReadyCallback();
    }
}

// --- 物理实体创建 ---

function createWalls(width, height) {
    const t = SIMULATION_CONFIG.wallThickness;
    const wallOptions = {
        isStatic: true,
        restitution: 1.0, // 完全弹性
        friction: 0,
        frictionStatic: 0,
        slop: 0.008, // 略收紧形变空间，进一步减少位置修正的能量扰动
        render: {
            fillStyle: SIMULATION_CONFIG.wallColor
        }
    };
    simulationState.walls = [
        Bodies.rectangle(width / 2, t / 2, width, t, { ...wallOptions, label: 'wall-top' }),
        Bodies.rectangle(width / 2, height - t / 2, width, t, { ...wallOptions, label: 'wall-bottom' }),
        Bodies.rectangle(t / 2, height / 2, t, height, { ...wallOptions, label: 'wall-left' }),
        Bodies.rectangle(width - t / 2, height / 2, t, height, { ...wallOptions, label: 'wall-right' })
    ];
    World.add(engine.world, simulationState.walls);
}

function createParticles(particleCount, temperature) {
    // 兜底：如果未提供参数，则从控件或默认值获取
    if (!Number.isFinite(particleCount)) {
        const el = document.getElementById('particles-slider');
        const v = el ? parseInt(el.value, 10) : NaN;
        particleCount = Number.isFinite(v) ? v : DEFAULT_PARTICLE_COUNT;
    }
    // 约束到范围 [MIN, MAX]
    particleCount = Math.max(MIN_PARTICLE_COUNT, Math.min(MAX_PARTICLE_COUNT, particleCount));
    const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
    if (!Number.isFinite(temperature)) {
        const el = document.getElementById('temperature-slider');
        const v = el ? parseFloat(el.value) : NaN;
        temperature = Number.isFinite(v) ? v : (Number.isFinite(st.temperature) ? st.temperature : 300);
    }
    const width = (render && render.options && render.options.width) || SIMULATION_CONFIG.width;
    const height = (render && render.options && render.options.height) || SIMULATION_CONFIG.height;
    const { wallThickness, particleRadius } = SIMULATION_CONFIG;
    const safeMargin = wallThickness / 2 + particleRadius + 2;
    const bodiesToAdd = [];
    for (let i = 0; i < particleCount; i++) {
        const x = safeMargin + Math.random() * (width - 2 * safeMargin);
        const y = safeMargin + Math.random() * (height - 2 * safeMargin);
            const particle = Bodies.circle(x, y, particleRadius, {
                restitution: 1.0,      // 完全弹性碰撞
                friction: 0,            // 无接触摩擦
                frictionStatic: 0,      // 静摩擦为零
                frictionAir: 0,         // 无空气阻力
                // 不设置 slop，继承全局 engine.world.slop = 0
                inertia: Infinity,      // 无限转动惯量，确保粒子不旋转
                label: 'particle',      // 标记为粒子，便于碰撞识别
                render: { fillStyle: SIMULATION_CONFIG.particleColor }
            });
        // 根据初始分布模式生成速度
        const mode = (st && st.initialDistributionMode) || simulationState.initialDistributionMode || 'equilibrium';
        let vgen;
        if (mode === 'single_speed') {
            vgen = generateSingleSpeedVelocity(temperature);
        } else if (mode === 'dual_speed') {
            vgen = generateDualSpeedVelocity(temperature);
        } else {
            vgen = generateMaxwellVelocity(temperature);
        }
        Body.setVelocity(particle, { x: vgen.vx, y: vgen.vy });
        // 追踪所需的附加属性
        particle.distanceSinceLastCollision = 0;
        particle.lastPosition = { x, y };
        particle.trail = [];
        particle._lastCollisionFrame = -1;
        bodiesToAdd.push(particle);
    }
    simulationState.particles = bodiesToAdd;
    World.add(engine.world, bodiesToAdd);

    // Corner严格反射：仅在极限情况下（同一时刻撞到两面墙）触发
    setupCornerStrictReflection();
    // 更新温控器目标：以当前生成的粒子速度场为基准
    try {
        simulationState.initialKineticEnergy = getKineticEnergy();
        simulationState.thermostatFrameCounter = 0;
    } catch (e) { /* ignore */ }
}


// --- 模拟控制 ---

function start() {
    if (simulationState.isRunning) return;
    console.log('开始粒子模拟 (Runner驱动)');
    simulationState.isRunning = true;
    // Runner已在init中启动，如已停止则尝试重新启动
    try {
        Runner.run(runner, engine);
    } catch (e) {
        console.warn('Runner.run重启失败或已在运行:', e);
    }
    
    // 启动图表节流更新
    if (!simulationState.chartIntervalId) {
        simulationState.chartIntervalId = setInterval(() => {
            if (!simulationState.chartUpdatesEnabled) return;
            // 采样直方图帧并入队（通过 State 专用接口）
            const histogram = getSpeedDistributionHistogram();
            try {
                if (window.State && typeof window.State.appendHistogramFrame === 'function') {
                    window.State.appendHistogramFrame(histogram);
                } else {
                    const appState = window.appState || {};
                    if (!Array.isArray(appState.histogramHistory)) {
                        appState.histogramHistory = [];
                        window.appState = appState;
                    }
                    appState.histogramHistory.push(histogram);
                    const maxFrames = window.HISTOGRAM_SMOOTHING_FRAMES || 15;
                    while (appState.histogramHistory.length > maxFrames) {
                        appState.histogramHistory.shift();
                    }
                }
            } catch (e) {
                console.warn('入队直方图历史失败:', e);
            }
            // 发布事件，交由 main.js 统一驱动图表更新
            try {
                const evt = new CustomEvent('simulation:histogramFrame', { detail: histogram });
                console.debug('[Histogram] frame dispatched');
                window.dispatchEvent(evt);
            } catch (e) {
                console.warn('派发直方图帧事件失败:', e);
            }
            // 同步更新动能显示（每300ms）并刷新宏观指标
            try {
                const totalKE = getKineticEnergy();
                const N = simulationState.particles.length || 1;
                const avgKE = totalKE / N;
                const initialKE = simulationState.initialKineticEnergy || totalKE;
                const retention = initialKE > 0 ? (totalKE / initialKE) : 1;
                const keTotalEl = document.getElementById('kinetic-energy-total');
                const keAvgEl = document.getElementById('kinetic-energy-avg');
                const keRetentionEl = document.getElementById('kinetic-energy-retention');
                if (keTotalEl) keTotalEl.textContent = totalKE.toFixed(2);
                if (keAvgEl) keAvgEl.textContent = avgKE.toFixed(4);
                if (keRetentionEl) keRetentionEl.textContent = (retention * 100).toFixed(1) + '%';

                // ===== 宏观指标：N、T_eff(相对)、P_rel(相对) =====
                const macroNEl = document.getElementById('macro-N');
                const macroTempEl = document.getElementById('macro-temp');
                const macroPEl = document.getElementById('macro-P');
                if (macroNEl) macroNEl.textContent = String(N);
                try {
                    // 计算有效温度（由速度场反推；二维等分配 <KE>=kT）
                    const gasEl = document.getElementById('gas-selector');
                    const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
                    const molarMass = gasEl ? parseFloat(gasEl.value) : (st.molarMass ?? 28.0134);
                    const m_per_molecule = (molarMass / 1000) / PHYSICS_CONSTANTS.NA;
                    const speedScale = (typeof getSpeedScale === 'function') ? getSpeedScale() : (window.PHYSICS?.getSpeedScale?.() || 0.0075);
                    const avg_v_sq_px = 2 * avgKE;
                    const avg_v_sq_ms = avg_v_sq_px / (speedScale * speedScale);
                    const k = PHYSICS_CONSTANTS.k;
                    const Teff = 0.5 * m_per_molecule * avg_v_sq_ms / k; // Kelvin
                    const tempSliderEl = document.getElementById('temperature-slider');
                    const T_set = tempSliderEl ? parseFloat(tempSliderEl.value) : ((typeof st.temperature === 'number' ? st.temperature : 300));
                    const Teff_rel = T_set > 0 ? (Teff / T_set) : 1;
                    if (macroTempEl) macroTempEl.textContent = `${Teff_rel.toFixed(3)}x`;
                    const particleSliderEl = document.getElementById('particles-slider');
                    const N_set = particleSliderEl ? parseInt(particleSliderEl.value, 10) : N;
                    const P_rel = (N_set > 0 && T_set > 0) ? ((N * Teff) / (N_set * T_set)) : 1;
                    if (macroPEl) macroPEl.textContent = `${P_rel.toFixed(3)}x`;
                } catch (e2) { /* ignore */ }
            } catch (e) { /* ignore */ }

            // 更新平均自由程指标（统一到关键指标表，始终显示）
            try {
                const mfpRTEl = document.getElementById('mfp-real-time');
                if (mfpRTEl) {
                    const mfp = simulationState.tracerData?.meanFreePath;
                    mfpRTEl.textContent = (Number.isFinite(mfp) && mfp > 0) ? mfp.toFixed(2) : '--';
                }
            } catch (e) { /* ignore */ }
        }, 300);
    }
}

function pause() {
    if (!simulationState.isRunning) return;
    console.log('暂停粒子模拟 (Runner驱动)');
    simulationState.isRunning = false;
    // 暂停Runner的执行
    try {
        Runner.stop(runner);
    } catch (e) {
        console.warn('Runner.stop失败或Runner未运行:', e);
    }

    if (simulationState.chartIntervalId) {
        clearInterval(simulationState.chartIntervalId);
        simulationState.chartIntervalId = null;
    }
}

function reset(particleCount, temperature) {
    console.log('重置粒子模拟');
    pause();
    // 兼容参数缺失：从UI或默认值读取
    if (!Number.isFinite(particleCount)) {
        const el = document.getElementById('particles-slider');
        const v = el ? parseInt(el.value, 10) : NaN;
        particleCount = Number.isFinite(v) ? v : DEFAULT_PARTICLE_COUNT;
    }
    // 约束到范围 [MIN, MAX]
    particleCount = Math.max(MIN_PARTICLE_COUNT, Math.min(MAX_PARTICLE_COUNT, particleCount));
    if (!Number.isFinite(temperature)) {
        const el = document.getElementById('temperature-slider');
        const v = el ? parseFloat(el.value) : NaN;
        const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
        temperature = Number.isFinite(v) ? v : (Number.isFinite(st.temperature) ? st.temperature : 300);
    }
    // 清空世界中所有物体（包括静态墙体），随后会重新创建
    World.clear(engine.world, false);
    simulationState.particles = [];
    
    // 重新创建墙体和粒子
    createWalls(SIMULATION_CONFIG.width, SIMULATION_CONFIG.height);
    // 使用当前渲染器尺寸重新生成墙体，避免右侧边界错位
    if (render && render.options) {
        const w = render.options.width || SIMULATION_CONFIG.width;
        const h = render.options.height || SIMULATION_CONFIG.height;
        // 移除前一次创建的墙体以避免重复
        try {
            simulationState.walls.forEach(wall => World.remove(engine.world, wall));
        } catch (e) { /* ignore */ }
        createWalls(w, h);
    }
    createParticles(particleCount, temperature);
    // 重置后更新温控器基准与计数器
    try {
        simulationState.initialKineticEnergy = getKineticEnergy();
        simulationState.thermostatFrameCounter = 0;
    } catch (e) { /* ignore */ }
    // 清空直方图平滑历史，避免重置后仍混入旧分布
    try {
        if (window.State && typeof window.State.updateState === 'function') {
            window.State.updateState({ histogramHistory: [] });
        } else if (window.appState && Array.isArray(window.appState.histogramHistory)) {
            window.appState.histogramHistory.length = 0;
        }
    } catch (e) { /* ignore */ }
    // 重置追踪状态
    simulationState.tracedParticleId = null;
    simulationState.tracerData = { collisionCount: 0, totalDistance: 0, meanFreePath: 0 };
    simulationState.tracerFrameCounter = 0;

    console.log('模拟已重置');
}

// ========== 自适应渲染尺寸维护 ==========

function measureCanvasSize(canvasEl) {
    try {
        if (!canvasEl) {
            const c = document.getElementById('simulation-canvas');
            canvasEl = c || null;
        }
        if (!canvasEl) return { width: SIMULATION_CONFIG.width, height: SIMULATION_CONFIG.height };
        const rect = canvasEl.getBoundingClientRect();
        let w = Math.floor(rect.width);
        let h = Math.floor(rect.height);
        // 兜底：若尚未布局完成导致测量为0，则使用父容器尺寸或默认值
        if (!w || !h) {
            const parent = canvasEl.parentElement;
            if (parent) {
                const pr = parent.getBoundingClientRect();
                w = Math.max(320, Math.floor(pr.width));
                h = Math.max(200, Math.floor(pr.height));
            } else {
                w = SIMULATION_CONFIG.width;
                h = SIMULATION_CONFIG.height;
            }
        }
        return { width: w, height: h };
    } catch (e) {
        return { width: SIMULATION_CONFIG.width, height: SIMULATION_CONFIG.height };
    }
}

function setupResponsiveResize(canvasEl) {
    try {
        const handler = () => {
            const size = measureCanvasSize(canvasEl);
            const w = size.width;
            const h = size.height;
            if (!render || !render.canvas) return;

            // 更新渲染器与画布尺寸
            render.options.width = w;
            render.options.height = h;
            render.canvas.width = w;   // 因已固定 pixelRatio=1，这里直接使用逻辑尺寸
            render.canvas.height = h;

            // 同步墙体大小与位置，确保四壁紧贴边缘显示
            try {
                simulationState.walls.forEach(wall => World.remove(engine.world, wall));
            } catch (e) { /* ignore */ }
            createWalls(w, h);
        };
        window.addEventListener('resize', handler);
        // 初次也执行一次，确保与布局同步
        setTimeout(handler, 0);
    } catch (e) {
        console.warn('[Responsive] setupResponsiveResize failed:', e);
    }
}

// 极端墙角碰撞的严格法线反射处理（仅在同一时刻同时撞到两面墙时触发）
let _cornerCollisionSidesByParticle = new Map();
function setupCornerStrictReflection() {
    if (!engine) return;
    // 避免重复绑定监听器
    if (setupCornerStrictReflection._bound) return;
    setupCornerStrictReflection._bound = true;

    Events.on(engine, 'collisionStart', event => {
        const pairs = event.pairs || [];
        for (const pair of pairs) {
            const { bodyA, bodyB } = pair;
            let particle = null, wallLabel = null;
            if (bodyA.label === 'particle' && bodyB.label && bodyB.label.startsWith('wall-')) {
                particle = bodyA; wallLabel = bodyB.label;
            } else if (bodyB.label === 'particle' && bodyA.label && bodyA.label.startsWith('wall-')) {
                particle = bodyB; wallLabel = bodyA.label;
            }
            if (particle && wallLabel) {
                let set = _cornerCollisionSidesByParticle.get(particle.id);
                if (!set) { set = new Set(); _cornerCollisionSidesByParticle.set(particle.id, set); }
                set.add(wallLabel);
            }
        }
    });

    Events.on(engine, 'afterUpdate', () => {
        if (_cornerCollisionSidesByParticle.size === 0) return;
        const t = SIMULATION_CONFIG.wallThickness;
        const r = SIMULATION_CONFIG.particleRadius;
        const width = (render && render.options && render.options.width) || SIMULATION_CONFIG.width;
        const height = (render && render.options && render.options.height) || SIMULATION_CONFIG.height;
        const innerLeft = t + r, innerRight = width - t - r;
        const innerTop = t + r, innerBottom = height - t - r;
        const eps = 0.25; // 轻微位置回退的余量

        for (const [pid, sides] of _cornerCollisionSidesByParticle.entries()) {
            if (sides.size >= 2) {
                const particle = simulationState.particles.find(p => p.id === pid);
                if (!particle) continue;
                let vx = particle.velocity?.x || 0;
                let vy = particle.velocity?.y || 0;

                // 按法线方向严格反射速度分量
                if (sides.has('wall-left')) vx = Math.abs(vx);
                if (sides.has('wall-right')) vx = -Math.abs(vx);
                if (sides.has('wall-top')) vy = Math.abs(vy);
                if (sides.has('wall-bottom')) vy = -Math.abs(vy);
                Body.setVelocity(particle, { x: vx, y: vy });

                // 位置轻微回退，避免持续重叠
                let x = particle.position?.x || innerLeft;
                let y = particle.position?.y || innerTop;
                x = Math.min(Math.max(x, innerLeft + eps), innerRight - eps);
                y = Math.min(Math.max(y, innerTop + eps), innerBottom - eps);
                Body.setPosition(particle, { x, y });
            }
        }
        _cornerCollisionSidesByParticle.clear();
    });
}



// ========== 工程性温控器（方案C）：总动能保持 ==========
let _thermostatBound = false;
function setupVelocityRescalingThermostat() {
    if (!engine || _thermostatBound) return;
    _thermostatBound = true;
    Events.on(engine, 'afterUpdate', () => {
        if (!THERMOSTAT_CONFIG.enabled) return;
        simulationState.thermostatFrameCounter = (simulationState.thermostatFrameCounter + 1) | 0;
        if (simulationState.thermostatFrameCounter < THERMOSTAT_CONFIG.intervalFrames) return;
        simulationState.thermostatFrameCounter = 0;

        const targetKE = simulationState.initialKineticEnergy || 0;
        const currentKE = getKineticEnergy();
        if (!(currentKE > 0 && targetKE > 0)) return;

        let s = Math.sqrt(targetKE / currentKE);
        if (!isFinite(s)) return;
        if (Number.isFinite(THERMOSTAT_CONFIG.clampMin)) {
            s = Math.max(THERMOSTAT_CONFIG.clampMin, s);
        }
        if (Number.isFinite(THERMOSTAT_CONFIG.clampMax)) {
            s = Math.min(THERMOSTAT_CONFIG.clampMax, s);
        }
        if (Math.abs(s - 1) < 1e-3) return;

        for (const p of simulationState.particles) {
            const vx = p.velocity?.x || 0;
            const vy = p.velocity?.y || 0;
            Body.setVelocity(p, { x: vx * s, y: vy * s });
        }
    });
}

// ========== 单粒子追踪 (TASK-FEATURE-V2.1-TRACER) ==========
function setupTracerClickHandler() {
    if (!render || setupTracerClickHandler._bound) return;
    setupTracerClickHandler._bound = true;
    // 根据新的“工具驱动”模型，画布点击选择迁移到 js/event-handler.js。
    // 此处不再绑定任何点击事件，以避免与新逻辑冲突。
}

function setupTracerMetricsUpdater() {
    if (!engine || setupTracerMetricsUpdater._bound) return;
    setupTracerMetricsUpdater._bound = true;
    Events.on(engine, 'afterUpdate', () => {
        // 仅在追踪模式为 active 且模拟正在运行时累加位移
        const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
        if ((st.tracerMode || 'inactive') !== 'active') return;
        if (!simulationState.isRunning) return;
        // 每帧维护被追踪粒子的位移累计与轨迹队列
        simulationState.tracerFrameCounter = (simulationState.tracerFrameCounter + 1) | 0;
        const pid = simulationState.tracedParticleId;
        if (!pid) return;
        const p = simulationState.particles.find(pp => pp.id === pid);
        if (!p) return;
        const lx = p.lastPosition?.x ?? p.position.x;
        const ly = p.lastPosition?.y ?? p.position.y;
        const dx = (p.position.x - lx);
        const dy = (p.position.y - ly);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (Number.isFinite(dist)) {
            p.distanceSinceLastCollision = (p.distanceSinceLastCollision || 0) + dist;
        }
        p.lastPosition = { x: p.position.x, y: p.position.y };

        // 维护轨迹队列（长期保留，确保轨迹不消失）
        const maxTrailLen = 10000; // 保留最近10000帧的轨迹
        p.trail = p.trail || [];
        p.trail.push({ x: p.position.x, y: p.position.y });
        if (p.trail.length > maxTrailLen) {
            p.trail.splice(0, p.trail.length - maxTrailLen);
        }
    });
}

function setupTracerCollisionTracker() {
    if (!engine || setupTracerCollisionTracker._bound) return;
    setupTracerCollisionTracker._bound = true;
    Events.on(engine, 'collisionStart', event => {
        // 仅在追踪模式为 active 且模拟正在运行时统计碰撞
        const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
        if ((st.tracerMode || 'inactive') !== 'active') return;
        if (!simulationState.isRunning) return;
        const pid = simulationState.tracedParticleId;
        if (!pid) return;
        const pairs = event.pairs || [];
        for (const pair of pairs) {
            const { bodyA, bodyB } = pair;
            let traced = null;
            if (bodyA.label === 'particle' && bodyA.id === pid) traced = bodyA;
            if (bodyB.label === 'particle' && bodyB.id === pid) traced = bodyB;
            if (!traced) continue;

            // 避免同一帧内重复计数
            const frameTs = engine?.timing?.timestamp ?? simulationState.tracerFrameCounter;
            if (traced._lastCollisionFrame === frameTs) continue;
            traced._lastCollisionFrame = frameTs;

            const d = traced.distanceSinceLastCollision || 0;
            const cc = simulationState.tracerData.collisionCount + 1;
            const td = simulationState.tracerData.totalDistance + d;
            const mfp = td / cc;
            simulationState.tracerData = {
                collisionCount: cc,
                totalDistance: td,
                meanFreePath: Number.isFinite(mfp) ? mfp : 0
            };
            traced.distanceSinceLastCollision = 0;
        }
    });
}

function setupTracerRenderOverlay() {
    if (!render || setupTracerRenderOverlay._bound) return;
    setupTracerRenderOverlay._bound = true;
    const ctx = render.context;
    Events.on(render, 'afterRender', () => {
        try {
            const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
            if ((st.tracerMode || 'inactive') !== 'active') return;
            const pid = simulationState.tracedParticleId;
            if (!pid) return;
            const p = simulationState.particles.find(pp => pp.id === pid);
            if (!p) return;

            // 绘制连续轨迹（不渐隐，持续可见）
            const trail = Array.isArray(p.trail) ? p.trail : [];
            if (trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(trail[0].x, trail[0].y);
                for (let i = 1; i < trail.length; i++) {
                    ctx.lineTo(trail[i].x, trail[i].y);
                }
                ctx.strokeStyle = 'rgba(0,255,0,0.9)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // 高亮当前粒子
            ctx.beginPath();
            ctx.arc(p.position.x, p.position.y, SIMULATION_CONFIG.particleRadius + 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(p.position.x, p.position.y, SIMULATION_CONFIG.particleRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,255,0,0.30)';
            ctx.fill();
        } catch (e) {
            // 渲染异常不影响主循环
        }
    });
}

// --- 状态更新 ---

function updateParticleCount(newCount, temperature) {
    // 缺省参数兜底
    if (!Number.isFinite(newCount)) {
        const el = document.getElementById('particles-slider');
        const v = el ? parseInt(el.value, 10) : NaN;
        newCount = Number.isFinite(v) ? v : simulationState.particles.length;
    }
    // 约束到范围 [MIN, MAX]
    newCount = Math.max(MIN_PARTICLE_COUNT, Math.min(MAX_PARTICLE_COUNT, newCount));
    if (!Number.isFinite(temperature)) {
        const el = document.getElementById('temperature-slider');
        const v = el ? parseFloat(el.value) : NaN;
        const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
        temperature = Number.isFinite(v) ? v : (Number.isFinite(st.temperature) ? st.temperature : 300);
    }
    const currentCount = simulationState.particles.length;
    if (newCount === currentCount) return;

    if (newCount > currentCount) {
        // 添加粒子（严格与 createParticles 的物理选项一致）
        const numToAdd = newCount - currentCount;
        const { width, height, wallThickness, particleRadius } = SIMULATION_CONFIG;
        const safeMargin = wallThickness / 2 + particleRadius + 2;
        const bodiesToAdd = [];
        for (let i = 0; i < numToAdd; i++) {
            const x = safeMargin + Math.random() * (width - 2 * safeMargin);
            const y = safeMargin + Math.random() * (height - 2 * safeMargin);
            const particle = Bodies.circle(x, y, particleRadius, {
                restitution: 1.0,      // 完全弹性碰撞
                friction: 0,            // 无接触摩擦
                frictionStatic: 0,      // 静摩擦为零
                frictionAir: 0,         // 无空气阻力
                // 不设置 slop，继承全局 engine.world.slop = 0
                inertia: Infinity,      // 无限转动惯量，确保粒子不旋转
                label: 'particle',      // 标记为粒子，便于碰撞识别
                render: { fillStyle: SIMULATION_CONFIG.particleColor }
            });
            const { vx, vy } = generateMaxwellVelocity(temperature);
            Body.setVelocity(particle, { x: vx, y: vy });
            // 追踪所需的附加属性
            particle.distanceSinceLastCollision = 0;
            particle.lastPosition = { x, y };
            particle.trail = [];
            particle._lastCollisionFrame = -1;
            bodiesToAdd.push(particle);
        }
        simulationState.particles.push(...bodiesToAdd);
        World.add(engine.world, bodiesToAdd);

        // 确保角落严格反射逻辑已绑定（幂等）
        setupCornerStrictReflection();
    } else {
        // 移除粒子
        const numToRemove = currentCount - newCount;
        const removedParticles = simulationState.particles.splice(0, numToRemove);
        for (const body of removedParticles) {
            World.remove(engine.world, body);
        }
        // 如果被追踪的粒子被移除，取消追踪并重置数据
        if (simulationState.tracedParticleId) {
            const removedIds = new Set(removedParticles.map(p => p.id));
            if (removedIds.has(simulationState.tracedParticleId)) {
                simulationState.tracedParticleId = null;
                simulationState.tracerData = { collisionCount: 0, totalDistance: 0, meanFreePath: 0 };
            }
        }
    }
    // 粒子数量变更后，更新温控器目标与计数器
    try {
        simulationState.initialKineticEnergy = getKineticEnergy();
        simulationState.thermostatFrameCounter = 0;
    } catch (e) { /* ignore */ }
}

function updateParticleTemperature(temperature) {
    if (!Number.isFinite(temperature)) {
        const el = document.getElementById('temperature-slider');
        const v = el ? parseFloat(el.value) : NaN;
        const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
        temperature = Number.isFinite(v) ? v : (Number.isFinite(st.temperature) ? st.temperature : 300);
    }
    simulationState.particles.forEach(particle => {
        const { vx, vy } = generateMaxwellVelocity(temperature);
        Body.setVelocity(particle, { x: vx, y: vy });
    });
    // 温度改变等价于设定新的能量基准
    try {
        simulationState.initialKineticEnergy = getKineticEnergy();
        simulationState.thermostatFrameCounter = 0;
    } catch (e) { /* ignore */ }
}

function updateTimeScale(timeScale) {
    try {
        if (!engine || !render) return;
        if (!Number.isFinite(timeScale)) {
            const el = document.getElementById('timescale-slider');
            const v = el ? parseFloat(el.value) : NaN;
            const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
            timeScale = Number.isFinite(v) ? v : (Number.isFinite(st.simulationTimeScale) ? st.simulationTimeScale : 1);
        }
        const prevScale = engine.timing.timeScale;
        engine.timing.timeScale = timeScale;
        console.debug('[TimeScale] engine.timing.timeScale:', prevScale, '=>', timeScale);
        if (window.updateTimeScale) {
            window.updateTimeScale(timeScale);
        }
    } catch (e) {
        console.warn('更新时间尺度失败:', e);
    }
}

function getKineticEnergy() {
    try {
        const bodies = Composite.allBodies(engine.world).filter(b => !b.isStatic);
        const total = getKineticEnergyImported(bodies, 1);
        return Number.isFinite(total) ? total : 0;
    } catch (e) {
        return 0;
    }
}

// 新增：根据分子质量变化重校准所有粒子速度，保持总动能不变
function rescaleParticleVelocitiesForNewGas(oldMolarMass, newMolarMass) {
    try {
        const om = parseFloat(oldMolarMass);
        const nm = parseFloat(newMolarMass);
        if (!Number.isFinite(om) || !Number.isFinite(nm) || om <= 0 || nm <= 0 || Math.abs(om - nm) < 1e-12) {
            return; // 无需调整
        }
        const bodies = Composite.allBodies(engine.world).filter(b => !b.isStatic);
        rescaleParticleVelocitiesForNewGasImported(bodies, om, nm, { conserveKineticEnergy: true });
        // 清空直方图平滑窗口，避免旧分布影响切换后的瞬时显示
        try {
            if (window.State && typeof window.State.updateState === 'function') {
                window.State.updateState({ histogramHistory: [] });
            } else if (window.appState && Array.isArray(window.appState.histogramHistory)) {
                window.appState.histogramHistory.length = 0;
            }
        } catch (e) { /* ignore */ }
        console.log(`Gas changed. Velocities rescaled by a factor of ${Math.sqrt(om / nm).toFixed(3)}.`);
    } catch (e) {
        console.warn('重校准粒子速度失败:', e);
    }
}

function getSpeedDistributionHistogram() {
    try {
        const FIXED_BIN_COUNT = 60;
        const MAX_FACTOR = 4; // 与图表配置保持一致
        const temperatureSlider = document.getElementById('temperature-slider');
        const gasSelector = document.getElementById('gas-selector');
        const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
        const temperature = temperatureSlider ? parseFloat(temperatureSlider.value) : (st.temperature ?? 300);
        const molarMass = gasSelector ? parseFloat(gasSelector.value) : (st.molarMass ?? 28);
        return getSpeedDistributionHistogramImported(
            simulationState.particles,
            temperature,
            molarMass,
            { binCount: FIXED_BIN_COUNT, maxFactor: MAX_FACTOR }
        );
        // 数据由 getSpeedDistributionHistogramImported 转发返回
    } catch (e) {
        console.warn('计算速度直方图失败:', e);
        return [];
    }
}

// ===== 新增：时间平滑后的直方图（含概率密度归一化） =====
function getSmoothedHistogram() {
    try {
        const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
        const history = Array.isArray(st.histogramHistory) ? st.histogramHistory : [];
        return getSmoothedHistogramImported(history, simulationState.particles, 0.3);
    } catch (e) {
        console.warn('计算平滑直方图失败:', e);
        return [];
    }
}

function generateMaxwellVelocity(temperature) {
    const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
    if (!Number.isFinite(temperature)) {
        const el = document.getElementById('temperature-slider');
        const v = el ? parseFloat(el.value) : NaN;
        temperature = Number.isFinite(v) ? v : (Number.isFinite(st.temperature) ? st.temperature : 300);
    }
    const gasEl = document.getElementById('gas-selector');
    const molarMass = gasEl ? parseFloat(gasEl.value) : (st.molarMass ?? 28.0134);
    return generateMaxwellVelocityImported(temperature, molarMass);
}

// 新增：单速率分布（所有粒子具有相同速率，方向均匀随机）
function generateSingleSpeedVelocity(temperature) {
    const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
    if (!Number.isFinite(temperature)) {
        const el = document.getElementById('temperature-slider');
        const v = el ? parseFloat(el.value) : NaN;
        temperature = Number.isFinite(v) ? v : (Number.isFinite(st.temperature) ? st.temperature : 300);
    }
    const gasEl = document.getElementById('gas-selector');
    const molarMass = gasEl ? parseFloat(gasEl.value) : (st.molarMass ?? 28.0134);
    return generateSingleSpeedVelocityImported(temperature, molarMass);
}

// 新增：双速率分布（以0.6*vp和1.6*vp两簇为例，权重各50%）
function generateDualSpeedVelocity(temperature) {
    const st = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
    if (!Number.isFinite(temperature)) {
        const el = document.getElementById('temperature-slider');
        const v = el ? parseFloat(el.value) : NaN;
        temperature = Number.isFinite(v) ? v : (Number.isFinite(st.temperature) ? st.temperature : 300);
    }
    const gasEl = document.getElementById('gas-selector');
    const molarMass = gasEl ? parseFloat(gasEl.value) : (st.molarMass ?? 28.0134);
    return generateDualSpeedVelocityImported(temperature, molarMass);
}

// 提供给图表模块的温度到像素速率映射（用于理论曲线像素域转换）
function mapTemperatureToSpeed(temperature, molarMass) {
    // 统一来源：调用共享物理模块
    return mapTemperatureToPixelVp(temperature, molarMass);
}

// --- 模块导出 ---
function resetTracerStats() {
    const pid = simulationState.tracedParticleId;
    if (pid) {
        const p = simulationState.particles.find(pp => pp.id === pid);
        if (p) {
            p.distanceSinceLastCollision = 0;
            p.lastPosition = { x: p.position.x, y: p.position.y };
            p.trail = [];
            p._lastCollisionFrame = -1;
        }
    }
    simulationState.tracedParticleId = null;
    simulationState.tracerData = { collisionCount: 0, totalDistance: 0, meanFreePath: 0 };
    simulationState.tracerFrameCounter = 0;
}

window.SimulationModule = {
    init,
    start,
    pause,
    reset,
    updateParticleCount,
    updateParticleTemperature,
    updateTimeScale,
    getSpeedDistributionHistogram,
    getSmoothedHistogram,
    mapTemperatureToSpeed,
    getKineticEnergy,
    // 新增导出：切换气体时的动能重校准
    rescaleParticleVelocitiesForNewGas,
    setChartUpdateEnabled: (enabled) => {
        simulationState.chartUpdatesEnabled = !!enabled;
    },
    setThermostatEnabled: (enabled) => {
        THERMOSTAT_CONFIG.enabled = !!enabled;
    },
    setThermostatInterval: (frames) => {
        if (Number.isFinite(frames) && frames > 0) THERMOSTAT_CONFIG.intervalFrames = frames | 0;
    },
    setThermostatClamp: (min, max) => {
        if (Number.isFinite(min)) THERMOSTAT_CONFIG.clampMin = min;
        if (Number.isFinite(max)) THERMOSTAT_CONFIG.clampMax = max;
    },
    // 新增：初始分布模式更新接口
    updateInitialDistributionMode: (mode) => {
        if (typeof mode === 'string') {
            simulationState.initialDistributionMode = mode;
            console.debug('[DistributionMode] updated to:', mode);
        }
    },
    state: simulationState,
    config: SIMULATION_CONFIG,
    // 新增：重置追踪统计
    resetTracerStats
};

console.log('Maxwell粒子动画模拟模块 (v3.0) 加载完成。');