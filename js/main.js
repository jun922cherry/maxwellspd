console.log("New Maxwell layout script loaded successfully.");

// AI问答相关变量
let chatHistory = [];
let isThinking = false;
let askAiBtn; // 全局声明AI问答按钮变量
let submitConclusionBtn; // 全局声明结论提交按钮变量
let sendBtn; // 全局声明发送按钮变量

// 应用状态管理
let currentAppMode = 'NORMAL_CHAT';

// 操作日志数组
window.operationLog = [];

// 添加操作日志记录函数
function logOperation(eventType, value, additionalData = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        event: eventType,
        value: value,
        ...additionalData
    };
    
    window.operationLog.push(logEntry);
    console.log('操作日志记录:', logEntry);
    
    // 更新操作日志显示
    updateLogDisplay(logEntry);
    
    // 不需要在每次操作时检查解锁条件，只在进入结论提交模式时检查
    // checkConclusionSubmissionConditions();
}

// 更新操作日志显示
function updateLogDisplay(logEntry) {
    const logContent = document.getElementById('log-content');
    if (!logContent) return;
    
    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    
    const timeStr = new Date(logEntry.timestamp).toLocaleTimeString();
    let displayText = '';
    
    switch(logEntry.event) {
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

// 初始化操作日志浮窗
function initializeLogFloater() {
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

// 教程步骤数据结构 - 分步式引导交互流程
const tutorialSteps = [
    {
        id: 1,
        title: "步骤一：欢迎与关键指标",
        guidanceHTML: `
            <p>欢迎！本实验将带您深入理解麦克斯韦速率分布。</p>
            <p>首先，请看右侧的<b>三个关键速率指标</b>，它们描述了气体分子运动的统计特征。请注意它们的相对大小。</p>
            <p>观察完毕后，请点击"下一步"。</p>
        `,
        enabledControls: [],
        completionCondition: null
    },
    {
        id: 2,
        title: "步骤二：保存对比基准",
        guidanceHTML: `
            <p>我们以当前状态 (<b>300K, 氮气</b>) 作为后续分析的<b>基准</b>。</p>
            <p>请点击<b>"保存对比"按钮</b>，将蓝色曲线固化为灰色虚线参照物。</p>
        `,
        enabledControls: ['save-curve-btn'],
        completionCondition: { controlId: 'save-curve-btn', targetValue: 1, comparison: '=' }
    },
    {
        id: 3,
        title: "步骤三：定量探索温度的影响",
        guidanceHTML: `
            <p>基准已保存。现在，请将<b>温度滑块</b>调高至<b>600 K以上</b>。</p>
            <div class="insight-box">
                <p><b>核心洞察：</b>所有速率指标都与温度T的平方根成正比。</p>
                <p class="formula"><code>v ~ √T</code></p>
                <p>这意味着，当您将温度提高时，整个速率分布曲线会整体向右（高速区）移动，并且变得更"矮胖"（分布更宽）。</p>
            </div>
            <p>请通过对比蓝色实时曲线与灰色基准线，验证这一规律。</p>
        `,
        enabledControls: ['temperature-slider'],
        completionCondition: { controlId: 'temperature-slider', targetValue: 600, comparison: '>=' }
    },
    {
        id: 4,
        title: "步骤四：更新基准以备下一步",
        guidanceHTML: `
            <p>做得好！为进行下一个对比，我们需要更新参照物。</p>
            <p>请再次点击<b>"保存对比"</b>，用当前的高温曲线覆盖掉旧的灰色基准。</p>
        `,
        enabledControls: ['save-curve-btn'],
        completionCondition: { controlId: 'save-curve-btn', targetValue: 1, comparison: '=' }
    },
    {
        id: 5,
        title: "步骤五：定量探索分子质量的影响",
        guidanceHTML: `
            <p>基准已更新为高温状态。现在，请将<b>气体种类</b>切换为分子量更轻的<b>氦气(He)</b>。</p>
            <div class="insight-box">
                <p><b>核心洞察：</b>所有速率指标都与摩尔质量M的平方根成反比。</p>
                <p class="formula"><code>v ~ 1/√M</code></p>
                <p>这意味着，在相同温度下，分子质量越小，气体分子的整体速率越快。曲线会显著地向右移动。</p>
            </div>
            <p>请对比氦气(M=4)与之前氮气(M=28)的曲线，感受这一巨大差异。</p>
        `,
        enabledControls: ['gas-selector'],
        completionCondition: {
            controlId: 'gas-selector',
            targetValue: '4.0026',
            comparison: '='
        }
    },
    {
        id: 6,
        title: "最终阶段：自由探索与总结",
        guidanceHTML: `
            <p>恭喜您完成了所有核心引导！现在进入<b>自由探索模式</b>。</p>
            <div class="insight-box">
                <p><b>核心探索任务：</b></p>
                <p>• 气体温度 (T) 与粒子平均速率 (v) 之间存在怎样的数学关系？</p>
                <p>• 改变气体种类（即改变分子质量 m₀），速率会如何变化？</p>
                <p>• 这两个因素如何共同影响麦克斯韦速率分布？</p>
            </div>
            <p>请充分利用所有控件和"保存对比"功能进行探索，当您得出明确结论后，点击下方按钮提交您的发现。</p>
        `,
        enabledControls: ['all'],
        completionCondition: null
    }
];

// 控制面板交互功能
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");
    
    // 初始化图表和模拟模块
    initializeModules();
    
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
            
            updateTheoreticalValues(); // 更新理论值
            
            // 更新图表和模拟
            if (window.ChartModule) {
                window.ChartModule.updateFromControls();
            }
            if (window.SimulationModule) {
                window.SimulationModule.updateParticleTemperature();
            }
            
            // 检查步骤完成条件
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
        gasSelector.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const molarMass = e.target.value;
            const gasName = selectedOption.textContent;
            console.log(`State Updated: Gas Type = ${gasName}, Molar Mass = ${molarMass} g/mol`);
            
            // 记录操作日志
            logOperation('change_gas', gasName, {
                molarMass: parseFloat(molarMass),
                unit: 'g/mol',
                previousValue: gasSelector.getAttribute('data-previous-value') || 'Nitrogen (N₂)'
            });
            gasSelector.setAttribute('data-previous-value', gasName);
            
            updateTheoreticalValues(); // 更新理论值
            
            // 更新图表
            if (window.ChartModule) {
                window.ChartModule.updateFromControls();
            }
            
            // 检查步骤完成条件
            checkCompletion();
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
                    particles: 500,
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
                particleSlider.value = '500';
                particleValue.textContent = '500';
            }
            if (gasSelector) {
                gasSelector.value = '28.0134'; // 氮气
                gasSelector.setAttribute('data-previous-value', 'Nitrogen (N₂)');
            }
            
            // 重置模拟和图表
            updateTheoreticalValues();
            if (window.ChartModule) {
                window.ChartModule.updateFromControls();
            }
            if (window.SimulationModule) {
                window.SimulationModule.reset();
                // 重置后重新启动模拟
                setTimeout(() => {
                    window.SimulationModule.start();
                }, 100);
            }
            
            console.log('模拟已重置');
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
    
    // 保存按钮点击计数器
    window.saveCurveClickCount = 0;
    
    // 为"保存对比"按钮添加事件监听器
    const saveCurveBtn = document.getElementById('save-curve-btn');
    if (saveCurveBtn) {
        saveCurveBtn.addEventListener('click', () => {
            if (window.ChartModule && window.ChartModule.saveCurrentCurve) {
                window.ChartModule.saveCurrentCurve();
                
                // 增加点击计数
                window.saveCurveClickCount++;
                
                // 记录操作日志
                const temperatureSlider = document.getElementById('temperature-slider');
                const gasSelector = document.getElementById('gas-selector');
                const currentTemp = temperatureSlider ? temperatureSlider.value : '300';
                const currentGas = gasSelector ? gasSelector.options[gasSelector.selectedIndex].textContent : 'Unknown';
                
                logOperation('save_curve', `${currentTemp}K_${currentGas}`, {
                    temperature: parseFloat(currentTemp),
                    gasType: currentGas,
                    clickCount: window.saveCurveClickCount
                });
                
                checkCompletion(); // 检查完成条件
            }
        });
    }
    
    console.log('Control panel interactivity initialized successfully.');
    
    // ========== AI问答功能初始化 ==========
    askAiBtn = document.getElementById('ask-ai-btn');
    submitConclusionBtn = document.getElementById('submit-conclusion-btn');
    sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    
    if (askAiBtn) {
        askAiBtn.addEventListener('click', handleSendMessage);
    }
    
    if (submitConclusionBtn) {
        submitConclusionBtn.addEventListener('click', handleConclusionSubmission);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                
                // [核心修改] 在这里加入状态判断
                if (currentAppMode === 'CONCLUSION_SUBMISSION') {
                    // 如果是结论提交模式，则调用最终提交流程
                    handleConclusionSubmission();
                } else {
                    // 否则，执行原来的常规问答逻辑
                    handleSendMessage();
                }
            }
        });
    }
    
    console.log('AI chat functionality initialized successfully.');
    
    // 初始化操作日志浮窗
    initializeLogFloater();
    
    // 初始化教程步骤
    window.currentStepIndex = 0;
    loadStep(0);
    
    // 启用AI问答按钮（始终可用）
    if (askAiBtn) {
        askAiBtn.disabled = false;
        askAiBtn.textContent = '向AI提问';
        askAiBtn.style.opacity = '1';
        askAiBtn.style.cursor = 'pointer';
    }
    
    // 结论提交按钮初始状态（由JavaScript动态控制）
    if (submitConclusionBtn) {
        submitConclusionBtn.textContent = '提交实验结论';
        // 初始状态不设置disabled，由后续逻辑控制
    }
});

// ========== AI问答功能函数 ==========
async function handleSendMessage() {
    console.log('handleSendMessage called');
    const chatInput = document.getElementById('chat-input');
    const chatLog = document.getElementById('chat-log');
    
    if (!chatInput || !chatLog || !askAiBtn) {
        console.error('Chat elements not found:', { chatInput, chatLog, askAiBtn });
        return;
    }
    
    const message = chatInput.value.trim();
    console.log('Message to send:', message);
    if (!message || isThinking) {
        console.log('Message empty or already thinking:', { message, isThinking });
        return;
    }
    
    // 添加用户消息到聊天记录
    addMessageToChat('user', message);
    chatHistory.push({ role: 'user', content: message });
    
    // 清空输入框并禁用AI问答按钮
    chatInput.value = '';
    askAiBtn.disabled = true;
    isThinking = true;
    
    // 显示AI思考中气泡
    showThinkingBubble();
    
    try {
        // 获取AI回复
        const aiResponse = await window.getAiResponse(message, chatHistory);
        
        // 移除思考中气泡
        removeThinkingBubble();
        
        // 添加AI回复到聊天记录
        addMessageToChat('assistant', aiResponse);
        chatHistory.push({ role: 'assistant', content: aiResponse });
        
        // checkConclusionSubmissionConditions调用已移除
        // 按钮激活现在完全由蓝色"我已得出结论"按钮的点击事件控制
        
    } catch (error) {
        console.error('AI response error:', error);
        removeThinkingBubble();
        addMessageToChat('assistant', '抱歉，我现在无法回答您的问题。请稍后再试。');
    } finally {
        // 重新启用AI问答按钮
        askAiBtn.disabled = false;
        isThinking = false;
    }
}

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
            currentAppMode = 'CONCLUSION_SUBMISSION';
            console.log('应用模式已切换为:', currentAppMode);
            
            // 第二步: 解锁目标按钮
            const submitConclusionBtn = document.getElementById('submit-conclusion-btn');
            if (submitConclusionBtn) {
                submitConclusionBtn.disabled = false;
                submitConclusionBtn.classList.remove('btn-disabled');
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
            
            // 初始化结论提交界面
            openConclusionChat();
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
        // 清空聊天记录并初始化结论提交模式
        initializeConclusionChatMode();
        chatArea.scrollIntoView({ behavior: 'smooth' });
    }
}

// 初始化结论提交聊天模式 - 保留现有聊天记录
function initializeConclusionChatMode() {
    // 【修正】不再清空聊天记录，保持用户与AI的对话历史
    // 原代码: chatLog.innerHTML = ''; // 已移除破坏性操作
    
    // 添加AI助教的欢迎消息
    addMessageToChat('assistant', '请在此提交你的最终实验结论。描述越详细，AI对你探究水平的评估就越准确。');
    
    // 重新配置输入区域为结论提交模式
    setupConclusionInputArea();
    
    // 按钮已在setupConclusionInputArea中直接启用，无需额外检查
    // checkConclusionSubmissionConditions();
}

// 设置结论提交输入区域
function setupConclusionInputArea() {
    const chatInput = document.getElementById('chat-input');
    
    if (chatInput) {
        chatInput.placeholder = '请详细描述你发现的关于温度、分子质量与粒子速率之间的关系...';
        chatInput.value = '';
        
        // 移除原有的事件监听器（如果存在）
        // chatInput.removeEventListener('keypress', handleChatKeyPress);
        
        // 添加新的事件监听器
        chatInput.addEventListener('keypress', handleConclusionKeyPress);
    }
    
    if (sendBtn) {
        sendBtn.textContent = '提交实验结论';
        sendBtn.disabled = false;  // 直接启用按钮
        sendBtn.style.opacity = '1';
        sendBtn.style.cursor = 'pointer';
        
        // 移除原有的事件监听器
        sendBtn.removeEventListener('click', handleSendMessage);
        
        // 添加新的事件监听器
        sendBtn.addEventListener('click', handleConclusionSubmission);
    }
}

// 处理结论输入的回车键 - 带状态判断的精确逻辑
function handleConclusionKeyPress(event) {
    // 我们只关心回车键，并且用户没有按Shift键（即意图不是换行）
    if (event.key === 'Enter' && !event.shiftKey) {
        
        // 1. 必须阻止默认的回车行为（例如换行或表单提交）
        event.preventDefault();
        
        // 2. [核心修正] 检查当前是否处于结论提交模式
        // 通过检查提交按钮的状态来判断当前模式
        const submitButton = document.getElementById('submit-conclusion-btn');
        const isInConclusionMode = submitButton && !submitButton.disabled && submitButton.textContent.includes('提交实验结论');
        
        // 3. 如果是结论提交模式，则直接调用我们已经定义好的、唯一的提交处理函数
        if (isInConclusionMode) {
            handleConclusionSubmission();
        }
        // 注意：此处没有 else 块。因为在结论提交模式下，
        // 常规的AI聊天功能已经通过隐藏UI被物理禁用了，
        // 因此我们不需要再处理其他情况。
    }
}

// 显示输入错误动画效果
function showInputErrorAnimation() {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        // 添加红色边框和抖动效果
        chatInput.style.border = '2px solid #ff4444';
        chatInput.style.animation = 'shake 0.5s ease-in-out';
        
        // 在聊天框显示提示信息
        addMessageToChat('assistant', '请输入您的实验结论后再提交。');
        
        // 聚焦到输入框
        chatInput.focus();
        
        // 1.5秒后恢复正常样式
        setTimeout(() => {
            chatInput.style.border = '';
            chatInput.style.animation = '';
        }, 1500);
    }
}

// 获取操作日志
function getOperationLogs() {
    return window.operationLog || [];
}

// 处理结论提交 - 乐观UI策略实现
function handleConclusionSubmission() {
    const chatInput = document.getElementById('chat-input');
    const conclusion = chatInput ? chatInput.value.trim() : '';
    const submitButton = document.getElementById('submit-conclusion-btn');
    const chatHistoryContainer = document.getElementById('chat-log');
    
    // 步骤 1: 前端验证
    if (!conclusion) {
        showInputErrorAnimation(); // 保持之前的输入错误提示
        return;
    }
    
    // 步骤 2: 立即更新UI，进入"处理中"状态
    if (submitButton) {
        submitButton.disabled = true; // 立刻禁用按钮，防止重复提交
        submitButton.textContent = '思考中...';
    }
    
    // 立刻将用户的结论显示在聊天区
    addMessageToChat('user', conclusion);
    
    // 清空输入框
    if (chatInput) {
        chatInput.value = '';
    }
    
    // 滚动到底部
    if (chatHistoryContainer) {
        chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
    }
    
    // 步骤 3: 【核心】在后台"静默"地发送API请求（Fire and Forget）
    // 这个API调用不使用await，它的结果不直接影响后续的UI变化
    const operationLogs = getOperationLogs();
    console.log('即将静默提交的数据:', { conclusion: conclusion, logs: operationLogs });
    
    fetch('/api/submit-conclusion', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            conclusion: conclusion,
            operationLog: operationLogs,
            experimentType: 'maxwell_speed_distribution',
            timestamp: new Date().toISOString()
        })
    })
    .then(response => {
        if (response.ok) {
            console.log('数据已成功静默提交至后端。');
        } else {
            console.error('后台静默提交失败: HTTP', response.status);
        }
    })
    .catch(error => {
        // 对于用户，我们什么也不显示。对于开发者，我们在控制台记录错误。
        console.error('后台静默提交失败:', error);
    });
    
    // 步骤 4: 模拟AI思考并给出确定性回复
    setTimeout(() => {
        // 模拟思考后，显示AI的确认消息
        addMessageToChat('assistant', '结论已收到，感谢您的探究。');
        
        // 再次滚动到底部
        if (chatHistoryContainer) {
            chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
        }
        
        // 步骤 5: 强制执行页面锁定
        setTimeout(() => {
            const pageLockOverlay = document.getElementById('page-lock-overlay');
            if (pageLockOverlay) {
                pageLockOverlay.style.display = 'flex';
            }
        }, 1200); // 在AI回复后，等待1.2秒再锁定页面，给用户阅读时间
        
    }, 800); // 模拟800毫秒的"AI思考"时间
}

// 显示反馈提交选项
function showFeedbackOption() {
    // 显示反馈提示消息
    addMessageToChat('assistant', '如果您对本次实验有任何反馈或建议，欢迎提交给我们。');
    
    // 修改输入区域为反馈模式
    setupFeedbackInputArea();
}

// 设置反馈输入区域
function setupFeedbackInputArea() {
    const chatInput = document.getElementById('chat-input');
    
    if (chatInput) {
        chatInput.placeholder = '请输入您的反馈或建议（可选）';
        chatInput.disabled = false;
        chatInput.value = '';
        
        // 移除原有的事件监听器
        chatInput.removeEventListener('keypress', handleConclusionKeyPress);
        
        // 添加反馈输入的事件监听器
        chatInput.addEventListener('keypress', handleFeedbackKeyPress);
    }
    
    if (sendBtn) {
        sendBtn.textContent = '提交反馈';
        sendBtn.disabled = false;
        
        // 移除原有的事件监听器
        sendBtn.removeEventListener('click', handleConclusionSubmission);
        
        // 添加新的事件监听器
        sendBtn.addEventListener('click', handleFeedbackSubmission);
    }
}

// 处理反馈输入的回车键
function handleFeedbackKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleFeedbackSubmission();
    }
}

// 处理反馈提交
function handleFeedbackSubmission() {
    const chatInput = document.getElementById('chat-input');
    const feedback = chatInput ? chatInput.value.trim() : '';
    
    if (!feedback) {
        // 如果没有输入反馈，直接结束实验
        finishExperiment();
        return;
    }
    
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = '提交中...';
    }
    
    // 显示用户的反馈
    addMessageToChat('user', feedback);
    
    // 清空输入框
    if (chatInput) {
        chatInput.value = '';
    }
    
    // AI简单回复已收到，不调用API
    setTimeout(() => {
        addMessageToChat('assistant', '已收到您的反馈，感谢您的参与！');
        
        // 延迟1秒后结束实验
        setTimeout(() => {
            finishExperiment();
        }, 1000);
    }, 500);
}

// 结束实验并锁定页面
function finishExperiment() {
    const pageLock = document.getElementById('page-lock-overlay');
    if (pageLock) {
        pageLock.style.display = 'flex';
        console.log('实验已结束，页面已锁定');
    }
}

// 显示页面锁定（保留原函数以防其他地方调用）
function showPageLock() {
    finishExperiment();
}

function addMessageToChat(role, content) {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.textContent = content;
    
    chatLog.appendChild(messageDiv);
    
    // 滚动到底部
    chatLog.scrollTop = chatLog.scrollHeight;
}

function showThinkingBubble() {
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

function removeThinkingBubble() {
    const thinkingBubble = document.getElementById('ai-thinking');
    if (thinkingBubble) {
        thinkingBubble.remove();
    }
}

// ========== 模块初始化函数 ==========
function initializeModules() {
    console.log('初始化可视化模块...');
    
    // 等待Chart.js加载完成后初始化图表
    if (typeof Chart !== 'undefined') {
        if (window.ChartModule) {
            window.ChartModule.init();
            // 初始化图表数据
            setTimeout(() => {
                window.ChartModule.updateFromControls();
            }, 100);
        }
    } else {
        console.warn('Chart.js未加载，图表功能不可用');
    }
    
    // 初始化粒子模拟
    if (window.SimulationModule) {
        window.SimulationModule.init();
        // 自动启动模拟
        setTimeout(() => {
            window.SimulationModule.start();
            console.log('模拟自动启动');
        }, 200);
    } else {
        console.warn('模拟模块未加载');
    }
    
    console.log('可视化模块初始化完成');
}

// ========== 理论值计算函数 ==========
function updateTheoreticalValues() {
    const temperature = parseFloat(document.getElementById('temperature-slider').value);
    const molarMass = parseFloat(document.getElementById('gas-selector').value);
    
    // 物理常数
    const R = 8.314; // 气体常数 J/(mol·K)
    const k = 1.38064852e-23; // 玻尔兹曼常数 J/K
    const NA = 6.02214076e23; // 阿伏伽德罗常数 mol^-1
    
    // 将摩尔质量从 g/mol 转换为 kg/mol
    const M = molarMass / 1000;
    
    // 计算三个特征速率 (m/s)
    const vp = Math.sqrt(2 * R * temperature / M);  // 最概然速率
    const vavg = Math.sqrt(8 * R * temperature / (Math.PI * M));  // 平均速率
    const vrms = Math.sqrt(3 * R * temperature / M);  // 方均根速率
    
    // 更新理论值显示
    document.getElementById('vp-theoretical').textContent = vp.toFixed(1);
    document.getElementById('vavg-theoretical').textContent = vavg.toFixed(1);
    document.getElementById('vrms-theoretical').textContent = vrms.toFixed(1);
    
    console.log(`Theoretical values updated: vp=${vp.toFixed(1)}, vavg=${vavg.toFixed(1)}, vrms=${vrms.toFixed(1)}`);
}

// ========== 分步式引导控制函数 ==========

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
    document.getElementById('step-guidance').innerHTML = step.guidanceHTML;
    
    // 更新控件状态
    updateControlStates(step.enabledControls);
    
    // 设置下一步按钮状态
    const nextBtn = document.getElementById('next-step-btn');
    if (step.completionCondition === null) {
        // 如果没有完成条件，直接启用下一步按钮
        nextBtn.disabled = false;
    } else {
        // 如果有完成条件，初始禁用，等待条件满足
        nextBtn.disabled = true;
    }
    
    console.log(`已加载步骤 ${step.id}: ${step.title}`);
}

/**
 * 根据当前步骤配置更新所有控件的启用/禁用状态
 * @param {Array} enabledControls - 当前步骤启用的控件ID数组
 */
function updateControlStates(enabledControls) {
    // 获取所有交互控件
    const allControls = [
        'temperature-slider',
        'gas-selector',
        'particles-slider'
    ];
    
    // 始终启用的控件
    const alwaysEnabledControls = [
        'save-curve-btn',
        'reset-btn'
    ];
    
    // 首先禁用所有控件
    allControls.forEach(controlId => {
        const element = document.getElementById(controlId);
        if (element) {
            element.disabled = true;
        }
    });
    
    // 始终启用保存按钮和重置按钮
    alwaysEnabledControls.forEach(controlId => {
        const element = document.getElementById(controlId);
        if (element) {
            element.disabled = false;
        }
    });
    
    // 根据enabledControls配置启用指定控件
    if (enabledControls.includes('all')) {
        // 如果包含'all'，启用所有控件
        allControls.forEach(controlId => {
            const element = document.getElementById(controlId);
            if (element) {
                element.disabled = false;
            }
        });
    } else {
        // 否则只启用指定的控件
        enabledControls.forEach(controlId => {
            const element = document.getElementById(controlId);
            if (element) {
                element.disabled = false;
            } else {
                console.warn(`控件不存在: ${controlId}`);
            }
        });
    }
    
    console.log('控件状态已更新，启用的控件:', enabledControls);
 }

/**
 * 检查当前步骤的完成条件是否满足
 */
function checkCompletion() {
    // 获取当前步骤
    const currentStep = tutorialSteps[window.currentStepIndex || 0];
    
    // 如果没有完成条件，直接返回
    if (!currentStep || !currentStep.completionCondition) {
        return;
    }
    
    const condition = currentStep.completionCondition;
    
    // 特殊处理：保存对比按钮的点击事件
    if (condition.controlId === 'save-curve-btn') {
        // 对于保存对比按钮，检查点击次数
        const clickCount = window.saveCurveClickCount || 0;
        let conditionMet = false;
        
        // 根据比较条件判断是否满足
        switch (condition.comparison) {
            case '>=': 
                conditionMet = clickCount >= condition.targetValue;
                break;
            case '=':
            case '==':
                conditionMet = clickCount === condition.targetValue;
                break;
            case '>':
                conditionMet = clickCount > condition.targetValue;
                break;
            default:
                conditionMet = clickCount >= condition.targetValue; // 默认行为
                break;
        }
        
        const nextBtn = document.getElementById('next-step-btn');
        if (nextBtn) {
            nextBtn.disabled = !conditionMet;
            if (conditionMet) {
                console.log(`步骤 ${currentStep.id} 完成条件已满足（保存按钮点击 ${clickCount} 次，要求${condition.comparison}${condition.targetValue}）`);
            }
        }
        return;
    }
    
    const controlElement = document.getElementById(condition.controlId);
    
    if (!controlElement) {
        console.warn(`控件不存在: ${condition.controlId}`);
        return;
    }
    
    // 获取当前控件值
    let currentValue;
    if (controlElement.type === 'range') {
        currentValue = parseFloat(controlElement.value);
    } else if (controlElement.tagName === 'SELECT') {
        currentValue = controlElement.value; // 对于select，保持字符串格式
    } else {
        currentValue = controlElement.value;
    }
    
    // 根据比较条件判断是否满足
    let conditionMet = false;
    switch (condition.comparison) {
        case '>=':
            conditionMet = currentValue >= condition.targetValue;
            break;
        case '<=':
            conditionMet = currentValue <= condition.targetValue;
            break;
        case '=':
        case '==':
            if (typeof condition.targetValue === 'string') {
                conditionMet = currentValue === condition.targetValue;
            } else {
                conditionMet = Math.abs(currentValue - condition.targetValue) < 0.001; // 浮点数比较
            }
            break;
        case '>':
            conditionMet = currentValue > condition.targetValue;
            break;
        case '<':
            conditionMet = currentValue < condition.targetValue;
            break;
        default:
            console.warn(`未知的比较操作符: ${condition.comparison}`);
            return;
    }
    
    // 更新下一步按钮状态
    const nextBtn = document.getElementById('next-step-btn');
    if (nextBtn) {
        nextBtn.disabled = !conditionMet;
        if (conditionMet) {
            console.log(`步骤 ${currentStep.id} 完成条件已满足`);
        }
    }
}