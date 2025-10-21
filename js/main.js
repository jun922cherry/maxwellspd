import './simulation.js';
import './chart.js';
import './api.js';
import { appState, currentAppMode, setAppMode, logOperation, updateState } from './state.js';
import { addMessageToChat, initializeLogFloater, showOnboardingPrompt, updateTheoreticalValues, updateTimeScaleIndicator, lockControls } from './ui-manager.js';
import { tutorialSteps } from './flow-manager.js';
import { initChatHandlers, activateConclusionMode, initTracerInteractions } from './event-handler.js';
console.log("New Maxwell layout script loaded successfully.");

// 聊天状态管理与按钮事件绑定已迁移至 event-handler.js

// 应用状态管理由 state.js 负责（保留只读引用 currentAppMode）

// 操作日志数组由 state.js 维护

// 全局应用状态由 state.js 提供并同步到 window

// 操作日志记录函数现由 state.js 提供

// 日志显示函数迁移至 ui-manager.js

// 初始化操作日志浮窗函数迁移至 ui-manager.js

// 教程步骤数据结构 - 分步式引导交互流程
// Guidance buttons generator (V2.1-ADVANCED)
window.generateGuidanceButtons = function(currentStep, isExperimentLocked) {
  try {
    // 复用现有界面底部的“下一步”按钮，不在引导HTML内重复创建按钮
    // 这里返回空字符串以满足模板占位符需求，同时避免重复按钮
    return "";
  } catch (e) {
    console.error('generateGuidanceButtons error:', e);
    return "";
  }
};
// 教程步骤数据迁移至 flow-manager.js

// 控制面板交互功能
// ===== 辅助：根据气体ID或名称获取摩尔质量（支持数值、中文/英文文案） =====
function getMolarMassById(idOrValue) {
    if (idOrValue == null) return NaN;
    const s = String(idOrValue).trim();
    // 若本身就是数值字符串，直接解析
    const num = parseFloat(s);
    if (!Number.isNaN(num)) return num;
    // 名称映射（中英双语）
    const map = {
        '氢气 (H₂)': 2.0079,
        'Hydrogen (H₂)': 2.0079,
        '氦气 (He)': 4.0026,
        'Helium (He)': 4.0026,
        '氮气 (N₂)': 28.0134,
        'Nitrogen (N₂)': 28.0134,
        '氧气 (O₂)': 31.9988,
        'Oxygen (O₂)': 31.9988,
        '二氧化碳 (CO₂)': 44.01,
        'Carbon dioxide (CO₂)': 44.01,
        '氩气 (Ar)': 39.948,
        'Argon (Ar)': 39.948
    };
    return map[s] ?? NaN;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");
    
    // 初始化图表和模拟模块
    initializeModules();
    // 初始化单粒子追踪交互绑定
    try { initTracerInteractions(); } catch (e) { console.warn('initTracerInteractions failed:', e); }
    // 显示时间尺度指示
    updateTimeScaleIndicator();

    // 页面进入提示：请先按照引导提示完成任务
    showOnboardingPrompt();
    
    // 温度滑块交互
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValue = document.getElementById('temperature-value');
    
    if (temperatureSlider && temperatureValue) {
        temperatureSlider.addEventListener('input', (e) => {
            const temp = e.target.value;
            temperatureValue.textContent = temp;
            console.log(`State Updated: Temperature = ${temp} K`);
            // 记录操作日志
            logOperation('set_temperature', parseFloat(temp), {
                unit: 'K',
                previousValue: temperatureSlider.getAttribute('data-previous-value') || '300'
            });
            temperatureSlider.setAttribute('data-previous-value', temp);
            updateTheoreticalValues();
            // 移除：直接驱动图表更新，改为事件驱动
            // if (window.ChartModule) window.ChartModule.updateFromControls();
            if (window.SimulationModule) window.SimulationModule.updateParticleTemperature();
            // 标记第一步已调节温度（新版状态）
            try {
                updateState({
                    stepCompletion: {
                        step1: {
                            ...(window.State?.getState()?.stepCompletion?.step1 || {}),
                            tempAdjusted: true
                        }
                    }
                });
            } catch (e) { /* ignore */ }
            // 多条件检查
            checkCompletion();
        });
    }
    
    // 粒子数滑块交互
    const particleSlider = document.getElementById('particles-slider');
    const particleValue = document.getElementById('particles-value');
    
    if (particleSlider && particleValue) {
        particleSlider.addEventListener('input', (e) => {
            const count = e.target.value;
            particleValue.textContent = count;
            console.log(`State Updated: Particle Count = ${count}`);
            
            // 更新模拟粒子数量
            if (window.SimulationModule) {
                window.SimulationModule.updateParticleCount();
            }
            
            // 检查步骤完成条件
            checkCompletion();
        });
    }
    
    // 气体种类选择器交互
    const gasSelector = document.getElementById('gas-selector');
    
    if (gasSelector) {
        // 初始化旧值属性，避免首次切换取不到旧值
        if (!gasSelector.getAttribute('data-previous-value')) {
            const initText = gasSelector.options[gasSelector.selectedIndex]?.textContent || '氮气 (N₂)';
            gasSelector.setAttribute('data-previous-value', initText);
        }
        if (!gasSelector.getAttribute('data-previous-molar')) {
            gasSelector.setAttribute('data-previous-molar', gasSelector.value || '28.0134');
        }

        gasSelector.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const newMolarMassStr = e.target.value;
            const newGasText = selectedOption.textContent;

            // 1. 获取旧/新的摩尔质量
            const oldMolarMass = getMolarMassById(gasSelector.getAttribute('data-previous-molar'))
                                  || getMolarMassById(gasSelector.getAttribute('data-previous-value'));
            const newMolarMass = getMolarMassById(newMolarMassStr);

            console.log(`State Updated: Gas Type = ${newGasText}, Molar Mass = ${newMolarMassStr} g/mol`);
            // 记录操作日志
            logOperation('change_gas', newGasText, {
                molarMass: parseFloat(newMolarMassStr),
                unit: 'g/mol',
                previousValue: gasSelector.getAttribute('data-previous-value') || 'Nitrogen (N₂)'
            });

            // 2. 更新全局状态
            try {
                updateState({
                    gasType: newMolarMassStr,
                    molarMass: newMolarMass,
                    stepCompletion: {
                        step1: {
                            ...(window.State?.getState()?.stepCompletion?.step1 || {}),
                            gasSwitched: true
                        }
                    }
                });
            } catch (e1) {
                const appState = window.appState || {};
                appState.gasType = newMolarMassStr;
                appState.molarMass = newMolarMass;
                window.appState = appState;
            }

            // 3. 关键：切换气体后重新加载模拟（重建粒子与速度，避免异常降速）
            if (window.SimulationModule) {
                window.SimulationModule.reset();
                // 重置追踪模式与统计，避免切换气体后残留状态
                try { window.State.updateState({ tracerMode: 'inactive', tracedParticleId: null }); } catch (e) {}
                if (typeof window.SimulationModule.resetTracerStats === 'function') { window.SimulationModule.resetTracerStats(); }
                // 重置后重新启动模拟，确保直方图与速度分布基于新气体参数
                setTimeout(() => {
                    window.SimulationModule.start();
                }, 100);
            }

            // 移除：清空平滑历史并立即重绘直方图（事件驱动替代）
            // try {
            //     if (window.appState && Array.isArray(window.appState.histogramHistory)) {
            //         window.appState.histogramHistory.length = 0;
            //     }
            //     if (window.ChartModule && typeof window.ChartModule.updateHistogram === 'function' &&
            //         window.SimulationModule && typeof window.SimulationModule.getSpeedDistributionHistogram === 'function') {
            //         const hist = window.SimulationModule.getSpeedDistributionHistogram();
            //         window.ChartModule.updateHistogram(hist);
            //     }
            // } catch (e2) { /* ignore */ }

            // 4. 更新UI（理论曲线、指标等）
            updateTheoreticalValues();
            // 移除主动图表刷新，交由事件管线
            // if (window.ChartModule) { window.ChartModule.updateFromControls(); }

            // 更新previous属性为当前值
            gasSelector.setAttribute('data-previous-value', newGasText);
            gasSelector.setAttribute('data-previous-molar', String(newMolarMass));

            // 检查步骤完成条件
            checkCompletion();

            console.log(`[Gas] 切换完成：${gasSelector.getAttribute('data-previous-value')} -> ${newGasText}；速度已按质量比例重校准。旧M=${oldMolarMass}, 新M=${newMolarMass}`);
        });
    }
    
    // 模拟自动运行，无需手动控制
    
    // 重置按钮交互
    const resetBtn = document.getElementById('reset-btn');
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // 记录操作日志
            logOperation('reset_simulation', 'all_controls', {
                resetToDefaults: {
                    temperature: 300,
                    particles: 300, // updated default from 200
                    gas: 'Nitrogen (N₂)'
                }
            });
            
            // 重置所有控件到默认值
            if (temperatureSlider && temperatureValue) {
                temperatureSlider.value = '300';
                temperatureValue.textContent = '300';
                temperatureSlider.setAttribute('data-previous-value', '300');
            }
            if (particleSlider && particleValue) {
                particleSlider.value = '300';
                particleValue.textContent = '300';
            }
            if (gasSelector) {
                gasSelector.value = '28.0134'; // 氮气
                gasSelector.setAttribute('data-previous-value', 'Nitrogen (N₂)');
            }
            // 分布模式保持不变（不在重置时覆盖）
            const distSelect = document.getElementById('initial-dist-select');
            if (distSelect) {
                // 保持当前选择，不做任何修改
                // window.appState.initialDistributionMode 保持现有值
            }
            
            // 重置模拟和图表
            updateTheoreticalValues();
            // 移除：直接驱动图表更新
            // if (window.ChartModule) { window.ChartModule.updateFromControls(); }
            if (window.SimulationModule) {
                window.SimulationModule.reset();
                // 重置追踪模式与统计，避免残留追踪状态影响新一轮模拟
                try { window.State.updateState({ tracerMode: 'inactive', tracedParticleId: null }); } catch (e) {}
                if (typeof window.SimulationModule.resetTracerStats === 'function') { window.SimulationModule.resetTracerStats(); }
                // 重置后重新启动模拟
                setTimeout(() => {
                    window.SimulationModule.start();
                }, 100);
            }
            
            console.log('模拟已重置');
            
            // 第二步：在用户点击重置时记录
            if ((window.currentStepIndex || 0) === 3) {
                try {
                    window.State.updateState({ step2: { reset_clicked: true } });
                } catch (e) {
                    appState.step2.reset_clicked = true;
                }
            }
            
            checkCompletion(); // 检查完成条件
            
            console.log('State Updated: Simulation Reset to Default Values');
        });
    }
    
    // 初始化理论值计算
    updateTheoreticalValues();
    
    // ========== 分步式引导流程初始化 ==========
    window.currentStepIndex = 0;
    
    // 加载第一个步骤
    loadStep(window.currentStepIndex);
    
    // 为"下一步"按钮添加事件监听器
    const nextStepBtn = document.getElementById('next-step-btn');
    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', () => {
            // 推进前重置反馈与完成标志（新版流程）
            try { if (typeof window.advanceStep === 'function') window.advanceStep(); } catch (e) { /* ignore */ }
            window.currentStepIndex++;
            
            if (window.currentStepIndex < tutorialSteps.length) {
                // 还有下一步，继续加载
                loadStep(window.currentStepIndex);
            } else {
                // 教程结束，进入自由探索模式
                enterFinalExplorationPhase();
            }
        });
    }
    
    // 保存对比按钮已移除
    console.log('Control panel interactivity initialized successfully.');
    
    // ========== AI问答功能初始化 ==========
    // 统一初始化聊天相关事件绑定（迁移到 event-handler.js）
    initChatHandlers();
    
    console.log('AI chat functionality initialized successfully.');
    
    // 初始化操作日志浮窗
    initializeLogFloater();
    
    // 初始化教程步骤（已在上文完成一次，不再重复调用）
});


// ========== AI问答功能函数 ==========
// 发送消息逻辑已迁移至 event-handler.js（handleSendMessage）

// 旧的处理结论提交函数已移除，使用下方的异步版本

// checkConclusionSubmissionConditions函数已移除
// 按钮激活现在完全由蓝色"我已得出结论"按钮的点击事件控制

// 进入最终探索阶段
function enterFinalExplorationPhase() {
    // 加载最后一步的内容
    const finalStep = tutorialSteps[tutorialSteps.length - 1];
    document.getElementById('step-title').textContent = finalStep.title;
    document.getElementById('step-guidance').innerHTML = finalStep.guidanceHTML;
    
    // 隐藏下一步按钮
    const nextStepBtn = document.getElementById('next-step-btn');
    if (nextStepBtn) {
        nextStepBtn.style.display = 'none';
    }
    
    // 创建结论提交按钮
    const guidanceArea = document.getElementById('guidance-area');
    if (guidanceArea) {
        const conclusionBtn = document.createElement('button');
        conclusionBtn.id = 'open-conclusion-modal-btn';
        conclusionBtn.className = 'btn btn-primary';
        conclusionBtn.textContent = '我已得出结论，准备提交';
        conclusionBtn.style.marginTop = '15px';
        conclusionBtn.style.width = '100%';
        
        // 绑定点击事件 - 实现单向状态流程
        conclusionBtn.addEventListener('click', function() {
            // 第一步: 切换应用状态到结论提交模式
            setAppMode('CONCLUSION_SUBMISSION');
            console.log('应用模式已切换为:', currentAppMode);
            
            // 第二步: 解锁目标按钮
            const submitConclusionBtn = document.getElementById('submit-conclusion-btn');
            if (submitConclusionBtn) {
                submitConclusionBtn.disabled = false;
                submitConclusionBtn.classList.remove('btn--disabled');
            }
            
            // 第三步: 聚焦输入框
            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
                chatInput.focus();
                // 更新占位符文本以引导用户正确操作
                chatInput.placeholder = '请详细描述你发现的关于温度、分子质量与粒子速率之间的关系...';
            }
            
            // 第四步: 隐藏自身（不可逆操作）
            conclusionBtn.style.display = 'none';
            
            // 初始化结论提交界面并绑定结论模式事件
            openConclusionChat();
            activateConclusionMode();
        });
        
        guidanceArea.appendChild(conclusionBtn);
    }
    
    // 解锁所有控件
    updateControlStates(['all']);
    console.log('进入最终探索阶段，结论提交按钮已创建');
}

// 打开结论提交聊天界面
function openConclusionChat() {
    const chatArea = document.getElementById('chat-area');
    if (chatArea) {
        // 添加AI助教的欢迎消息（不清空历史）
        addMessageToChat('assistant', '请在此提交你的最终实验结论。描述越详细，AI对你探究水平的评估就越准确。');
        chatArea.scrollIntoView({ behavior: 'smooth' });
    }
}

// 结论提交聊天模式初始化已迁移至 activateConclusionMode

// 设置结论提交输入区域
// 输入区结论模式已迁移至 event-handler.js（activateConclusionMode）

// 处理结论输入的回车键 - 带状态判断的精确逻辑
// 结论输入回车逻辑已迁移至 event-handler.js（activateConclusionMode 内）


// 操作日志获取函数已迁移至 state.js（getOperationLogs），此处不再重复定义。

// 处理结论提交 - 乐观UI策略实现
// 结论提交逻辑已迁移至 event-handler.js（handleConclusionSubmission）

// （已移除）showFeedbackOption：当前项目未使用该函数，如需集成反馈模态请在 ui-manager.js 中统一实现

// 设置反馈输入区域
// 反馈输入区域设置已迁移至 event-handler.js（activateFeedbackMode）

// 处理反馈输入的回车键
// 反馈输入回车逻辑已迁移至 event-handler.js（activateFeedbackMode 内）

// 处理反馈提交
// 反馈提交逻辑已迁移至 event-handler.js（handleFeedbackSubmission）


// 聊天消息渲染函数迁移至 ui-manager.js

// 思考气泡渲染函数迁移至 ui-manager.js

// 移除思考气泡函数迁移至 ui-manager.js

// ========== 模块初始化函数 ==========
function initializeModules() {
  console.log('初始化可视化模块...');
  if (window.SimulationModule) {
    const initState = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
    window.SimulationModule.init(document.getElementById('simulation-canvas'), initState, () => {
      console.log('Simulation is ready, initializing chart...');
      // 标记为就绪
      try { updateState({ isReady: true }); } catch (e) { if (window.appState) window.appState.isReady = true; }
      
      // 更新时间尺度显示
      updateTimeScaleIndicator();

      if (typeof Chart !== 'undefined' && window.ChartModule) {
        window.ChartModule.init();
        // 初始化阶段允许一次主动刷新理论曲线
        window.ChartModule.updateFromControls();
        // 改为事件驱动：监听直方图帧并节流更新
        let lastHistUpdateTs = 0;
        const MIN_INTERVAL_MS = 200;
        window.addEventListener('simulation:histogramFrame', (evt) => {
          const now = performance.now();
          if (now - lastHistUpdateTs < MIN_INTERVAL_MS) return;
          lastHistUpdateTs = now;
          if (window.ChartModule && typeof window.ChartModule.updateHistogram === 'function') {
            window.ChartModule.updateHistogram(evt.detail);
          }
        });
      }
      setTimeout(() => {
        // 启动前执行一次 reset 以确保一致状态（与 isos_of_gas 的时序对齐）
        if (typeof window.SimulationModule.reset === 'function') {
          window.SimulationModule.reset();
        }
        window.SimulationModule.start();
        try { updateState({ isSimulationRunning: true, isPaused: false }); } catch (e) { if (window.appState) { window.appState.isSimulationRunning = true; window.appState.isPaused = false; } }
        console.log('模拟自动启动');
      }, 200);
    });
  } else {
    console.warn('模拟模块未加载');
  }
}


// 注：时间尺度更新与理论值计算、引导提示等函数已迁移至 ui-manager.js

// ========== 分步式引导控制函数 ==========

/**
 * 绑定引导面板文本输入监听，用于按步骤更新 appState.text_filled
 * @param {number} stepIndex
 */
// 引导输入监听已迁移至 event-handler.js（保留在 window 上的兼容导出）

/**
 * 加载指定步骤的内容和状态
 * @param {number} stepIndex - 步骤索引（从0开始）
 */
function loadStep(stepIndex) {
    // 检查步骤索引有效性
    if (stepIndex < 0 || stepIndex >= tutorialSteps.length) {
        console.error('无效的步骤索引:', stepIndex);
        return;
    }
    
    const step = tutorialSteps[stepIndex];
    
    // 重置保存按钮点击计数器（每个步骤独立计数）
    window.saveCurveClickCount = 0;
    
    // 更新步骤标题和指导内容
    document.getElementById('step-title').textContent = step.title;
    const guidanceEl = document.getElementById('step-guidance');
    guidanceEl.innerHTML = step.guidanceHTML;
    // 运行时注入引导按钮（避免在模块加载期调用未定义的函数）
    if (typeof window.generateGuidanceButtons === 'function') {
        const btnHtml = window.generateGuidanceButtons(stepIndex, !!window.isExperimentLocked);
        if (btnHtml) guidanceEl.insertAdjacentHTML('beforeend', btnHtml);
    }
    
    // 绑定文本输入监听（用于多条件解锁）
    window.attachGuidanceInputListeners(stepIndex);
    
    // 更新控件状态（新版：严格依据 enabledControls）
    lockControls(step.enabledControls);
    
    // 设置下一步按钮状态：除最后“自由探索阶段”外，其余步骤均需满足条件后解锁
    const nextBtn = document.getElementById('next-step-btn');
    if (!nextBtn) return;
    if (stepIndex >= tutorialSteps.length - 1) {
        nextBtn.style.display = 'none';
    } else {
        nextBtn.style.display = '';
        nextBtn.disabled = true; // 初始禁用，待条件满足
    }
    
    // 初次加载后检查一次（避免遗漏）
    checkCompletion();
    
    console.log(`已加载步骤 ${step.id}: ${step.title}`);
}

/**
 * 根据当前步骤配置更新所有控件的启用/禁用状态
 * @param {Array} enabledControls - 当前步骤启用的控件ID数组
 */
function updateControlStates(enabledControls) {
    // 兼容保留：转发到 ui-manager 的 lockControls
    lockControls(enabledControls);
}

/**
 * 检查当前步骤的完成条件是否满足
 */
function checkCompletion() {
    try {
        if (typeof window.checkAndUnlockNextButton === 'function') {
            window.checkAndUnlockNextButton(window.currentStepIndex || 0);
        }
    } catch (err) {
        console.error('checkCompletion error:', err);
    }
}

// 初始分布模式选择器交互
const distSelect = document.getElementById('initial-dist-select');
if (distSelect) {
    distSelect.addEventListener('change', (e) => {
        const mode = e.target.value; // 'equilibrium' | 'single_speed'
        try { updateState({ initialDistributionMode: mode }); } catch (err) { window.appState.initialDistributionMode = mode; }
        console.log('State Updated: Initial Distribution Mode =', mode);
        // 第二步：选择非平衡模式（新版状态）
        if ((window.currentStepIndex || 0) === 3 && mode === 'single_speed') {
            try {
                updateState({
                    stepCompletion: {
                        step2: {
                            ...(window.State?.getState()?.stepCompletion?.step2 || {}),
                            evolutionModeUsed: true
                        }
                    }
                });
            } catch (e) { /* ignore */ }
        }
        // 更新图表/模拟
        // 移除：主动刷新图表
        // if (window.ChartModule) { window.ChartModule.updateFromControls(); }
        if (window.SimulationModule && window.SimulationModule.updateInitialDistributionMode) {
            window.SimulationModule.updateInitialDistributionMode(mode);
        }
        checkCompletion();
    });
}



// 逃逸能量阈值滑块
checkCompletion();
// 【全局事件同步】在标签页不可见时暂停，恢复时继续
window.addEventListener('visibilitychange', () => {
  if (!window.SimulationModule) return;
  if (document.hidden) {
    window.SimulationModule.pause();
    try { updateState({ isPaused: true, isSimulationRunning: false }); } catch (e) { if (window.appState) { window.appState.isPaused = true; window.appState.isSimulationRunning = false; } }
  } else {
    window.SimulationModule.start();
    try { updateState({ isPaused: false, isSimulationRunning: true }); } catch (e) { if (window.appState) { window.appState.isPaused = false; window.appState.isSimulationRunning = true; } }
  }
});
// 【窗口大小变化】可选：仅记录，避免高频重排影响性能
window.addEventListener('resize', () => {
  // 仅记录一次，避免频繁触发昂贵的重建
  console.log('[Diag@main] window resized');
});
// 【诊断性开关】可由开发者在控制台调用：
window.disableChartUpdates = function() {
  if (window.SimulationModule && typeof window.SimulationModule.setChartUpdateEnabled === 'function') {
    window.SimulationModule.setChartUpdateEnabled(false);
    console.log('图表更新已禁用（诊断）');
  }
};
window.enableChartUpdates = function() {
  if (window.SimulationModule && typeof window.SimulationModule.setChartUpdateEnabled === 'function') {
    window.SimulationModule.setChartUpdateEnabled(true);
    console.log('图表更新已启用');
  }
};