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

    // 兼容：Vercel 有时不会自动解析 JSON，需要手动解析字符串体
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { stepId, studentConclusion } = body;
    // 【日志】后端确认接收到的步骤ID
    console.log(`Received critique request for Step ID: ${stepId}`);
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

    // 【新增】强制有效提交的本地兜底判定：明显无效/不相关输入，直接返回固定提示，不调用 AI、不给答案
    const FIXED_INVALID_MSG = '抱歉，您提交的内容似乎无法被识别为对本步骤实验现象的有效观察或结论。请您重新进行观察和思考，并提交一份与本步骤探究目标相关的结论。';
    const text = String(studentConclusion || '').trim();
    const isInvalidInput = (
      text.length <= 2 ||
      (/^[a-zA-Z0-9]+$/.test(text) && text.length <= 6) ||
      ['完成','已完成','ok','OK','好的','好','嗯','啊'].includes(text)
    );
    if (isInvalidInput) {
      return res.status(200).json({ critique: FIXED_INVALID_MSG, invalid: true });
    }

    // 无密钥时提供离线兜底，避免用户提交结论时报错（有效尝试才进入此分支）
    if (!apiKey) {
      const guidanceHints = {
        1: '请重点观察：当温度升高或分子质量变化时，分布曲线的整体形态（宽窄）与峰值位置是否也发生了变化？',
        2: '请思考：在持续的随机碰撞下，分布形态的演化趋势是什么？是否逐渐接近某种稳定的统计状态？',
        3: '请留意：分布中高能粒子的占比与其对平均动能的影响。当你只移除高能粒子时，系统温度会如何变化？先观察再下结论。',
        4: '请关注：选择性移除高能粒子后，剩余粒子的能量分布与温度的关系。观察曲线如何随过程变化。'
      };
      const hint = guidanceHints[stepId] || '请根据提示重新观察关键变量与图像变化。';
      const offline = `（离线批改）${hint}\n请根据这个提示再仔细观察一下，然后重新提交你的结论吧！`;
      return res.status(200).json({ critique: offline, offline: true, invalid: true });
    }

    // 【重写】“终版 - 引导式反馈”Prompt：错误但相关也不直接给出答案，只给引导与提示
    const prompt = `
你是一位极其擅长苏格拉底式提问的大学物理助教。你的目标不是直接给出答案，而是通过提示和引导，帮助学生自己发现问题并找到正确结论。一个学生刚刚完成了“麦克斯韦速率分布”实验的第 ${stepId} 步，并提交了他的观察结论。

【本步实验的核心结论要点】:
"${correctConclusion}" // 这是内部参考的标准答案，绝不能直接透露给学生

【学生提交的结论】:
"${studentConclusion}" // 这是学生实际输入的内容

请你根据以上信息，严格按照以下步骤完成批改任务：

1.  **【内容有效性判断】**: 首先，判断【学生提交的结论】是否是针对本步骤探究目标（围绕上述【核心结论要点】展开）的一次**有意义的尝试**？
    * **如果**学生的结论明显是无意义的字符（如“abc”、“123”）、完全不相关的内容、或者过于敷衍（如“完成”、“ok”）：
        * **请直接回复以下内容，不要进行任何评价或给出提示**：
          "${FIXED_INVALID_MSG}"
    * **否则**（如果内容虽然可能不准确或不完整，但**至少是一次相关的尝试**）：
        * 继续执行下一步。

2.  **【引导式反馈 - 指出问题，引发思考】**: 将【学生提交的结论】与【核心结论要点】进行细致比对。
    * **肯定可取之处 (如果存在)**: 如果学生结论中有部分正确，用简短、鼓励的语气明确指出**哪部分观察是对的**（例如，“你观察到温度升高曲线变平缓，这一点很好”）。**如果没有正确的部分，则跳过此步。**
    * **【关键】提出引导性问题或提示**: 针对学生结论中**不准确**或**遗漏**的关键要点，**不要直接纠正**，而是提出一个**引导性的问题**或**提示**，促使他重新思考或观察。
        * **示例1 (如果学生只说了变宽，没说峰值移动)**: “观察得很仔细！除了曲线变宽之外，你是否注意到曲线的最高点（峰值）的位置也发生了变化呢？”
        * **示例2 (如果学生遗漏了质量的影响)**: “你准确描述了温度的影响。那么，当你切换不同气体（改变分子质量）时，曲线又会如何变化呢？这同样是本步骤的关键。”
        * **示例3 (如果学生结论完全错误)**: “嗯，你的观察似乎与理论预期有些不同。建议你再仔细看看，当[变量X]变化时，[指标Y]具体是如何变化的？”

3.  **【鼓励再次尝试】**: 在给出提示后，明确鼓励学生**基于提示**，再次进行观察或思考，并**重新提交**结论。
    * **示例结尾**: “请根据这个提示再仔细观察一下，然后重新提交你的结论吧！”

4.  **【绝不透露答案】**: **在任何情况下，都不要在你的回复中直接陈述或暗示【核心结论要点】的内容。** 你的任务是引导，不是告知。

5.  **【保持风格】**: 你的整个回复应该简短、友好、充满启发性，像一次耐心的引导对话。
`;

    const _fetch = globalThis.fetch || (await import('node-fetch')).default;
    const apiResp = await _fetch('https://api.deepseek.com/chat/completions', {
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
    const critiqueRaw = result?.choices?.[0]?.message?.content || '';
    // 【更新】无效判定：固定提示 或 引导式结尾都视为需要重新提交（invalid=true）
    const invalid = (
      critiqueRaw.includes(FIXED_INVALID_MSG) ||
      /重新提交/.test(critiqueRaw) ||
      /请根据这个提示/.test(critiqueRaw) ||
      /请重新提交/.test(critiqueRaw)
    );

    return res.status(200).json({ critique: critiqueRaw, invalid });
  } catch (error) {
    console.error('Error in /api/critique-step-conclusion:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error?.message || String(error) });
  }
}