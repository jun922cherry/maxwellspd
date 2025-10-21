// /api/critique-step-conclusion.js

// 说明：用于“每步结论AI批改”。接收 stepId 与 studentConclusion，调用 DeepSeek 返回针对性的批改与正确结论。
export default async function handler(req, res) {
  // 仅允许 POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: DEEPSEEK_API_KEY not set' });
    }

    const { stepId, studentConclusion } = req.body || {};
    if (!stepId || typeof studentConclusion !== 'string') {
      return res.status(400).json({ error: 'Missing stepId or studentConclusion.' });
    }

    // 本项目定义的每步“正确核心结论/要点”
    const correctConclusions = {
      1: '温度越高，分布曲线越平缓宽阔，峰值向右移动；分子质量越大，曲线越陡峭狭窄，峰值向左移动。',
      2: '大量粒子从无序的初始状态，通过持续的随机碰撞，最终会自发地演化到一个宏观上稳定、可预测的统计平衡态（麦克斯韦分布）。',
      3: '分布的高能“尾部”虽然粒子占比极低，但显著抬高系统的平均动能；如果只移除这些高能粒子，系统整体温度会下降（思想实验）。',
      4: '蒸发冷却本质上是选择性移除高能粒子，导致剩余粒子的平均动能降低，从而宏观温度下降；这一过程可在模拟中观察到对应的分布曲线变化。'
      // 可继续扩展更多步骤...
    };

    const correctConclusion = correctConclusions[stepId];
    if (!correctConclusion) {
      return res.status(400).json({ error: 'Invalid stepId.' });
    }

    const prompt = `你是一位循循善诱的大学物理助教。一个学生刚刚完成了“麦克斯韦速率分布”实验的第 ${stepId} 步，并提交了他的观察结论。\n\n【本步实验的核心结论】:\n"${correctConclusion}"\n\n【学生提交的结论】:\n"${studentConclusion}"\n\n请你根据以上信息，完成以下任务：\n1) 用简短、鼓励的语气，首先肯定学生结论中正确的部分（如果有）。\n2) 温和地指出其结论中不准确或遗漏的部分。\n3) 清晰地重述一遍本步骤的正确核心结论，帮助他巩固知识。\n\n要求：回复简短、友好，像一次真实的对话，不要输出多余的系统说明。`;

    const apiResp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        stream: false,
        max_tokens: 800
      })
    });

    if (!apiResp.ok) {
      const errorText = await apiResp.text();
      console.error('DeepSeek API error:', apiResp.status, errorText);
      return res.status(apiResp.status).json({ error: 'AI service error', detail: errorText });
    }

    const result = await apiResp.json();
    const critique = result?.choices?.[0]?.message?.content || '';

    return res.status(200).json({ critique });
  } catch (error) {
    console.error('Error in /api/critique-step-conclusion:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error?.message || String(error) });
  }
}