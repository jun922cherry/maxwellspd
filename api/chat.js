// 文件路径: /api/chat.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // [核心修改 1] 从环境变量中读取DEEPSEEK_API_KEY
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'DeepSeek API key not configured on server' });
    }

    try {
        // [核心修改 2] 将fetch请求的目标URL更改为DeepSeek的端点
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}` // 安全地在后端使用密钥
            },
            body: JSON.stringify(req.body) // 将前端的请求体原封不动地转发
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json(errorData);
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (error) {
        console.error('Error proxying to DeepSeek:', error);
        res.status(500).json({ error: 'Internal Server Error while proxying to DeepSeek' });
    }
}