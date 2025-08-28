/**
 * Maxwell速率分布图表模块
 * 使用Chart.js实现动态速率分布曲线绘制
 */

console.log('Maxwell速率分布图表模块加载中...');

// 图表实例
let speedDistributionChart = null;

// 物理常数（如果未定义则创建）
if (typeof window.PHYSICS_CONSTANTS === 'undefined') {
    window.PHYSICS_CONSTANTS = {
        k: 1.38064852e-23,  // 玻尔兹曼常数 J/K
        R: 8.314,           // 气体常数 J/(mol·K)
        NA: 6.02214076e23   // 阿伏伽德罗常数 mol^-1
    };
}

// 图表配置
const CHART_CONFIG = {
    pointCount: 200,     // 曲线数据点数量
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
    return Math.sqrt(3 * window.PHYSICS_CONSTANTS.R * temperature / M);
}

/**
 * 计算Maxwell分布的峰值高度
 * @param {number} temperature - 温度 (K)
 * @param {number} molarMass - 摩尔质量 (g/mol)
 * @returns {number} 分布函数的峰值
 */
function calculatePeakFv(temperature, molarMass) {
    // 最概然速率
    const M = molarMass / 1000;
    const vp = Math.sqrt(2 * window.PHYSICS_CONSTANTS.R * temperature / M);
    // 在最概然速率处计算分布函数值
    return calculateMaxwellDistribution(vp, temperature, molarMass);
}

/**
 * 初始化速率分布图表
 */
function initSpeedDistributionChart() {
    console.log('初始化速率分布图表...');
    
    const canvas = document.getElementById('speed-distribution-chart');
    if (!canvas) {
        console.error('未找到速率分布图表canvas元素');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // 检查Chart.js是否可用
    if (typeof Chart === 'undefined') {
        console.error('Chart.js未加载，无法创建图表');
        return;
    }
    
    // 计算固定坐标轴范围
    // 设置一个固定的、足够宽的X轴最大值，以增强曲线平移的视觉效果
    // 3500 m/s 能够容纳大多数教学场景，并为高速运动提供充足的可视空间
    const maxXValue = 3500; // 固定X轴最大值，增强视觉冲击力
    const maxYValue = calculatePeakFv(200, 44) * 1.2; // 低温CO2的峰值高度的1.2倍
    
    // 创建Chart.js实例
    speedDistributionChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: '当前理论曲线',
                    data: [],
                    borderColor: CHART_CONFIG.colors.theoretical,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1
                },
                {
                    label: '已保存的对比曲线',
                    data: [],
                    borderColor: CHART_CONFIG.colors.snapshot,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    min: 0,
                    max: maxXValue, // 使用固定的3500 m/s最大值
                    title: {
                        display: true,
                        text: '速率 v (m/s)',
                        color: '#374151',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: '#E5E7EB',
                        lineWidth: 1
                    },
                    ticks: {
                        color: '#6B7280'
                    }
                },
                y: {
                    min: 0,
                    max: maxYValue,
                    title: {
                        display: true,
                        text: '分布函数 f(v)',
                        color: '#374151',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: '#E5E7EB',
                        lineWidth: 1
                    },
                    ticks: {
                        color: '#6B7280'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#374151',
                        font: {
                            size: 11
                        },
                        usePointStyle: true,
                        pointStyle: 'line'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toExponential(3)}`;
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
    
    console.log('速率分布图表初始化完成');
}

/**
 * 计算Maxwell-Boltzmann速率分布函数
 * @param {number} v - 速率 (m/s)
 * @param {number} temperature - 温度 (K)
 * @param {number} molarMass - 摩尔质量 (g/mol)
 * @returns {number} 分布函数值
 */
function calculateMaxwellDistribution(v, temperature, molarMass) {
    // 将摩尔质量从g/mol转换为kg/mol
    const M = molarMass / 1000;
    
    // 单分子质量 (kg)
    const m = M / window.PHYSICS_CONSTANTS.NA;
    
    // Maxwell-Boltzmann分布函数
    // f(v) = 4π * v² * (m/(2πkT))^(3/2) * exp(-mv²/(2kT))
    const factor1 = 4 * Math.PI * v * v;
    const factor2 = Math.pow(m / (2 * Math.PI * window.PHYSICS_CONSTANTS.k * temperature), 1.5);
    const factor3 = Math.exp(-m * v * v / (2 * window.PHYSICS_CONSTANTS.k * temperature));
    
    return factor1 * factor2 * factor3;
}

/**
 * 生成理论速率分布数据
 * @param {number} temperature - 温度 (K)
 * @param {number} molarMass - 摩尔质量 (g/mol)
 * @returns {Array} 数据点数组 [{x: speed, y: distribution}, ...]
 */
function generateTheoreticalData(temperature, molarMass) {
    const data = [];
    
    // 计算最概然速率作为参考
    const M = molarMass / 1000; // kg/mol
    const vp = Math.sqrt(2 * window.PHYSICS_CONSTANTS.R * temperature / M);
    
    // 速率范围：0 到 最概然速率的4倍
    const maxSpeed = vp * CHART_CONFIG.maxSpeedFactor;
    const speedStep = maxSpeed / CHART_CONFIG.pointCount;
    
    for (let i = 0; i <= CHART_CONFIG.pointCount; i++) {
        const speed = i * speedStep;
        const distribution = calculateMaxwellDistribution(speed, temperature, molarMass);
        data.push({ x: speed, y: distribution });
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
    
    // 生成理论数据
    const theoreticalData = generateTheoreticalData(temperature, molarMass);
    
    // 更新实时曲线数据
    speedDistributionChart.data.datasets[0].data = theoreticalData;
    
    // 更新图表
    speedDistributionChart.update('none'); // 使用'none'模式提高性能
}

/**
 * 从粒子速度数据生成模拟分布数据
 * @param {Array} particleSpeeds - 粒子速度数组 [v1, v2, v3, ...]
 * @param {number} temperature - 温度 (K)
 * @param {number} molarMass - 摩尔质量 (g/mol)
 * @returns {Array} 模拟分布数据点数组
 */


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
    speedDistributionChart.update('none'); // 使用'none'参数防止不必要的重绘动画
    
    console.log('已保存当前曲线为对比基准');
}

/**
 * 获取当前图表参数并更新图表
 */
function updateChartFromControls() {
    const temperatureSlider = document.getElementById('temperature-slider');
    const gasSelector = document.getElementById('gas-selector');
    
    if (!temperatureSlider || !gasSelector) {
        console.warn('控制面板元素未找到，无法更新图表');
        return;
    }
    
    const temperature = parseFloat(temperatureSlider.value);
    const molarMass = parseFloat(gasSelector.value);
    
    updateSpeedDistributionChart(temperature, molarMass);
}

// 导出函数供其他模块使用
window.ChartModule = {
    init: initSpeedDistributionChart,
    updateSpeedDistributionChart: updateSpeedDistributionChart,
    updateFromControls: updateChartFromControls,
    saveCurrentCurve: saveCurrentCurve
};

console.log('Maxwell速率分布图表模块加载完成');