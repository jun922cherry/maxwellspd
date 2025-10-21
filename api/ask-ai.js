// /api/ask-ai.js

// Vercel Serverless Function, 运行在Node.js环境
export default async function handler(request, response) {
    // 从环境变量中安全地读取API密钥（统一使用DEEPSEEK_API_KEY）
    const apiKey = process.env.DEEPSEEK_API_KEY;

    // 检查API密钥是否存在
    if (!apiKey) {
        console.error('DEEPSEEK_API_KEY environment variable is not set');
        return response.status(500).json({ error: 'Server configuration error: API key not found' });
    }

    // 仅允许POST请求
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // 从请求体中获取用户输入
    const userPrompt = request.body.prompt;
    if (!userPrompt) {
        return response.status(400).json({ error: 'Bad Request: Missing prompt' });
    }

    try {
        // 构建专业的物理实验AI角色设定
        const systemPrompt = `你是一位专业的物理实验探究平台AI助手，具有以下特点和职责：

**角色定位：**
- 物理教育专家，擅长实验教学和学生能力评估
- 友善耐心的导师，善于启发式教学
- 严谨的科学态度，注重实验方法和科学思维

**主要职责：**
1. **实验答疑**：解答学生在物理实验中遇到的问题，包括实验原理、操作方法、数据分析等
2. **能力评估**：根据学生的提问和实验表现，评估其物理概念理解、实验技能、科学思维等能力
3. **学习指导**：提供个性化的学习建议，帮助学生提升实验技能和物理理解

**回答风格：**
- 使用简洁清晰的中文表达
- 结合具体实验情境进行解释
- 适当使用启发性问题引导学生思考
- 提供循序渐进的学习建议
- 鼓励学生主动探究和实践

**专业领域：**
- 力学、热学、电磁学、光学、原子物理等各分支
- 实验设计、数据处理、误差分析
- 科学方法论和实验技能培养

请根据学生的具体问题，提供专业、耐心、有启发性的回答。`;

        // 向DeepSeek API发起请求（统一使用标准端点）
        const apiResponse = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                stream: false,
                temperature: 0.7,
                max_tokens: 1000
            }),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`DeepSeek API error: ${apiResponse.status} - ${errorText}`);
            return response.status(apiResponse.status).json({ 
                error: `AI service error: ${apiResponse.status}` 
            });
        }

        const data = await apiResponse.json();

        // 验证响应格式
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Unexpected API response format:', data);
            return response.status(500).json({ error: 'Unexpected response format from AI service' });
        }

        // 将AI的响应返回给我们的前端
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        return response.status(200).json(data);

    } catch (error) {
        console.error('Error in Vercel function when calling AI API:', error);
        return response.status(500).json({ 
            error: 'Internal Server Error',
            details: error.message 
        });
    }
}