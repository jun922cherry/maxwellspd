// 引导流程管理模块（flow-manager.js）
// 负责：教程步骤数据（guidanceHTML 及启用控件列表），以及“下一步”解锁与步骤推进逻辑

// 兼容：若 window.generateGuidanceButtons 尚未定义，则提供一个空实现，避免模块加载顺序导致的错误
if (typeof window !== 'undefined' && typeof window.generateGuidanceButtons !== 'function') {
  window.generateGuidanceButtons = function() { return ""; };
}

// 新版教程步骤（基于智能评价体系）
export const tutorialSteps = [
  {
    id: 1,
    title: '欢迎：两种视角看世界（上）',
    guidanceHTML: `
         <p class="guidance-text">欢迎来到麦克斯韦速率分布实验室。本实验将从两种互补的视角来探究气体分子的运动：</p>
         <ul>
             <li><strong>宏观统计视角</strong>：通过右侧的“速率分布图”，观察数以百计的粒子作为整体所呈现出的统计规律。</li>
             <li><strong>微观个体视角</strong>：通过核心工具“<strong>单粒子追踪器</strong>”，深入一个分子的世界，观察其随机行走。</li>
         </ul>
     `,
    enabledControls: [],
    completionCondition: null
  },
  {
    id: 2,
    title: '欢迎：平均自由程（下）',
    guidanceHTML: `
         <p class="guidance-text">“单粒子追踪器”可以计算一个关键物理量：<strong>平均自由程 (Mean Free Path, λ)</strong>。它指一个分子在连续两次碰撞之间，平均能够自由飞行的距离。理论公式：</p>
         <p class="guidance-text" style="text-align: center; font-family: 'Courier New', monospace; font-size: 1.1em;">
             λ = 1 / (√2 * π * d² * nᵥ)
         </p>
         <p class="guidance-text">其中 d 是分子直径，nᵥ 是单位体积内的分子数。这个微观量直接影响气体的粘度与扩散等宏观性质。准备就绪后，请进入下一步的宏观探究。</p>
     `,
    enabledControls: [],
    completionCondition: null
  },
  {
    id: 3,
    title: '第一步：探究核心变量',
    guidanceHTML: `
            <p class="guidance-text">本实验旨在探究影响气体分子速率分布的核心因素。请首先系统地进行以下操作：</p>
            <ol>
                <li>拖动<strong>温度滑块</strong>，观察分布曲线的形态变化。</li>
                <li>切换不同的<strong>气体类型</strong>，观察分子质量对曲线的影响。</li>
            </ol>
            <p class="guidance-text" style="color: #17a2b8; font-weight: bold;">完成后，请在右下角的输入框中，准确描述温度和质量分别是如何影响分布曲线的形状与峰值位置的，然后提交。</p>
        `,
    enabledControls: ['all'],
    completionCondition: (state) => state.step1?.tempAdjusted && state.step1?.gasSwitched && state.feedbackSubmitted
  },
  {
    id: 4,
    title: '第二步：见证平衡的诞生',
    guidanceHTML: `
            <p class="guidance-text">您看到的平滑曲线是一个统计平衡态。但它是如何从无序中产生的？请使用左侧的“<strong>初始分布模式</strong>”控制器，选择“<strong>单速率分布</strong>”，然后点击底部的“<strong>重置</strong>”。</p>
            <p class="guidance-text">仔细观察图表，见证所有分子是如何从一个单一速率，通过随机碰撞，最终自发地演化成稳定的麦克斯韦分布的。</p>
            <p class="guidance-text" style="color: #17a2b8; font-weight: bold;">这个“宏观有序源于微观无序”的过程给了您什么启发？请提交您的思考。</p>
        `,
    enabledControls: ['all'],
    completionCondition: (state) => state.step2?.evolutionModeUsed && state.feedbackSubmitted
  },
  {
    id: 5,
    title: '第三步：开放性思考 - “高能的尾巴”',
    guidanceHTML: `
        <p class="guidance-text">请将模式切换回“<strong>标准平衡态</strong>”。仔细观察分布曲线遥远的右侧“尾部”。虽然这里的粒子数量极少，但它们是系统中能量最高的“精英分子”。</p>
        <p class="guidance-text">现在，请进行一次思想实验：如果我们只移除这些跑得最快的分子，整个系统的<strong>平均动能（即温度）</strong>会发生什么变化？</p>
        <p class="guidance-text" style="color: #17a2b8; font-weight: bold;">这是一个开放性的思考题，不需要实际操作。请在右下角输入你的思考并提交。</p>
    `,
    enabledControls: ['all'],
    completionCondition: (state) => state.feedbackSubmitted
  },
  {
    id: 6,
    title: '自由探索阶段',
    guidanceHTML: `
            <p class="guidance-text">恭喜您！您已完成了所有核心探究。现在，您可以自由组合所有工具进行最终探索。</p>
            <p class="guidance-text">实验结束后，请点击底部的按钮，获取我们为您生成的AI实验评价报告。</p>
        `,
    enabledControls: ['all'],
    completionCondition: null
  }
];

// 将原始状态映射为 completionCondition 所需的视图（提供 step1/step2/step3 别名）
function getStateForCompletion() {
  const raw = (window.State && typeof window.State.getState === 'function') ? window.State.getState() : (window.appState || {});
  const sc = raw.stepCompletion || {};
  const view = {
    ...raw,
    step1: sc.step1 || {},
    step2: sc.step2 || {},
    step3: sc.step3 || {},
    feedbackSubmitted: !!raw.feedbackSubmitted
  };
  return view;
}

// 检查并解锁“下一步”按钮（严格依据 completionCondition）
export function checkAndUnlockNextButton(stepIndex) {
  const idx = Number.isFinite(stepIndex) ? stepIndex : (window.currentStepIndex || 0);
  const nextBtn = document.getElementById('next-step-btn');
  if (!nextBtn) return false;
  if (idx >= tutorialSteps.length - 1) {
    nextBtn.style.display = 'none';
    return true;
  }
  nextBtn.style.display = '';
  const step = tutorialSteps[idx];
  let conditionMet = true;
  if (typeof step.completionCondition === 'function') {
    try {
      conditionMet = !!step.completionCondition(getStateForCompletion());
    } catch (e) {
      console.warn('completionCondition 执行失败:', e);
      conditionMet = false;
    }
  }
  nextBtn.disabled = !conditionMet;
  // 修复鼠标指针样式与点击行为一致性，同时禁止点击事件
  nextBtn.style.cursor = nextBtn.disabled ? 'not-allowed' : 'pointer';
  nextBtn.style.pointerEvents = nextBtn.disabled ? 'none' : 'auto';
  return conditionMet;
}

// 推进到下一步骤前，重置反馈与步骤完成标志
export function advanceStep() {
  const State = window.State;
  if (State && typeof State.updateState === 'function') {
    console.debug('[Flow] advanceStep: resetting completion flags and feedbackSubmitted');
    State.updateState({
      stepCompletion: {
        step1: { tempAdjusted: false, gasSwitched: false },
        step2: { evolutionModeUsed: false },
        step3: {}
      },
      feedbackSubmitted: false
    });
  } else if (window.appState) {
    // 兜底：直接写入 window.appState
    console.debug('[Flow] advanceStep (fallback): resetting completion flags and feedbackSubmitted');
    window.appState.stepCompletion = {
      step1: { tempAdjusted: false, gasSwitched: false },
      step2: { evolutionModeUsed: false },
      step3: {}
    };
    window.appState.feedbackSubmitted = false;
  }
}

// 暴露到 window 以兼容现有代码
window.tutorialSteps = tutorialSteps;
window.checkAndUnlockNextButton = checkAndUnlockNextButton;
window.advanceStep = advanceStep;