// 全局状态管理模块（state.js）
// 负责：应用模式、全局 appState、操作日志及相关接口

// 应用模式（保持与 window 同步，便于旧代码访问）
export let currentAppMode = window.currentAppMode || 'NORMAL_CHAT';
export function setAppMode(mode) {
  currentAppMode = mode;
  window.currentAppMode = mode;
}

// 操作日志（保持全局）
window.operationLog = window.operationLog || [];

// 全局应用状态（从旧版 main.js 迁移）
export const appState = window.appState || {
  initialDistributionMode: 'equilibrium',
  // 全局时间尺度控制：降低视觉速度以减少高速穿墙概率
  simulationTimeScale: 0.1,
  // 直方图历史缓冲区（最近N帧，用于时间平滑）
  histogramHistory: [],
  // 新版引导完成标志（面向 completionCondition 使用）
  stepCompletion: {
    step1: { tempAdjusted: false, gasSwitched: false },
    step2: { evolutionModeUsed: false },
    step3: {}
  },
  feedbackSubmitted: false,
  // 旧版步骤字段（保留以兼容旧代码，后续将逐步下沉移除）
  step1: { temp_adjusted: false, gas_switched: false, text_filled: false },
  step2: { evolution_mode_selected: false, reset_clicked: false, text_filled: false },
  step3: { mode_back_to_equilibrium: false, text_filled: false },
  // ===== 新增：单粒子追踪模式与选择状态 =====
  tracerMode: 'inactive', // 'inactive' | 'selecting' | 'active'
  tracedParticleId: null,
  // ===== 新增：智能评价系统状态 =====
  isFinalized: false,
  isLoadingEvaluation: false,
  evaluationResult: null,
  // ===== 新增：过程数据（与后端接口对齐） =====
  logEntries: window.operationLog || [],
  feedbackHistory: [],
  qaHistory: []
};
// 保持全局引用，兼容依赖 window.appState 的模块
window.appState = appState;

// 添加操作日志记录函数（保持与旧版行为一致：写入日志并尝试刷新 UI）
export function logOperation(eventType, value, additionalData = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: eventType,
    value: value,
    ...additionalData
  };

  window.operationLog.push(logEntry);
  // 同步写入到 appState.logEntries（供统一采集）
  try {
    if (!Array.isArray(appState.logEntries)) appState.logEntries = [];
    appState.logEntries.push(logEntry);
  } catch (e) { /* ignore */ }
  console.log('操作日志记录:', logEntry);

  // 让 UI 管理模块负责显示，但在此处做“软依赖”以避免循环引用
  if (typeof window.updateLogDisplay === 'function') {
    try { window.updateLogDisplay(logEntry); } catch (e) { console.warn('updateLogDisplay 调用失败:', e); }
  }

  return logEntry;
}

export function getOperationLogs() {
  return Array.isArray(window.operationLog) ? window.operationLog.slice() : [];
}

// ===== 新增：统一的状态更新与获取接口 =====
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  Object.keys(source).forEach((key) => {
    const sv = source[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], sv);
    } else {
      target[key] = sv;
    }
  });
  return target;
}

export function updateState(patch) {
  try {
    deepMerge(appState, patch || {});
    // 同步到 window
    window.appState = appState;
    return appState;
  } catch (e) {
    console.warn('State.updateState 失败:', e);
    return appState;
  }
}

// 新增：专用写入器，维护直方图历史的窗口长度
export function appendHistogramFrame(frame, maxFrames = HISTOGRAM_SMOOTHING_FRAMES) {
  try {
    if (!Array.isArray(appState.histogramHistory)) appState.histogramHistory = [];
    appState.histogramHistory.push(frame);
    const limit = Number.isFinite(maxFrames) ? maxFrames : HISTOGRAM_SMOOTHING_FRAMES;
    while (appState.histogramHistory.length > limit) {
      appState.histogramHistory.shift();
    }
    // 同步到 window 以兼容旧代码
    window.appState = appState;
    return appState.histogramHistory.length;
  } catch (e) {
    console.warn('State.appendHistogramFrame 失败:', e);
    return appState.histogramHistory.length;
  }
}

export function getState() {
  return appState;
}

// 暴露简单上下文到 window 以便 flow-manager 使用
window.State = {
  updateState,
  getState,
  appendHistogramFrame
};

// ===== 新增：直方图时间平滑窗口大小（常量） =====
export const HISTOGRAM_SMOOTHING_FRAMES = 15; // 平滑窗口大小（帧数）
// 暴露到 window，便于非模块代码访问
window.HISTOGRAM_SMOOTHING_FRAMES = HISTOGRAM_SMOOTHING_FRAMES;