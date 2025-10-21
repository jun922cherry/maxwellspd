// /api/evaluate-experiment.js

// 独立的实验评价后端端点（与问答AI完全分离）
export default async function handler(req, res) {
    // 1) 仅允许 POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 2) 从环境变量安全读取密钥
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            throw new Error('API key is not configured.');
        }

        // 3) 从请求体读取数据（V2.1: 新增qaHistory）
        const { operationLog, userFeedback, qaHistory } = req.body || {};
        if (!operationLog || !userFeedback || !qaHistory) {
            return res.status(400).json({ error: 'Missing operationLog, userFeedback, or qaHistory in request body.' });
        }

        // 4) 构建完整提示词（V2.1: 整合AI问答日志）
        const prompt = `面向DeepSeek API的最终版提示词 (Prompt)

**角色定义 (Role Definition)**
你是一位资深的大学物理实验教师，具备敏锐的洞察力，擅长通过分析学生的实验过程日志和文字报告，来评估其科学探究方法的严谨性、思维的深度以及对物理概念的理解程度。你的评价不仅关注结果，更重视过程的合理性。

**任务描述 (Task Description)**
你的任务是根据下面提供的【五维实验质量评价模型】，对一份学生提交的【虚拟实验报告】进行全面分析和评分。请严格按照评分标准，为每个维度打分（整数，1-10分），并提供简明扼要的评语作为打分依据。最终，请给出整体评价和具体的改进建议。

**输入数据结构说明 (Input Data Structure)**
【虚拟实验报告】包含三部分：
1. **操作日志 (Operation Log)**: 记录了学生在实验过程中的所有关键操作。
2. **用户反馈 (User Feedback)**: 记录了学生在每个引导步骤后提交的文字观察和结论。
3. **AI问答日志 (AI Q&A Log)**: 记录了学生在实验中向AI助手提出的所有问题，这直接反映了其思考和困惑。

**核心评价框架 (Core Evaluation Framework)**
【五维实验质量评价模型】

**1. 维度一：探索的系统性 (Systematic Exploration)**
评分标准: 分析操作日志的序列。学生是否在探究变量关系时，严格执行了"控制变量法"？操作是否具有清晰的逻辑链条（如从低到高连贯扫描），而非随机、混乱地调节多个参数？

**2. 维度二：关键数据点的覆盖度 (Critical Data Point Coverage)**
评分标准: 分析操作日志中的状态更新数据。学生是否探索了能凸显"真实气体"与"理想气体"模型偏差的关键区域（即高压、低温的极端条件）？**同时，参考AI问答日志，学生是否通过提问来主动探寻关键实验区？**

**3. 维度三：观察的敏锐度与描述能力 (Observational Acuity & Description)**
评分标准: 分析用户反馈的文本内容。学生的描述是否准确、具体？是否从定性描述提升到了半定量描述？是否敏锐地观察并描述了核心现象——"真实气体曲线与理想气体基准线的偏离"？**同时，分析AI问答日志，学生提出的问题是否基于其敏锐的观察？**

**4. 维度四：假设检验与因果推断 (Hypothesis Testing & Causal Inference)**
评分标准: 结合分析操作日志和用户反馈。学生是否展现了"提出假设->设计操作->进行验证"的思维模式？**这是评估此项能力的关键：分析AI问答日志，学生是否通过提问的方式来表达、验证自己的物理假设？**

**5. 维度五：工具使用与综合能力 (Tool Utilization & Synthesis)**
评分标准: 分析操作日志中是否包含对高级工具（如"器壁碰撞监视器"）的调用记录。在用户反馈中，学生是否尝试将宏观图表（P-V-T图）的现象与微观数据（碰撞频率等）联系起来？**同时，分析AI问答日志，学生是否提出了关联不同工具或数据维度的问题？**

**输出格式要求 (Required Output Format)**
请严格以JSON格式输出你的评价，结构如下：

{
  "evaluation_summary": "（对此份实验报告的整体评价，一句话总结）",
  "dimensions": {
    "systematic_exploration": {
      "score": 8,
      "justification": "学生在大部分时间内都遵循了控制变量法，但在初期有少量随机操作。"
    },
    "critical_data_coverage": {
      "score": 6,
      "justification": "学生探索了高压区，但对低温区的探索不足，未能覆盖所有关键区域。"
    },
    "observational_acuity": {
      "score": 9,
      "justification": "能准确并以半定量的方式描述曲线的偏离现象，观察敏锐。"
    },
    "hypothesis_testing": {
      "score": 5,
      "justification": "观察到了现象，但未能明确提出假设并通过后续实验进行验证。"
    },
    "tool_utilization": {
      "score": 7,
      "justification": "使用了器壁碰撞监视器，但未能在反馈中将其与宏观现象进行有效关联。"
    }
  },
  "overall_score": 7.0,
  "suggestions_for_improvement": "建议下次实验时，在观察到现象后，大胆提出自己的猜想，并尝试设计一两个简单的步骤来验证它。"
}

【待评价的学生虚拟实验报告】

**1. 操作日志 (Operation Log):**

${JSON.stringify(operationLog, null, 2)}

**2. 用户反馈 (User Feedback):**

${JSON.stringify(userFeedback, null, 2)}

**3. AI问答日志 (AI Q&A Log):**

${JSON.stringify(qaHistory, null, 2)}
`;

        // 5) 调用 DeepSeek API（后端到后端）
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`DeepSeek API error: ${response.statusText} - ${errorData}`);
        }

        const result = await response.json();
        const content = result?.choices?.[0]?.message?.content;

        let evaluationJson;
        try {
            evaluationJson = JSON.parse(content);
        } catch (e) {
            // 若未返回标准JSON，则将原始内容包裹返回，方便排查
            return res.status(200).json({ raw: content, note: 'Returned non-JSON content from model.' });
        }

        // 6) 返回标准JSON评价结果
        return res.status(200).json(evaluationJson);
    } catch (error) {
        console.error('Error in /api/evaluate-experiment:', error);
        return res.status(500).json({ error: 'An internal server error occurred.' });
    }
}
