// 事件绑定模块（event-handler.js）
// 负责：
// 1) 引导面板文本输入监听，将步骤完成状态回写到 appState
// 2) AI 聊天与结论提交的事件处理与绑定
import { appState, currentAppMode, setAppMode, getOperationLogs, updateState, getState } from './state.js';
import { addMessageToChat, showThinkingBubble, removeThinkingBubble, showInputErrorAnimation, showEvaluationReportModal, finishExperiment, showLoadingModal, hideLoadingModal, showErrorModal, lockUI } from './ui-manager.js';
import * as SimulationModule from './simulation.js';

// AI聊天状态（迁移自 main.js）
let chatHistory = [];
let isThinking = false;

// 安全控制：在本模块内统一提供暂停/启动/重置追踪统计的回退封装
function safePause() {
  try {
    if (SimulationModule && typeof SimulationModule.pause === 'function') return SimulationModule.pause();
    if (window.SimulationModule && typeof window.SimulationModule.pause === 'function') return window.SimulationModule.pause();
  } catch (e) { console.warn('safePause 调用失败:', e); }
}
function safeStart() {
  try {
    if (SimulationModule && typeof SimulationModule.start === 'function') return SimulationModule.start();
    if (window.SimulationModule && typeof window.SimulationModule.start === 'function') return window.SimulationModule.start();
  } catch (e) { console.warn('safeStart 调用失败:', e); }
}
function safeResetTracerStats() {
  try {
    if (SimulationModule && typeof SimulationModule.resetTracerStats === 'function') return SimulationModule.resetTracerStats();
    if (window.SimulationModule && typeof window.SimulationModule.resetTracerStats === 'function') return window.SimulationModule.resetTracerStats();
  } catch (e) { /* ignore */ }
}

function getAskAiBtnAlias() {
  const askAiBtn = document.getElementById('ask-ai-btn');
  const sendBtn = document.getElementById('send-btn');
  return askAiBtn || sendBtn || null;
}

// 初始化聊天相关事件绑定（迁移自 main.js DOMContentLoaded 段）
export function initChatHandlers() {
  const askAiBtn = document.getElementById('ask-ai-btn');
  const sendBtn = document.getElementById('send-btn');
  const submitConclusionBtn = document.getElementById('submit-conclusion-btn');
  const chatInput = document.getElementById('chat-input');
  const evaluateBtn = document.getElementById('evaluate-btn');

  const sendHandler = () => handleSendMessage();
  const conclusionHandler = () => handleConclusionSubmission();
  const evalHandler = () => handleEvaluationRequest();
  const keypressHandler = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (currentAppMode === 'CONCLUSION_SUBMISSION') {
        handleConclusionSubmission();
      } else {
        handleSendMessage();
      }
    }
  };

  // 初始时：完成实验按钮仅在实验完全结束后开启
  if (evaluateBtn) {
    try {
      const locked = !!(window.isExperimentLocked || (window.State && window.State.getState && window.State.getState().isFinalized));
      evaluateBtn.disabled = !locked;
    } catch (e) { /* ignore */ }
  }

  if (askAiBtn) askAiBtn.addEventListener('click', sendHandler);
  if (sendBtn) sendBtn.addEventListener('click', sendHandler);
  if (submitConclusionBtn) submitConclusionBtn.addEventListener('click', conclusionHandler);
  if (chatInput) chatInput.addEventListener('keypress', keypressHandler);
  if (evaluateBtn) evaluateBtn.addEventListener('click', evalHandler);
}

export function attachGuidanceInputListeners(stepIndex) {
  try {
    const map = {
      0: 'guided1-text',
      1: 'guided2-text',
      2: 'guided3-text',
      3: 'guided4-text'
    };
    const textId = map[stepIndex];
    if (!textId) return;
    const textarea = document.getElementById(textId);
    if (!textarea) return;
    const handler = () => {
      const val = (textarea.value || '').trim();
      const filled = val.length > 0;
      // 统一通过 State.updateState 写入步骤文本填充状态
      try {
        if (stepIndex === 0) updateState({ step1: { text_filled: filled } });
        else if (stepIndex === 1) updateState({ step2: { text_filled: filled } });
        else if (stepIndex === 2) updateState({ step3: { text_filled: filled } });
      } catch (e) {
        if (stepIndex === 0) appState.step1.text_filled = filled;
        else if (stepIndex === 1) appState.step2.text_filled = filled;
        else if (stepIndex === 2) appState.step3.text_filled = filled;
      }
      // 与旧代码保持兼容：如果存在全局 checkCompletion，则调用以刷新状态
      if (typeof window.checkCompletion === 'function') {
        try { window.checkCompletion(); } catch (e) { console.warn('checkCompletion 调用失败:', e); }
      }
    };
    // 立即更新一次状态
    handler();
    // 防重复绑定
    if (textarea.__guidedHandler) {
      textarea.removeEventListener('input', textarea.__guidedHandler);
    }
    textarea.__guidedHandler = handler;
    textarea.addEventListener('input', handler);
    console.log('Guidance input listeners attached for step', stepIndex, '->', textId);
  } catch (err) {
    console.error('attachGuidanceInputListeners error:', err);
  }
}

// 暴露到 window 以兼容现有调用
window.attachGuidanceInputListeners = attachGuidanceInputListeners;

// ========== 新增：单粒子追踪交互绑定 ==========
function ensureTracerOverlay() {
  const panel = document.getElementById('simulation-panel');
  if (!panel) return null;
  panel.style.position = panel.style.position || 'relative';
  let overlay = document.getElementById('tracer-select-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tracer-select-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '8px';
    overlay.style.left = '50%';
    overlay.style.transform = 'translateX(-50%)';
    overlay.style.zIndex = '10';
    overlay.style.padding = '8px 12px';
    overlay.style.border = '1px dashed #6c757d';
    overlay.style.borderRadius = '6px';
    overlay.style.background = 'rgba(255,255,255,0.92)';
    overlay.style.color = '#333';
    overlay.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
    overlay.style.display = 'none';
    overlay.innerHTML = '<span style="font-size:13px;">请点击一个粒子以开始追踪</span>';
    panel.appendChild(overlay);
  }
  return overlay;
}
function showTracerOverlay() {
  const overlay = ensureTracerOverlay();
  if (overlay) overlay.style.display = 'block';
}
function hideTracerOverlay() {
  const overlay = document.getElementById('tracer-select-overlay');
  if (overlay) overlay.style.display = 'none';
}
function setCanvasCursor(style) {
  const canvas = document.getElementById('simulation-canvas');
  if (!canvas) return;
  canvas.style.cursor = style || 'default';
}

export function initTracerInteractions() {
  const traceBtn = document.getElementById('trace-particle-btn');
  const canvas = document.getElementById('simulation-canvas');
  if (!traceBtn || !canvas) {
    console.warn('Trace button or canvas not found');
    return;
  }
  // 按钮：在 inactive -> selecting； selecting/active -> inactive
  const handleTraceToggle = () => {
    const st = window.State.getState();
    const mode = st.tracerMode || 'inactive';
    if (mode === 'inactive') {
      // 进入选择模式：必须暂停模拟
      safePause();
      showTracerOverlay();
      setCanvasCursor('crosshair');
      window.State.updateState({ tracerMode: 'selecting', tracedParticleId: null });
    } else {
      // 退出追踪模式：恢复模拟，并清理状态
      hideTracerOverlay();
      setCanvasCursor('default');
      safeStart();
      safeResetTracerStats();
      window.State.updateState({ tracerMode: 'inactive', tracedParticleId: null });
    }
  };
  traceBtn.addEventListener('click', handleTraceToggle);

  // 画布点击：仅在 selecting 模式下有效
  const handleCanvasClick = (evt) => {
    const st = window.State.getState();
    if ((st.tracerMode || 'inactive') !== 'selecting') return;
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const sim = SimulationModule.state || window.SimulationModule?.state;
    if (!sim || !Array.isArray(sim.particles)) return;
    const radius = (SimulationModule.config && SimulationModule.config.particleRadius) || sim.particleRadius || 5;
    const clicked = sim.particles.find(p => {
      const dx = p.position.x - x;
      const dy = p.position.y - y;
      return Math.sqrt(dx*dx + dy*dy) <= (p.circleRadius || radius);
    });
    if (!clicked) return; // 未点击到粒子则维持选择模式

    // 记录追踪粒子ID并进入 active
    sim.tracedParticleId = clicked.id;
    if (!sim.tracerData) sim.tracerData = { totalDistance: 0, collisionCount: 0, lastPosition: null };
    sim.tracerData.totalDistance = 0;
    sim.tracerData.collisionCount = 0;
    sim.tracerData.lastPosition = { x: clicked.position.x, y: clicked.position.y };
    sim.tracerFrameCounter = 0;

    window.State.updateState({ tracedParticleId: clicked.id, tracerMode: 'active' });
    // 恢复模拟并开始追踪
    hideTracerOverlay();
    setCanvasCursor('default');
    safeStart();
  };
  canvas.addEventListener('click', handleCanvasClick);
}

// ========== AI问答功能 ==========
export async function handleSendMessage() {
  const chatInput = document.getElementById('chat-input');
  const chatLog = document.getElementById('chat-log');
  const askBtn = getAskAiBtnAlias();
  if (!chatInput || !chatLog || !askBtn) {
    console.error('Chat elements not found:', { chatInput, chatLog, askBtn });
    return;
  }
  const message = (chatInput.value || '').trim();
  if (!message || isThinking) return;
  addMessageToChat('user', message);
  chatHistory.push({ role: 'user', content: message });
  // 记录到全局 qaHistory（仅保留用户问题）
  try {
    const st = getState();
    if (!Array.isArray(st.qaHistory)) st.qaHistory = [];
    st.qaHistory.push({ timestamp: new Date().toISOString(), question: message });
    updateState({ qaHistory: st.qaHistory });
  } catch (e) { /* ignore */ }
  // 视为本步骤的反馈已提交（用于解锁）
  try {
    updateState({ feedbackSubmitted: true });
    if (typeof window.checkAndUnlockNextButton === 'function') {
      window.checkAndUnlockNextButton(window.currentStepIndex || 0);
    }
  } catch (e) { /* ignore */ }
  // 统一通过 State.updateState 标记文本区已填写
  try {
    const stepIndex = window.currentStepIndex || 0;
    if (stepIndex === 0) updateState({ step1: { text_filled: true } });
    else if (stepIndex === 1) updateState({ step2: { text_filled: true } });
    else if (stepIndex === 2) updateState({ step3: { text_filled: true } });
    if (typeof window.checkCompletion === 'function') { window.checkCompletion(); }
  } catch (e) { console.warn('Step text completion update failed:', e); }
  chatInput.value = '';
  askBtn.disabled = true;
  isThinking = true;
  showThinkingBubble();
  try {
    const aiResponse = await window.getAiResponse(message, chatHistory);
    removeThinkingBubble();
    addMessageToChat('assistant', aiResponse);
    chatHistory.push({ role: 'assistant', content: aiResponse });
  } catch (error) {
    console.error('AI response error:', error);
    removeThinkingBubble();
    addMessageToChat('assistant', '抱歉，我现在无法回答您的问题。请稍后再试。');
  } finally {
    askBtn.disabled = false;
    isThinking = false;
  }
}

// 进入结论提交模式时的输入区配置（迁移自 main.js）
export function activateConclusionMode() {
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  if (chatInput) {
    chatInput.placeholder = '请详细描述你发现的关于温度、分子质量与粒子速率之间的关系...';
    chatInput.value = '';
    if (chatInput.__conclusionKeyHandler) {
      chatInput.removeEventListener('keypress', chatInput.__conclusionKeyHandler);
    }
    const keyHandler = (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const submitButton = document.getElementById('submit-conclusion-btn');
        const isInConclusionMode = submitButton && !submitButton.disabled && submitButton.textContent.includes('提交实验结论');
        if (isInConclusionMode) handleConclusionSubmission();
      }
    };
    chatInput.__conclusionKeyHandler = keyHandler;
    chatInput.addEventListener('keypress', keyHandler);
  }
  if (sendBtn) {
    sendBtn.textContent = '提交实验结论';
    sendBtn.disabled = false;
    sendBtn.style.opacity = '1';
    sendBtn.style.cursor = 'pointer';
    if (sendBtn.__clickHandler) {
      sendBtn.removeEventListener('click', sendBtn.__clickHandler);
    }
    const clickHandler = () => handleConclusionSubmission();
    sendBtn.__clickHandler = clickHandler;
    sendBtn.addEventListener('click', clickHandler);
  }
}

// 处理结论提交（迁移自 main.js）
export async function handleConclusionSubmission() {
  const chatInput = document.getElementById('chat-input');
  const conclusion = chatInput ? chatInput.value.trim() : '';
  const submitButton = document.getElementById('submit-conclusion-btn');
  const chatHistoryContainer = document.getElementById('chat-log');
  if (!conclusion) { showInputErrorAnimation(); return; }
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = '思考中...'; }
  addMessageToChat('user', conclusion);
  if (chatInput) { chatInput.value = ''; }
  if (chatHistoryContainer) { chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight; }
  // 新增：写入用户反馈历史（按步骤记录）
  const stepId = (window.currentStepIndex || 0) + 1;
  try {
    const st = getState();
    if (!Array.isArray(st.feedbackHistory)) st.feedbackHistory = [];
    st.feedbackHistory.push({ stepId, content: conclusion, timestamp: new Date().toISOString() });
    updateState({ feedbackHistory: st.feedbackHistory });
  } catch (e) { /* ignore */ }
  try {
    // 调用“每步结论批改”后端端点
    const _stepId = stepId;
    const resp = await fetch('/api/critique-step-conclusion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, studentConclusion: conclusion })
    });
    if (resp.ok) {
      const data = await resp.json();
      const critiqueText = data?.critique || '批改已生成。';
      addMessageToChat('assistant', critiqueText);
    } else {
      addMessageToChat('assistant', '批改服务暂不可用，请稍后再试。');
    }
  } catch (err) {
    console.error('提交结论失败:', err);
    addMessageToChat('assistant', '网络错误或服务不可用，请稍后再试。');
  } finally {
    // 始终保持“提交实验结论”按钮启用（仅在请求期间暂时禁用）
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = '提交实验结论'; }
    // 标记反馈/结论已提交以支持解锁逻辑
    try {
      updateState({ feedbackSubmitted: true });
      if (typeof window.checkAndUnlockNextButton === 'function') {
        window.checkAndUnlockNextButton(window.currentStepIndex || 0);
      }
    } catch (e) { /* ignore */ }
    // 不再锁定页面，允许用户继续探索与多次提交
  }
}

// 反馈输入模式（迁移自 main.js）
export function activateFeedbackMode() {
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  if (chatInput) {
    chatInput.placeholder = '请输入您的反馈或建议（可选）';
    chatInput.disabled = false;
    chatInput.value = '';
    if (chatInput.__conclusionKeyHandler) {
      chatInput.removeEventListener('keypress', chatInput.__conclusionKeyHandler);
      chatInput.__conclusionKeyHandler = null;
    }
    if (chatInput.__feedbackKeyHandler) {
      chatInput.removeEventListener('keypress', chatInput.__feedbackKeyHandler);
    }
    const keyHandler = (event) => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleFeedbackSubmission(); }
    };
    chatInput.__feedbackKeyHandler = keyHandler;
    chatInput.addEventListener('keypress', keyHandler);
  }
  if (sendBtn) {
    sendBtn.textContent = '提交反馈';
    sendBtn.disabled = false;
    if (sendBtn.__clickHandler) {
      sendBtn.removeEventListener('click', sendBtn.__clickHandler);
    }
    const clickHandler = () => handleFeedbackSubmission();
    sendBtn.__clickHandler = clickHandler;
    sendBtn.addEventListener('click', clickHandler);
  }
}

export function handleFeedbackSubmission() {
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const feedback = chatInput ? chatInput.value.trim() : '';
  if (!feedback) { finishExperiment(); return; }
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '提交中...'; }
  addMessageToChat('user', feedback);
  if (chatInput) { chatInput.value = ''; }
  // 标记反馈已提交
  try {
    updateState({ feedbackSubmitted: true });
    if (typeof window.checkAndUnlockNextButton === 'function') {
      window.checkAndUnlockNextButton(window.currentStepIndex || 0);
    }
  } catch (e) { /* ignore */ }
  setTimeout(() => {
    addMessageToChat('assistant', '已收到您的反馈，感谢您的参与！');
    setTimeout(() => { finishExperiment(); }, 1000);
  }, 500);
}

// 兼容暴露（如有需要）
window.handleSendMessage = handleSendMessage;
window.handleConclusionSubmission = handleConclusionSubmission;
// 新增暴露：追踪交互绑定
window.initTracerInteractions = initTracerInteractions;
window.handleEvaluationRequest = handleEvaluationRequest;

export async function handleEvaluationRequest() {
  const evalBtn = document.getElementById('evaluate-btn');
  if (evalBtn) { evalBtn.disabled = true; evalBtn.textContent = '正在评估...'; }
  // 1. 锁定 UI 并显示加载状态
  try {
    updateState({ isFinalized: true, isLoadingEvaluation: true });
  } catch (e) { /* ignore */ }
  try { lockUI(true); } catch (e) { /* ignore */ }
  showLoadingModal('正在生成评价报告，请稍候...');

  try {
    // 2. 收集数据
    const currentState = getState();
    const dataToSend = {
      operationLog: Array.isArray(currentState.logEntries) ? currentState.logEntries : (window.operationLog || []),
      userFeedback: Array.isArray(currentState.feedbackHistory) ? currentState.feedbackHistory : [],
      qaHistory: Array.isArray(currentState.qaHistory) ? currentState.qaHistory : []
    };

    // 3. 调用后端 API
    const response = await fetch('/api/evaluate-experiment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSend)
    });

    if (!response.ok) {
      let errMsg = `API request failed with status ${response.status}`;
      try { const errData = await response.json(); errMsg = errData.error || errMsg; } catch (_) {}
      throw new Error(errMsg);
    }

    const evaluationData = await response.json();

    // 4. 存储结果并更新 UI
    updateState({ evaluationResult: evaluationData, isLoadingEvaluation: false });
    hideLoadingModal();
    showEvaluationReportModal(evaluationData);
  } catch (error) {
    console.error('Evaluation failed:', error);
    try { updateState({ isLoadingEvaluation: false }); } catch (_) {}
    hideLoadingModal();
    const msg = `评价生成失败: ${error && error.message ? error.message : '未知错误'}`;
    showErrorModal(msg);
    // 本地静态预览下的降级方案：无法访问后端 API 时，展示示例评价结果，便于联调 UI
    try {
      const isLocal = ['localhost','127.0.0.1'].includes(window.location.hostname);
      const noNodeServer = isLocal; // 在本环境下 python http.server 无 API 路由
      if (noNodeServer) {
        const mock = {
          evaluation_summary: '（本地示例）该实验报告总体表现良好，观察敏锐且能初步建立模型框架。',
          dimensions: {
            systematic_exploration: { score: 7, justification: '有明确的变量控制，但少数步骤不够连贯。' },
            critical_data_coverage: { score: 6, justification: '覆盖了部分关键区域，低温探索不足。' },
            observational_acuity: { score: 8, justification: '能较准确描述真实与理想曲线的偏离现象。' },
            hypothesis_testing: { score: 5, justification: '提出了初步假设，但验证步骤偏少。' },
            tool_utilization: { score: 7, justification: '使用了监视器与图表，但综合分析可进一步加强。' }
          },
          overall_score: 6.6,
          suggestions_for_improvement: '下一次请在关键区域做更系统的扫描，并明确提出可验证的假设与步骤。'
        };
        showEvaluationReportModal(mock);
      }
    } catch (_) { /* ignore */ }
    // 注意：此时 isFinalized 仍为 true，页面保持锁定
  }
}