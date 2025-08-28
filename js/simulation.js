/**
 * Maxwell速率分布粒子动画模拟模块
 * 参考isos_of_gas项目实现恒容气体分子运动模拟
 */

console.log('Maxwell粒子动画模拟模块加载中...');

// 模拟状态
let simulationState = {
    isRunning: false,
    particles: [],
    canvas: null,
    ctx: null,
    animationId: null,
    lastUpdateTime: 0
};

// 模拟配置参数
const SIMULATION_CONFIG = {
    // Canvas尺寸
    width: 400,
    height: 300,
    
    // 粒子参数
    particleRadius: 2,
    maxParticles: 500,
    
    // 物理参数
    timeStep: 0.016, // 约60FPS
    speedScale: 50,  // 速度缩放因子，用于可视化
    
    // 温度-速度映射
    tempMin: 200,    // 最低温度 (K)
    tempMax: 600,    // 最高温度 (K)
    speedMin: 0.5,   // 最低速度 (像素/帧)
    speedMax: 4.0,   // 最高速度 (像素/帧)
    
    // 视觉效果
    particleColor: '#3B82F6',
    backgroundColor: '#F8FAFC',
    wallColor: '#E5E7EB',
    wallThickness: 2
};

// 物理常数（如果未定义则创建）
if (typeof window.PHYSICS_CONSTANTS === 'undefined') {
    window.PHYSICS_CONSTANTS = {
        k: 1.38064852e-23,  // 玻尔兹曼常数 J/K
        R: 8.314,           // 气体常数 J/(mol·K)
        NA: 6.02214076e23   // 阿伏伽德罗常数 mol^-1
    };
}

/**
 * 粒子类
 */
class Particle {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = SIMULATION_CONFIG.particleRadius;
    }
    
    /**
     * 更新粒子位置
     */
    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // 边界碰撞检测
        this.handleWallCollisions();
    }
    
    /**
     * 处理墙壁碰撞
     */
    handleWallCollisions() {
        const { width, height, wallThickness } = SIMULATION_CONFIG;
        
        // 左右墙壁碰撞
        if (this.x - this.radius <= wallThickness) {
            this.x = wallThickness + this.radius;
            this.vx = Math.abs(this.vx); // 反弹
        } else if (this.x + this.radius >= width - wallThickness) {
            this.x = width - wallThickness - this.radius;
            this.vx = -Math.abs(this.vx); // 反弹
        }
        
        // 上下墙壁碰撞
        if (this.y - this.radius <= wallThickness) {
            this.y = wallThickness + this.radius;
            this.vy = Math.abs(this.vy); // 反弹
        } else if (this.y + this.radius >= height - wallThickness) {
            this.y = height - wallThickness - this.radius;
            this.vy = -Math.abs(this.vy); // 反弹
        }
    }
    
    /**
     * 绘制粒子
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = SIMULATION_CONFIG.particleColor;
        ctx.fill();
    }
    
    /**
     * 获取粒子速率
     * @returns {number} 速率 (像素/帧)
     */
    getSpeed() {
        return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    }
    
    /**
     * 设置粒子速度（保持方向，改变大小）
     * @param {number} speed - 新的速率
     */
    setSpeed(speed) {
        const currentSpeed = this.getSpeed();
        if (currentSpeed > 0) {
            const ratio = speed / currentSpeed;
            this.vx *= ratio;
            this.vy *= ratio;
        } else {
            // 如果当前速度为0，随机设置方向
            const angle = Math.random() * 2 * Math.PI;
            this.vx = speed * Math.cos(angle);
            this.vy = speed * Math.sin(angle);
        }
    }
}

/**
 * 初始化粒子模拟
 */
function initParticleSimulation() {
    console.log('初始化粒子模拟...');
    
    const canvas = document.getElementById('simulation-canvas');
    if (!canvas) {
        console.error('未找到模拟canvas元素');
        return;
    }
    
    // 动态设置canvas尺寸以适应容器
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();
    const canvasWidth = Math.max(400, containerRect.width - 20); // 减去padding
    const canvasHeight = Math.max(300, containerRect.height - 60); // 减去标题和padding
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // 更新配置中的尺寸
    SIMULATION_CONFIG.width = canvasWidth;
    SIMULATION_CONFIG.height = canvasHeight;
    
    simulationState.canvas = canvas;
    simulationState.ctx = canvas.getContext('2d');
    
    console.log(`Canvas尺寸设置为: ${canvasWidth}x${canvasHeight}`);
    
    // 初始化粒子
    createParticles();
    
    console.log('粒子模拟初始化完成');
}

/**
 * 创建粒子
 */
function createParticles() {
    const particleCountSlider = document.getElementById('particles-slider');
    const temperatureSlider = document.getElementById('temperature-slider');
    
    if (!particleCountSlider || !temperatureSlider) {
        console.warn('控制面板元素未找到，使用默认参数创建粒子');
        return;
    }
    
    const particleCount = parseInt(particleCountSlider.value);
    const temperature = parseFloat(temperatureSlider.value);
    
    // 清空现有粒子
    simulationState.particles = [];
    
    // 计算安全区域（避免粒子生成在墙壁内）
    const { width, height, wallThickness, particleRadius } = SIMULATION_CONFIG;
    const safeMargin = wallThickness + particleRadius + 2;
    const safeWidth = width - 2 * safeMargin;
    const safeHeight = height - 2 * safeMargin;
    
    // 创建粒子
    for (let i = 0; i < Math.min(particleCount, SIMULATION_CONFIG.maxParticles); i++) {
        // 随机位置（在安全区域内）
        const x = safeMargin + Math.random() * safeWidth;
        const y = safeMargin + Math.random() * safeHeight;
        
        // 根据Maxwell-Boltzmann分布生成速度
        const { vx, vy } = generateMaxwellVelocity(temperature);
        
        const particle = new Particle(x, y, vx, vy);
        simulationState.particles.push(particle);
    }
    
    console.log(`创建了${simulationState.particles.length}个粒子`);
}

/**
 * 根据Maxwell-Boltzmann分布生成粒子速度
 * @param {number} temperature - 温度 (K)
 * @returns {Object} 速度分量 {vx, vy}
 */
function generateMaxwellVelocity(temperature) {
    // 使用Box-Muller变换生成正态分布的速度分量
    const u1 = Math.random();
    const u2 = Math.random();
    
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
    
    // 根据温度计算速度标准差
    const speedStd = mapTemperatureToSpeed(temperature) / Math.sqrt(2);
    
    return {
        vx: z1 * speedStd,
        vy: z2 * speedStd
    };
}

/**
 * 将温度映射到可视化速度
 * @param {number} temperature - 温度 (K)
 * @returns {number} 速度 (像素/帧)
 */
function mapTemperatureToSpeed(temperature) {
    const { tempMin, tempMax, speedMin, speedMax } = SIMULATION_CONFIG;
    
    // 线性映射
    const ratio = (temperature - tempMin) / (tempMax - tempMin);
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    
    return speedMin + clampedRatio * (speedMax - speedMin);
}

/**
 * 更新粒子数量
 */
function updateParticleCount() {
    const particleCountSlider = document.getElementById('particles-slider');
    if (!particleCountSlider) return;
    
    const targetCount = parseInt(particleCountSlider.value);
    const currentCount = simulationState.particles.length;
    
    if (targetCount > currentCount) {
        // 添加粒子
        const temperatureSlider = document.getElementById('temperature-slider');
        const temperature = temperatureSlider ? parseFloat(temperatureSlider.value) : 300;
        
        const { width, height, wallThickness, particleRadius } = SIMULATION_CONFIG;
        const safeMargin = wallThickness + particleRadius + 2;
        const safeWidth = width - 2 * safeMargin;
        const safeHeight = height - 2 * safeMargin;
        
        for (let i = currentCount; i < Math.min(targetCount, SIMULATION_CONFIG.maxParticles); i++) {
            const x = safeMargin + Math.random() * safeWidth;
            const y = safeMargin + Math.random() * safeHeight;
            const { vx, vy } = generateMaxwellVelocity(temperature);
            
            const particle = new Particle(x, y, vx, vy);
            simulationState.particles.push(particle);
        }
    } else if (targetCount < currentCount) {
        // 移除粒子
        simulationState.particles.splice(targetCount);
    }
}

/**
 * 更新粒子温度（重新设置速度）
 */
function updateParticleTemperature() {
    const temperatureSlider = document.getElementById('temperature-slider');
    if (!temperatureSlider) return;
    
    const temperature = parseFloat(temperatureSlider.value);
    
    // 为所有粒子重新生成速度
    simulationState.particles.forEach(particle => {
        const { vx, vy } = generateMaxwellVelocity(temperature);
        particle.vx = vx;
        particle.vy = vy;
    });
}

/**
 * 绘制容器墙壁
 */
function drawWalls() {
    const { ctx } = simulationState;
    const { width, height, wallThickness, wallColor } = SIMULATION_CONFIG;
    
    ctx.fillStyle = wallColor;
    
    // 绘制四面墙壁
    ctx.fillRect(0, 0, width, wallThickness); // 上墙
    ctx.fillRect(0, height - wallThickness, width, wallThickness); // 下墙
    ctx.fillRect(0, 0, wallThickness, height); // 左墙
    ctx.fillRect(width - wallThickness, 0, wallThickness, height); // 右墙
}

/**
 * 渲染一帧
 */
function render() {
    const { ctx, canvas } = simulationState;
    const { backgroundColor } = SIMULATION_CONFIG;
    
    // 清空画布
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制墙壁
    drawWalls();
    
    // 绘制粒子
    simulationState.particles.forEach(particle => {
        particle.draw(ctx);
    });
}

/**
 * 模拟主循环
 * @param {number} currentTime - 当前时间戳
 */
function simulationLoop(currentTime) {
    if (!simulationState.isRunning) return;
    
    const deltaTime = currentTime - simulationState.lastUpdateTime;
    
    // 控制帧率
    if (deltaTime >= SIMULATION_CONFIG.timeStep * 1000) {
        // 更新粒子
        simulationState.particles.forEach(particle => {
            particle.update();
        });
        
        // 渲染
        render();
        
        // 更新图表（每隔一定帧数）
        if (Math.floor(currentTime / 1000) !== Math.floor(simulationState.lastUpdateTime / 1000)) {
            updateChartWithSimulationData();
        }
        
        simulationState.lastUpdateTime = currentTime;
    }
    
    simulationState.animationId = requestAnimationFrame(simulationLoop);
}

/**
 * 使用模拟数据更新图表
 */
function updateChartWithSimulationData() {
    if (!window.ChartModule) return;
    
    // 获取当前参数
    const temperatureSlider = document.getElementById('temperature-slider');
    const gasSelector = document.getElementById('gas-selector');
    
    if (!temperatureSlider || !gasSelector) return;
    
    const temperature = parseFloat(temperatureSlider.value);
    const molarMass = parseFloat(gasSelector.value);
    
    // 只更新实时理论曲线，不再处理模拟数据
    window.ChartModule.updateSpeedDistributionChart(temperature, molarMass);
}

/**
 * 开始模拟
 */
function startSimulation() {
    if (simulationState.isRunning) return;
    
    console.log('开始粒子模拟');
    simulationState.isRunning = true;
    simulationState.lastUpdateTime = performance.now();
    simulationState.animationId = requestAnimationFrame(simulationLoop);
}

/**
 * 暂停模拟
 */
function pauseSimulation() {
    if (!simulationState.isRunning) return;
    
    console.log('暂停粒子模拟');
    simulationState.isRunning = false;
    
    if (simulationState.animationId) {
        cancelAnimationFrame(simulationState.animationId);
        simulationState.animationId = null;
    }
}

/**
 * 重置模拟
 */
function resetSimulation() {
    console.log('重置粒子模拟');
    
    pauseSimulation();
    createParticles();
    render(); // 渲染静态帧
}

// 导出函数供其他模块使用
window.SimulationModule = {
    init: initParticleSimulation,
    start: startSimulation,
    pause: pauseSimulation,
    reset: resetSimulation,
    updateParticleCount: updateParticleCount,
    updateParticleTemperature: updateParticleTemperature,
    createParticles: createParticles
};

console.log('Maxwell粒子动画模拟模块加载完成');