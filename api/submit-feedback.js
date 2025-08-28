// /api/submit-feedback.js

// Vercel Serverless Function for submitting experiment feedback
export default async function handler(request, response) {
    // 仅允许POST请求
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // 从请求体中获取反馈内容
    const { feedback, experimentType, rating, timestamp } = request.body;
    
    if (!feedback) {
        return response.status(400).json({ error: 'Bad Request: Missing feedback' });
    }

    try {
        // 构建反馈数据
        const feedbackData = {
            type: 'experiment_feedback',
            experimentType: experimentType || 'maxwell_speed_distribution',
            feedback: feedback,
            rating: rating || null,
            timestamp: timestamp || new Date().toISOString(),
            submittedAt: new Date().toISOString()
        };

        // 这里可以添加数据库存储逻辑
        // 目前先记录到控制台
        console.log('Experiment feedback submitted:', feedbackData);

        // 模拟处理时间
        await new Promise(resolve => setTimeout(resolve, 500));

        // 返回成功响应
        return response.status(200).json({
            success: true,
            message: '实验反馈提交成功',
            data: {
                submissionId: `feedback_${Date.now()}`,
                timestamp: feedbackData.submittedAt
            }
        });

    } catch (error) {
        console.error('Error submitting feedback:', error);
        return response.status(500).json({ 
            error: 'Internal Server Error',
            message: '反馈提交失败，请稍后重试'
        });
    }
}