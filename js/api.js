// api.js - AI问答接口模块
// 使用代理端点调用DeepSeek API，确保API密钥安全

window.getAiResponse = async function(userMessage, chatHistory = []) {
    try {
        // 构建消息历史，包含系统提示和聊天历史
        const messages = [
            { 
                role: "system", 
                content: "你是一位精通统计力学和热物理的大学教授，擅长讲解麦克斯韦速率分布。回答需专业、清晰、启发思考，并使用中文。" 
            }
        ];
        
        // 添加聊天历史（最近5轮对话）
        const recentHistory = chatHistory.slice(-10); // 保留最近10条消息
        messages.push(...recentHistory);
        
        // 添加当前用户消息
        messages.push({ role: "user", content: userMessage });
        
        // 创建AbortController用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: messages
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API request failed with status ${response.status}:`, errorText);
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
        
    } catch (error) {
        console.error("AI Response Error:", error);
        
        if (error.name === 'AbortError') {
            return "请求超时，请稍后再试。";
        } else if (error.message.includes('Failed to fetch')) {
            return "网络连接失败，请检查网络连接后重试。";
        } else if (error.message.includes('401')) {
            return "API密钥无效，请检查配置。";
        } else if (error.message.includes('429')) {
            return "API调用频率过高，请稍后再试。";
        } else {
            return `API调用失败: ${error.message}`;
        }
    }
}