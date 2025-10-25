// 新版 平均自由程 (MFP) 图表模块
// 负责：初始化与更新 自由程分布(bar) 与 平均值收敛(line)

import { calculateTheoreticalMeanFreePath } from './physics/theoretical-values.js';
import { metersToPixels } from './physics.js';

let mfpDistributionChart = null;
let mfpConvergenceChart = null;
let lastCollisionCountForCharts = -1;
let lastLengthsSize = 0;
export function initMFPCharts() {
  try {
    const distCanvas = document.getElementById('mfp-distribution-chart');
    const convCanvas = document.getElementById('mfp-convergence-chart');
    if (distCanvas) {
      mfpDistributionChart = new Chart(distCanvas, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [
            {
              label: '自由程长度分布',
              data: [],
              backgroundColor: 'rgba(75,192,192,0.6)',
              borderColor: 'rgba(75,192,192,1)',
              borderWidth: 1
            },
            // 理论λ竖线（用line数据集绘制两点形成竖线）
            {
              type: 'line',
              label: '理论 λ',
              data: [],
              borderColor: 'rgba(255,99,132,1)',
              backgroundColor: 'rgba(255,99,132,0.2)',
              borderWidth: 2,
              pointRadius: 0,
              fill: false,
              yAxisID: 'y'
            },
            // 模拟λ竖线
            {
              type: 'line',
              label: '模拟 λ',
              data: [],
              borderColor: 'rgba(54,162,235,1)',
              backgroundColor: 'rgba(54,162,235,0.2)',
              borderWidth: 2,
              pointRadius: 0,
              fill: false,
              yAxisID: 'y'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            x: { title: { display: true, text: '自由程长度 (像素)' } },
            y: { title: { display: true, text: '计数' }, beginAtZero: true }
          },
          plugins: { legend: { display: true } }
        }
      });
    }
    if (convCanvas) {
      mfpConvergenceChart = new Chart(convCanvas, {
        type: 'line',
        data: {
          datasets: [
            {
              label: '平均自由程 (λ, 米)',
              data: [],
              borderColor: 'rgba(54,162,235,1)',
              backgroundColor: 'rgba(54,162,235,0.2)',
              borderWidth: 2,
              pointRadius: 3,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            x: { type: 'linear', title: { display: true, text: '碰撞次数' } },
            y: { title: { display: true, text: '平均自由程 (米)' }, beginAtZero: true }
          },
          plugins: {
            legend: { display: true },
            decimation: { enabled: true, algorithm: 'min-max' }
          }
        }
      });
    }
  } catch (e) { console.warn('initMFPCharts 失败:', e); }
}

// 计算并更新图表
export function updateMFPCharts(tracerData = {}, currentState = {}) {
  try {
    if (!mfpDistributionChart || !mfpConvergenceChart) return;
    const lengths = Array.isArray(tracerData.mfpLengths) ? tracerData.mfpLengths : [];
    const collisionCount = tracerData.collisionCount || 0;
    const meanFreePathPx = tracerData.meanFreePath || 0;
    const meanFreePathM = (window.PHYSICS && typeof window.PHYSICS.pixelsToMeters === 'function')
      ? window.PHYSICS.pixelsToMeters(meanFreePathPx)
      : meanFreePathPx;

    // 获取当前参数用于理论λ
    const temperature = currentState.temperature || 300;
    const molarMass = currentState.molarMass || 28.0134; // g/mol
    const particleCount = currentState.particleCount || 300;
    const particleRadius = currentState.particleRadius || 5; // 像素
    const simulationCanvas = document.getElementById('simulation-canvas');
    const area = simulationCanvas ? simulationCanvas.width * simulationCanvas.height : 100000;
    const theoreticalLambdaM = calculateTheoreticalMeanFreePath(temperature, molarMass, particleCount, particleRadius, area);

    // 图一：分布直方图（像素）仅在样本数量变化时重算
    if (lengths.length > 0 && lengths.length !== lastLengthsSize) {
      lastLengthsSize = lengths.length;
      const windowed = lengths.slice(-500);
      const binSize = 10; // 像素
      const maxLength = Math.max(...windowed, 100);
      const numBins = Math.ceil(maxLength / binSize);
      const bins = new Array(numBins).fill(0);
      for (const L of windowed) {
        const idx = Math.min(Math.floor(L / binSize), numBins - 1);
        bins[idx]++;
      }
      const labels = Array.from({ length: numBins }, (_, i) => `${i * binSize}-${(i + 1) * binSize}`);
      mfpDistributionChart.data.labels = labels;
      mfpDistributionChart.data.datasets[0].data = bins;
      // 竖线数据：以y轴最大值绘制（使用分类轴标签而非数值x，避免不显示）
      const yMax = Math.max(...bins, 5);
      const theoryXpx = (typeof metersToPixels === 'function') ? metersToPixels(theoreticalLambdaM) : theoreticalLambdaM;
      const simXpx = meanFreePathPx;
      const theoryIdx = Math.min(Math.floor(theoryXpx / binSize), numBins - 1);
      const simIdx = Math.min(Math.floor(simXpx / binSize), numBins - 1);
      const theoryLabel = labels[theoryIdx];
      const simLabel = labels[simIdx];
      mfpDistributionChart.data.datasets[1].data = [ { x: theoryLabel, y: 0 }, { x: theoryLabel, y: yMax } ];
      mfpDistributionChart.data.datasets[2].data = [ { x: simLabel, y: 0 }, { x: simLabel, y: yMax } ];
      mfpDistributionChart.update();
      // 将分布数据写入状态，便于需要时复用
      try { window.State.updateState({ mfpDistributionData: { bins: labels, counts: bins } }); } catch (e) { /* ignore */ }
    }

    // 图二：收敛曲线（米）仅在碰撞计数变化时追加点
    if (Number.isFinite(collisionCount) && collisionCount !== lastCollisionCountForCharts) {
      lastCollisionCountForCharts = collisionCount;
      try { window.State.appendMFPConvergencePoint({ collisionCount, meanFreePath: meanFreePathM }); } catch (e) { /* ignore */ }
      const history = (window.State.getState && window.State.getState()?.mfpConvergenceHistory) || [];
      mfpConvergenceChart.data.datasets[0].data = history.map(pt => ({ x: pt.collisionCount, y: pt.meanFreePath }));
      mfpConvergenceChart.update();
    }
  } catch (e) { console.warn('updateMFPCharts 失败:', e); }
}

export function resetMFPCharts() {
  try {
    if (mfpDistributionChart) {
      mfpDistributionChart.data.labels = [];
      mfpDistributionChart.data.datasets.forEach(ds => ds.data = []);
      mfpDistributionChart.update();
    }
    if (mfpConvergenceChart) {
      mfpConvergenceChart.data.datasets[0].data = [];
      mfpConvergenceChart.update();
    }
    if (window.State && typeof window.State.resetMFPConvergenceHistory === 'function') {
      window.State.resetMFPConvergenceHistory();
    }
  } catch (e) { console.warn('resetMFPCharts 失败:', e); }
}

export default { initMFPCharts, updateMFPCharts, resetMFPCharts };