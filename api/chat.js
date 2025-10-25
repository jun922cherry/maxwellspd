// 文件路径: /api/chat.js

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'DeepSeek API key not configured on server' });
    }
    try {
        const body = req.body || {};
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const hasSystem = messages.find(m => m.role === 'system');
        if (!hasSystem) {
            messages.unshift({ role: 'system', content: '你是一位精通统计力学和热物理的大学教授，擅长讲解麦克斯韦速率分布。回答需专业、清晰、启发思考，并使用中文。' });
        }
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({ model: body.model || 'deepseek-chat', messages })
        });
        if (!response.ok) {
            const errorData = await response.text();
            return res.status(response.status).json({ error: 'Upstream Error', detail: errorData });
        }
        const data = await response.json();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json(data);
    } catch (error) {
        console.error('Error proxying to DeepSeek:', error);
        res.status(500).json({ error: 'Internal Server Error while proxying to DeepSeek' });
    }
};