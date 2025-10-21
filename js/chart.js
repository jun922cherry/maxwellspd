/**
 * Maxwell速率分布图表模块
 * 使用Chart.js实现动态速率分布曲线绘制
 */

console.log('Maxwell速率分布图表模块加载中...');

// 引入统一物理模块
import { PHYSICS_CONSTANTS, calculateCharacteristicSpeeds, convertMsToPxFrame, mapTemperatureToPixelVp, calculateSigma2D, mapTemperatureToPixelSigma2D, getSpeedScale } from './physics.js';
import { getSmoothedHistogram as getSmoothedHistogramData } from './data/histogram.js';

// 图表实例
let speedDistributionChart = null;

// 物理常数：统一来源

// 图表配置
const CHART_CONFIG = {
    pointCount: 220,     // 曲线数据点数量（微调：更平滑）
    maxSpeedFactor: 4,   // 最大速率为最概然速率的倍数
    colors: {
        theoretical: 'rgba(54, 162, 235, 1)',  // 实时曲线颜色（蓝色）
        snapshot: 'rgba(150, 150, 150, 1)'     // 快照曲线颜色（灰色）
    }
};

/**
 * 计算方均根速率
 * @param {number} temperature - 温度 (K)
 * @param {number} molarMass - 摩尔质量 (g/mol)
 * @returns {number} 方均根速率 (m/s)
 */
function calculateVrms(temperature, molarMass) {
    const M = molarMass / 1000; // 转换为 kg/mol
    return Math.sqrt(3 * PHYSICS_CONSTANTS.R * temperature / M);
}

/**
 * 初始化速率分布图表
 */
function initSpeedDistributionChart() {
    const ctx = document.getElementById('speed-distribution-chart');
    if (!ctx) {
        console.error('未找到speed-distribution-chart元素');
        return;
    }
    speedDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            datasets: [
                {
                    type: 'line',
                    label: '理论分布',
                    data: [],
                    borderColor: CHART_CONFIG.colors.theoretical,
                    borderWidth: 2,
                    tension: 0.2,
                    pointRadius: 0,
                    parsing: { xAxisKey: 'x', yAxisKey: 'y' },
                    yAxisID: 'yDensity'
                },
                {
                    type: 'line',
                    label: '快照对比',
                    data: [], // 初始为空，点击“保存对比”后填充
                    borderColor: CHART_CONFIG.colors.snapshot,
                    borderWidth: 2,
                    tension: 0.2,
                    pointRadius: 0,
                    parsing: { xAxisKey: 'x', yAxisKey: 'y' },
                    yAxisID: 'yDensity'
                },
                {
                    type: 'bar',
                    label: '模拟直方图',
                    data: [],
                    // 使用渐变背景增强质感
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const { ctx, chartArea } = chart;
                        // 在首次渲染前 chartArea 可能为 undefined，提供回退颜色
                        if (!chartArea) {
                            return 'rgba(59, 130, 246, 0.35)';
                        }
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
                        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
                        return gradient;
                    },
                    borderColor: 'rgba(59, 130, 246, 0.8)',
                    borderWidth: 1,
                    parsing: { xAxisKey: 'x', yAxisKey: 'y' },
                    yAxisID: 'yDensity'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // 平滑动画与交互动画配置，提升流动质感
            animation: {
                duration: 300,
                easing: 'linear'
            },
            transitions: {
                active: {
                    animation: {
                        duration: 200
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: '速率（像素/帧）' },
                    grid: { display: true, color: '#E5E7EB', borderDash: [2, 4] },
                    min: 0
                },
                yDensity: {
                    title: { display: true, text: '概率密度' },
                    grid: { display: true, color: '#E5E7EB', borderDash: [2, 4] },
                    position: 'left'
                }
            },
            plugins: {
                legend: { display: true, labels: { boxWidth: 12 } },
                tooltip: { enabled: true }
            }
        }
    });
}

/**
 * 计算二维瑞利分布的概率密度函数（物理单位 m/s）
 * Rayleigh PDF: f(v) = (v/σ^2) * exp(-v^2 / (2σ^2))
 * 其中 σ^2 = kT/m，m 为单分子质量
 */
function calculateRayleighPdfMs(v_ms, temperature, molarMass) {
    const sigma_ms = calculateSigma2D(temperature, molarMass);
    const sigma2 = sigma_ms * sigma_ms;
    return (v_ms / sigma2) * Math.exp(-(v_ms * v_ms) / (2 * sigma2));
}

// 根据当前模拟粒子速度（px/frame）估计有效温度 Teff（K）
function getEffectiveTemperatureFromSimulation(molarMass) {
    try {
        const sim = window.SimulationModule?.state;
        if (!sim || !Array.isArray(sim.particles) || sim.particles.length === 0) return null;
        // 使用已导出的总动能（px域），每粒子平均动能 = 0.5 * <v^2_px>
        const totalKE = (typeof window.SimulationModule?.getKineticEnergy === 'function')
            ? window.SimulationModule.getKineticEnergy()
            : (() => {
                let total = 0;
                for (const p of sim.particles) {
                    const vx = p.velocity?.x ?? p.vx ?? 0;
                    const vy = p.velocity?.y ?? p.vy ?? 0;
                    total += 0.5 * (vx * vx + vy * vy);
                }
                return total;
            })();
        const N = sim.particles.length;
        const avg_v_sq_px = 2 * (totalKE / Math.max(1, N));
        const speedScale = getSpeedScale();
        const avg_v_sq_ms = avg_v_sq_px / (speedScale * speedScale);
        const m_per_molecule = (molarMass / 1000) / PHYSICS_CONSTANTS.NA;
        const k = PHYSICS_CONSTANTS.k;
        const Teff = 0.5 * m_per_molecule * avg_v_sq_ms / k; // Kelvin
        if (!Number.isFinite(Teff) || Teff <= 0) return null;
        return Teff;
    } catch (e) {
        console.warn('计算有效温度失败:', e);
        return null;
    }
}

/**
 * 生成理论速率分布数据
 * @param {number} temperature - 温度 (K)
 * @param {number} molarMass - 摩尔质量 (g/mol)
 * @returns {Array} 数据点数组 [{x: speed, y: distribution}, ...]
 */
function generateTheoreticalData(temperature, molarMass) {
    const data = [];
    // 二维瑞利分布的参数 σ（m/s）
    const sigma_ms = calculateSigma2D(temperature, molarMass);
    const sigma_px = mapTemperatureToPixelSigma2D(temperature, molarMass);
    const maxSpeed_px = sigma_px * CHART_CONFIG.maxSpeedFactor;
    const speedStep_ms = (sigma_ms * CHART_CONFIG.maxSpeedFactor) / CHART_CONFIG.pointCount; // 在m/s域等步长
    for (let i = 0; i <= CHART_CONFIG.pointCount; i++) {
        const speed_ms = i * speedStep_ms;
        const speed_px = convertMsToPxFrame(speed_ms);
        // 先在物理单位域计算密度，再应用变量变换的雅可比：f_px = f_ms / SPEED_SCALE
        const distribution_ms = calculateRayleighPdfMs(speed_ms, temperature, molarMass);
        const distribution_px = distribution_ms / getSpeedScale();
        data.push({ x: speed_px, y: distribution_px });
    }
    return data;
}

/**
 * 更新速率分布图表
 * @param {number} temperature - 温度 (K)
 * @param {number} molarMass - 摩尔质量 (g/mol)
 * @param {Array} simulationData - 模拟数据（可选）
 */
function updateSpeedDistributionChart(temperature, molarMass) {
    if (!speedDistributionChart) {
        console.warn('图表未初始化，无法更新');
        return;
    }
    console.log(`更新速率分布图表: T=${temperature}K, M=${molarMass}g/mol`);
    const theoreticalData = generateTheoreticalData(temperature, molarMass);
    speedDistributionChart.data.datasets[0].data = theoreticalData;
    // 设置x轴范围（像素域），使用二维瑞利分布的 σ
    const sigma_px = mapTemperatureToPixelSigma2D(temperature, molarMass);
    speedDistributionChart.options.scales.x.min = 0;
    speedDistributionChart.options.scales.x.max = sigma_px * CHART_CONFIG.maxSpeedFactor;
    // 根据理论峰值设置概率密度轴范围（二维瑞利分布在 v=σ 处取峰值）
    const sigma_ms = calculateSigma2D(temperature, molarMass);
    const peak_ms = calculateRayleighPdfMs(sigma_ms, temperature, molarMass);
    const peak_px = peak_ms / getSpeedScale();
    if (isFinite(peak_px)) {
        speedDistributionChart.options.scales.yDensity.suggestedMin = 0;
        speedDistributionChart.options.scales.yDensity.suggestedMax = peak_px * 1.25; // 微调：略增上限，减少截顶
    }
    // 使用默认动画过渡以提升视觉流动感
    speedDistributionChart.update();
}

/**
 * 保存当前实时曲线为快照曲线
 */
function saveCurrentCurve() {
    if (!speedDistributionChart) {
        console.warn('图表未初始化，无法保存曲线');
        return;
    }
    
    const liveCurveData = speedDistributionChart.data.datasets[0].data;
    // 必须进行深拷贝，否则快照会随实时曲线一起变动
    speedDistributionChart.data.datasets[1].data = JSON.parse(JSON.stringify(liveCurveData));
    // 保持交互的轻量动画
    speedDistributionChart.update();
    
    console.log('已保存当前曲线为对比基准');
}

/**
 * 获取当前图表参数并更新图表
 */
function updateChartFromControls() {
    const temperatureSlider = document.getElementById('temperature-slider');
    const gasSelector = document.getElementById('gas-selector');
    const distSelect = document.getElementById('initial-dist-select');
    
    if (!temperatureSlider || !gasSelector) {
        console.warn('控制面板元素未找到，无法更新图表');
        return;
    }
    
    let temperature = parseFloat(temperatureSlider.value);
    const molarMass = parseFloat(gasSelector.value);
    const mode = (distSelect?.value) || window.SimulationModule?.state?.initialDistributionMode || 'equilibrium';

    // 在“双速率分布”或“单速率分布”模式下，使用 Teff 估计来驱动理论曲线，提升与直方图的拟合
    if (mode === 'dual_speed' || mode === 'single_speed') {
        const Teff = getEffectiveTemperatureFromSimulation(molarMass);
        if (Number.isFinite(Teff) && Teff > 0) temperature = Teff;
    }
    
    updateSpeedDistributionChart(temperature, molarMass);
}

// 导出函数供其他模块使用
function updateHistogram(histogram) {
    if (!speedDistributionChart) return;
    // 新增：在每次直方图更新时同步更新理论曲线，确保温度/气体修改即时反映
    try {
        updateChartFromControls();
    } catch (e) {
        console.warn('updateChartFromControls 调用失败:', e);
    }
    try {
        // 诊断日志（非关键路径，避免报错中断）
        const particles = (window.SimulationModule && window.SimulationModule.state && window.SimulationModule.state.particles) || [];
        for (let i = 0; i < Math.min(5, particles.length); i++) {
            const p = particles[i];
            const vx = p.velocity?.x ?? p.vx ?? 0;
            const vy = p.velocity?.y ?? p.vy ?? 0;
            const v = Math.sqrt(vx * vx + vy * vy).toFixed(3);
            console.log(`[Diag] Particle ${i} speed = ${v} (px/frame)`);
        }
        console.log('[Diag] Histogram sample(raw):', histogram.slice(0, 10));
    } catch (e) { console.warn('[Diag] Logging failed:', e); }
    // 获取平滑后的概率密度直方图
    let smoothedPD = [];
    try {
        // 使用统一的状态读取接口获取直方图历史
        const state = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
        const history = Array.isArray(state.histogramHistory) ? state.histogramHistory : [];
        const particlesNow = (window.SimulationModule && window.SimulationModule.state && Array.isArray(window.SimulationModule.state.particles)) ? window.SimulationModule.state.particles : [];
        const mode = window.SimulationModule?.state?.initialDistributionMode || 'equilibrium';
        const alpha = (mode === 'dual_speed') ? 0.2 : 0.3; // 微调：双速率分布降低平滑系数，使峰更贴合
        smoothedPD = getSmoothedHistogramData(history, particlesNow, alpha);
    } catch (e) {
        console.warn('调用数据模块 getSmoothedHistogram 失败，回退到原始数据:', e);
    }
    // Fallback：若平滑函数未返回数据，则基于传入的直方图执行一次性归一化
    if (!Array.isArray(smoothedPD) || smoothedPD.length === 0) {
        const particles = (window.SimulationModule && window.SimulationModule.state && window.SimulationModule.state.particles) || [];
        const N = particles.length || 0;
        const barDataRaw = histogram.map(b => (
            (b && typeof b === 'object' && 'speed' in b)
                ? { x: b.speed, y: b.count }
                : { x: b.x, y: b.y }
        ));
        let binWidth = 0;
        if (barDataRaw.length > 1) {
            const dx = Math.abs((barDataRaw[1]?.x || 0) - (barDataRaw[0]?.x || 0));
            binWidth = Number.isFinite(dx) && dx > 0 ? dx : 0;
        }
        const denom = (N > 0 && binWidth > 0) ? (N * binWidth) : 0;
        smoothedPD = barDataRaw.map(p => ({ x: p.x, y: (denom > 0 ? (p.y / denom) : 0) }));
    }
    speedDistributionChart.data.datasets[2].data = smoothedPD;
    speedDistributionChart.update();
}
window.ChartModule = {
    init: initSpeedDistributionChart,
    updateSpeedDistributionChart: updateSpeedDistributionChart,
    updateFromControls: updateChartFromControls,
    saveCurrentCurve: saveCurrentCurve,
    updateHistogram: updateHistogram
};

console.log('Maxwell速率分布图表模块加载完成');