// /api/submit-conclusion.js

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DeepSeek API key not configured on server' });
  }
  const { conclusion, operationLog = [], experimentType = 'maxwell_speed_distribution', timestamp } = req.body || {};
  if (!conclusion) {
    return res.status(400).json({ error: 'Bad Request: Missing conclusion' });
  }
  const systemPrompt = `你是一位精通统计力学和热物理的大学教授，请基于学生的实验结论与操作日志，对“麦克斯韦速率分布实验”进行结构化评价。请严格以JSON对象输出，不要包含多余文本。`;
  const evaluationModel = `【maxwellspd 五维实验评价模型】\n\n维度一：探究的系统性 (Systematic Exploration)\n\n评分标准: 学生是否系统地调节了核心变量（温度、分子质量）来观察分布曲线的变化？操作是否连贯且有目的性？\n\n维度二：对核心变量的理解 (Understanding of Core Variables)\n\n评分标准: 学生的反馈和结论中，是否准确描述了“温度升高，曲线变平缓且峰值右移”、“分子质量增大，曲线变陡峭且峰值左移”等核心规律？\n\n维度三：图表解读与数据分析能力 (Chart Interpretation & Data Analysis)\n\n评分标准: 学生是否能将曲线形态的变化与三个特征速率（Vp, Vavg, Vrms）的变化联系起来？是否使用了“保存对比”功能进行多组实验的对照分析？\n\n维度四：理论与模拟的结合能力 (Theory & Simulation Synthesis)\n\n评分标准: 学生是否观察并讨论了“模拟数据直方图”与“理论曲线”之间的吻合与随机涨落？是否能从微观的粒子碰撞去理解宏观的分布形态？\n\n维度五：结论的科学性与深度 (Scientific Rigor of Conclusion)\n\n评分标准: 最终提交的结论是否科学、严谨？是否超越了简单的现象描述，触及了统计规律的本质？`;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请基于下列实验数据进行评价：\n评价模型：\n${evaluationModel}\n\n学生结论：\n${conclusion}\n\n操作日志（JSON）：\n${JSON.stringify(operationLog).slice(0, 18000)}\n` }
  ];
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model: 'deepseek-chat', messages })
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'LLM request failed', detail: errText });
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(content); } catch (e) { parsed = { raw: content }; }
    return res.status(200).json({ success: true, message: '实验评价完成', evaluation: parsed, meta: { submissionId: `eval_${Date.now()}`, operationCount: operationLog.length } });
  } catch (error) {
    console.error('Error evaluating conclusion:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: '智能评价失败，请稍后重试' });
  }
};