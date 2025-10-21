// UI 管理模块（ui-manager.js）
// 负责：聊天区消息渲染、思考气泡、日志浮窗、日志显示，以及通用UI更新（模态、提示、时间尺度、理论值等）

// 更新操作日志显示（从 main.js 迁移）
export function updateLogDisplay(logEntry) {
  const logContent = document.getElementById('log-content');
  if (!logContent) return;

  const logItem = document.createElement('div');
  logItem.className = 'log-item';

  const timeStr = new Date(logEntry.timestamp).toLocaleTimeString();
  let displayText = '';

  switch (logEntry.event) {
    case 'set_temperature':
      displayText = `${timeStr} - 设置温度: ${logEntry.value}K`;
      break;
    case 'change_gas':
      displayText = `${timeStr} - 切换气体: ${logEntry.value}`;
      break;
    case 'save_curve':
      displayText = `${timeStr} - 保存对比曲线`;
      break;
    case 'reset_simulation':
      displayText = `${timeStr} - 重置模拟`;
      break;
    default:
      displayText = `${timeStr} - ${logEntry.event}: ${logEntry.value}`;
  }

  logItem.textContent = displayText;
  logContent.appendChild(logItem);

  // 滚动到底部
  logContent.scrollTop = logContent.scrollHeight;
}

// 初始化操作日志浮窗（从 main.js 迁移）
export function initializeLogFloater() {
  const toggleBtn = document.getElementById('toggle-log-btn');
  const logContent = document.getElementById('log-content');

  if (toggleBtn && logContent) {
    toggleBtn.addEventListener('click', () => {
      if (logContent.style.display === 'none') {
        logContent.style.display = 'block';
        toggleBtn.textContent = '-';
      } else {
        logContent.style.display = 'none';
        toggleBtn.textContent = '+';
      }
    });
  }
}

// 聊天消息渲染（从 main.js 迁移）
export function addMessageToChat(role, content) {
  const chatLog = document.getElementById('chat-log');
  if (!chatLog) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  messageDiv.textContent = content;

  chatLog.appendChild(messageDiv);

  // 滚动到底部
  chatLog.scrollTop = chatLog.scrollHeight;
}

export function showThinkingBubble() {
  const chatLog = document.getElementById('chat-log');
  if (!chatLog) return;

  const thinkingDiv = document.createElement('div');
  thinkingDiv.id = 'ai-thinking';
  thinkingDiv.className = 'message-wrapper assistant-message';
  thinkingDiv.innerHTML = `
        <div class="message-content thinking">
            <div class="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span class="thinking-text">AI正在思考中...</span>
        </div>
    `;

  chatLog.appendChild(thinkingDiv);
  chatLog.scrollTop = chatLog.scrollHeight;
}

export function removeThinkingBubble() {
  const thinkingBubble = document.getElementById('ai-thinking');
  if (thinkingBubble) {
    thinkingBubble.remove();
  }
}

// 页面进入时的引导提示条（从 main.js 迁移）
export function showOnboardingPrompt() {
  try {
    const banner = document.createElement('div');
    banner.id = 'onboarding-banner';
    banner.style.cssText = [
      'position:fixed',
      'top:12px',
      'left:50%',
      'transform:translateX(-50%)',
      'max-width:860px',
      'width:90%',
      'background:#fffbe6',
      'color:#444',
      'border:1px solid #f0c36d',
      'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
      'border-radius:8px',
      'padding:12px 16px',
      'z-index:9999',
      'display:flex',
      'align-items:center',
      'gap:12px'
    ].join(';');

    const msg = document.createElement('div');
    msg.style.flex = '1';
    msg.innerHTML = '<strong>提示：</strong>请先按照右侧“实验引导”完成任务，然后再进入自由探索与AI问答。';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '我已了解';
    closeBtn.style.cssText = [
      'padding:6px 12px',
      'background:#3B82F6',
      'color:#fff',
      'border:none',
      'border-radius:6px',
      'cursor:pointer'
    ].join(';');
    closeBtn.addEventListener('click', () => { banner.remove(); });

    banner.appendChild(msg);
    banner.appendChild(closeBtn);
    document.body.appendChild(banner);
  } catch (e) {
    console.warn('显示引导提示失败:', e);
  }
}

// 显示评价报告模态（新增）
export function showEvaluationReportModal(data) {
  try {
    const overlay = document.getElementById('evaluation-modal-overlay');
    const contentEl = document.getElementById('evaluation-modal-content');
    const closeBtn = document.getElementById('evaluation-close-btn');
    if (!overlay || !contentEl) return;

    // 将原始数据标准化
    const normalized = (data && typeof data === 'object') ? data : { message: String(data || '评价报告已生成') };

    // 图标评分渲染辅助函数（10分制映射为5星）
    const renderStars = (score) => {
      const s = typeof score === 'number' ? Math.max(0, Math.min(10, score)) : 0;
      const filled = Math.round(s / 2);
      const empty = 5 - filled;
      return `<span style="color:#f5a623; font-size:18px; letter-spacing:1px;">${'★'.repeat(filled)}${'☆'.repeat(empty)}</span>`;
    };

    // 维度名称映射
    const dimName = {
      systematic_exploration: '系统性探索',
      critical_data_coverage: '关键数据覆盖',
      observational_acuity: '观察敏锐度',
      hypothesis_testing: '假设与验证',
      tool_utilization: '工具使用与整合'
    };

    // 构建富文本内容
    let html = '';
    html += `<div style="margin-bottom:12px;">
      <div style="font-weight:bold; font-size:16px; margin-bottom:6px;">评价摘要</div>
      <div style="background:#fff; border:1px solid #e9ecef; border-radius:8px; padding:10px;">${
        normalized.evaluation_summary
          ? normalized.evaluation_summary
          : (normalized.message || '评价报告已生成')
      }</div>
    </div>`;

    // 评分面板
    if (normalized.dimensions && typeof normalized.dimensions === 'object') {
      html += `<div style="margin-bottom:12px;">
        <div style="font-weight:bold; font-size:16px; margin-bottom:6px;">维度评分</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">`;

      Object.keys(normalized.dimensions).forEach((key) => {
        const item = normalized.dimensions[key] || {};
        const name = dimName[key] || key;
        const score = item.score ?? '--';
        const justification = item.justification || '';
        html += `<div style="background:#fff; border:1px solid #e9ecef; border-radius:8px; padding:10px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div style="font-weight:600;">${name}</div>
            <div>${renderStars(typeof score === 'number' ? score : 0)} <span style="margin-left:6px; color:#555;">${score}/10</span></div>
          </div>
          ${justification ? `<div style="margin-top:8px; color:#444; line-height:1.6;">${justification}</div>` : ''}
        </div>`;
      });

      html += `</div></div>`;
    }

    // 总分与改进建议
    if (typeof normalized.overall_score === 'number' || normalized.suggestions_for_improvement) {
      html += `<div style="display:flex; gap:12px;">
        ${typeof normalized.overall_score === 'number'
          ? `<div style="flex:0 0 220px; background:#fff; border:1px solid #e9ecef; border-radius:8px; padding:10px;">
               <div style="font-weight:bold; font-size:16px; margin-bottom:6px;">综合评分</div>
               <div style="font-size:28px; font-weight:700; color:#2b8a3e;">${normalized.overall_score.toFixed(1)}</div>
               <div style="margin-top:4px; color:#666;">${renderStars(normalized.overall_score)}</div>
             </div>`
          : ''}
        ${normalized.suggestions_for_improvement
          ? `<div style="flex:1; background:#fff; border:1px solid #e9ecef; border-radius:8px; padding:10px;">
               <div style="font-weight:bold; font-size:16px; margin-bottom:6px;">改进建议</div>
               <div style="color:#444; line-height:1.7;">${normalized.suggestions_for_improvement}</div>
             </div>`
          : ''}
      </div>`;
    }

    contentEl.innerHTML = html;
    overlay.style.display = 'flex';
    if (closeBtn && !closeBtn.__boundClose) {
      closeBtn.__boundClose = true;
      closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
    }
  } catch (e) { console.error('显示评价报告模态失败:', e); }
}

// 结束实验并锁定页面（从 main.js 迁移）
export function finishExperiment() {
  const pageLock = document.getElementById('page-lock-overlay');
  if (pageLock) {
    pageLock.style.display = 'flex';
    console.log('实验已结束，页面已锁定');
  }
  // 标记实验锁定，并开启“完成实验并获取评价”按钮
  try {
    window.isExperimentLocked = true;
    const evalBtn = document.getElementById('evaluate-btn');
    if (evalBtn) {
      evalBtn.disabled = false;
      evalBtn.textContent = '完成实验并获取评价';
    }
  } catch (e) { /* ignore */ }
}

export function showPageLock() { finishExperiment(); }

// 输入错误动画（从 main.js 迁移）
export function showInputErrorAnimation() {
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.style.border = '2px solid #ff4444';
    chatInput.style.animation = 'shake 0.5s ease-in-out';
    addMessageToChat('assistant', '请输入您的实验结论后再提交。');
    chatInput.focus();
    setTimeout(() => { chatInput.style.border = ''; chatInput.style.animation = ''; }, 1500);
  }
}

// 理论值显示更新（从 main.js 迁移）
export function updateTheoreticalValues() {
  const tEl = document.getElementById('temperature-slider');
  const gEl = document.getElementById('gas-selector');
  if (!tEl || !gEl) return;
  const temperature = parseFloat(tEl.value);
  const molarMass = parseFloat(gEl.value);
  const R = 8.314; // J/(mol·K)
  const M = molarMass / 1000; // kg/mol
  const vp = Math.sqrt(2 * R * temperature / M);
  const vavg = Math.sqrt(8 * R * temperature / (Math.PI * M));
  const vrms = Math.sqrt(3 * R * temperature / M);
  const vpEl = document.getElementById('vp-theoretical');
  const vavgEl = document.getElementById('vavg-theoretical');
  const vrmsEl = document.getElementById('vrms-theoretical');
  if (vpEl) vpEl.textContent = vp.toFixed(1);
  if (vavgEl) vavgEl.textContent = vavg.toFixed(1);
  if (vrmsEl) vrmsEl.textContent = vrms.toFixed(1);
  console.log(`Theoretical values updated: vp=${vp.toFixed(1)}, vavg=${vavg.toFixed(1)}, vrms=${vrms.toFixed(1)}`);
}

// 时间尺度指示（从 main.js 迁移）
export function updateTimeScaleIndicator() {
  try {
    const el = document.getElementById('time-scale-indicator');
    const span = document.getElementById('timescale-value');
    const topSpan = document.getElementById('timescale-value-top');
    const state = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
    const ts = (typeof state.simulationTimeScale === 'number') ? state.simulationTimeScale : 1;
    if (el) el.textContent = `${ts}x`;
    if (span) span.textContent = `${ts}x`;
    if (topSpan) topSpan.textContent = `${ts}x`;
    console.debug('[TimeScale] indicator updated:', ts);
  } catch (e) {
    console.warn('更新时间尺度指示失败:', e);
  }
}

// 由 simulation.js 在其内部 timeScale 变化时调用（从 main.js 迁移）
export function updateTimeScale(newTimeScale) {
  try {
    if (window.State && typeof window.State.updateState === 'function') {
      window.State.updateState({ simulationTimeScale: newTimeScale });
    } else if (window.appState) {
      window.appState.simulationTimeScale = newTimeScale;
    }
    console.debug('[TimeScale] state updated to:', newTimeScale);
  } catch (e) { /* ignore */ }
  updateTimeScaleIndicator();
}

// 为保持与 state.js 的“软依赖”兼容，暴露到 window（避免循环 import）
window.updateLogDisplay = updateLogDisplay;
window.addMessageToChat = addMessageToChat;
window.showThinkingBubble = showThinkingBubble;
window.removeThinkingBubble = removeThinkingBubble;
window.showOnboardingPrompt = showOnboardingPrompt;
window.showEvaluationReportModal = showEvaluationReportModal;
window.finishExperiment = finishExperiment;
window.showPageLock = showPageLock;
window.updateTheoreticalValues = updateTheoreticalValues;
window.updateTimeScaleIndicator = updateTimeScaleIndicator;
window.updateTimeScale = updateTimeScale;

// ===== 新增：加载模态与错误模态、页面锁定 =====
export function showLoadingModal(message = '正在处理，请稍候...') {
  let overlay = document.getElementById('loading-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    const box = document.createElement('div');
    box.className = 'chat-window-container';
    box.style.maxWidth = '420px';
    box.style.width = '80%';
    box.innerHTML = `<div class="chat-header"><h3>处理中</h3></div>
      <div style="padding:16px; display:flex; align-items:center; gap:12px;">
        <div class="thinking-dots"><span></span><span></span><span></span></div>
        <div id="loading-modal-text" style="flex:1;">${message}</div>
      </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
  const textEl = document.getElementById('loading-modal-text');
  if (textEl) textEl.textContent = message;
  overlay.style.display = 'flex';
}
export function hideLoadingModal() {
  const overlay = document.getElementById('loading-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}
export function showErrorModal(message = '发生错误') {
  let overlay = document.getElementById('error-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'error-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    const box = document.createElement('div');
    box.className = 'chat-window-container';
    box.style.maxWidth = '520px';
    box.style.width = '90%';
    box.innerHTML = `<div class="chat-header"><h3>错误</h3>
        <button id="error-close-btn" title="关闭">&times;</button></div>
      <div id="error-modal-content" style="padding:16px; white-space:pre-wrap;"></div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const closeBtn = document.getElementById('error-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
  }
  const content = document.getElementById('error-modal-content');
  if (content) content.textContent = message;
  overlay.style.display = 'flex';
}
export function lockUI(forceLock = true) {
  // 注意：按照需求，以下控件保持常开：提交结论、AI问答、追踪粒子
  const alwaysOn = new Set(['submit-conclusion-btn','ask-ai-btn','chat-input','trace-particle-btn']);
  const ids = [
    'temperature-slider','gas-selector','particles-slider','initial-dist-select',
    'reset-btn', /* 常开控件不在此列表 */
    'evaluate-btn','next-step-btn'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (alwaysOn.has(id)) return; // 不锁定这些控件
    if (forceLock) {
      el.disabled = true;
      el.style.cursor = 'not-allowed';
      el.style.opacity = '0.6';
    } else {
      el.disabled = false;
      el.style.cursor = 'pointer';
      el.style.opacity = '';
    }
  });
}

// 新增：基于步骤配置的控件锁定（与 main.js 导入保持兼容）
export function lockControls(enabledControls = []) {
  try {
    const state = (window.State && typeof window.State.getState === 'function')
      ? window.State.getState()
      : (window.appState || {});
    const isLocked = !!(window.isExperimentLocked || state.isFinalized);

    const alwaysOn = new Set(['submit-conclusion-btn','ask-ai-btn','chat-input','trace-particle-btn']);
    const allIds = [
      'temperature-slider','gas-selector','particles-slider','initial-dist-select',
      'reset-btn','trace-particle-btn','ask-ai-btn','chat-input',
      'submit-conclusion-btn','next-step-btn','evaluate-btn'
    ];

    const enabledAll = Array.isArray(enabledControls) && enabledControls.includes('all');
    const currentIdx = window.currentStepIndex || 0;
    const totalSteps = (window.tutorialSteps && window.tutorialSteps.length) ? window.tutorialSteps.length : 6;
    const isFinalStep = currentIdx >= (totalSteps - 1);

    allIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (alwaysOn.has(id)) {
        el.disabled = false;
        el.style.cursor = 'pointer';
        el.style.opacity = '';
        el.style.pointerEvents = 'auto';
        return;
      }
      if (id === 'evaluate-btn') {
        // 自由探索阶段应当解禁完成实验键；否则仅在实验完全结束时开启
        const shouldEnableEval = isFinalStep || isLocked === true;
        el.disabled = !shouldEnableEval;
        el.style.cursor = el.disabled ? 'not-allowed' : 'pointer';
        el.style.opacity = el.disabled ? '0.6' : '';
        el.style.pointerEvents = el.disabled ? 'none' : 'auto';
        return;
      }
      // 处理 'all'：在未锁定状态下解锁所有控制面板；锁定时禁用
      if (enabledAll) {
        const shouldEnable = !isLocked;
        el.disabled = !shouldEnable;
        el.style.cursor = el.disabled ? 'not-allowed' : 'pointer';
        el.style.opacity = el.disabled ? '0.6' : '';
        el.style.pointerEvents = el.disabled ? 'none' : 'auto';
        return;
      }
      // 默认按名单启用
      const shouldEnable = !isLocked && Array.isArray(enabledControls) && enabledControls.includes(id);
      el.disabled = !shouldEnable;
      el.style.cursor = el.disabled ? 'not-allowed' : 'pointer';
      el.style.opacity = el.disabled ? '0.6' : '';
      el.style.pointerEvents = el.disabled ? 'none' : 'auto';
    });
  } catch (e) {
    console.warn('lockControls error:', e);
  }
}

window.showLoadingModal = showLoadingModal;
window.hideLoadingModal = hideLoadingModal;
window.showErrorModal = showErrorModal;
window.lockUI = lockUI;
window.lockControls = lockControls;