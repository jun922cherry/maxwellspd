// /api/submit-conclusion.js

// Vercel Serverless Function for submitting experiment conclusions
export default async function handler(request, response) {
    // 仅允许POST请求
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // 从请求体中获取结论内容和操作日志
    const { conclusion, operationLog, experimentType, timestamp } = request.body;
    
    if (!conclusion) {
        return response.status(400).json({ error: 'Bad Request: Missing conclusion' });
    }

    try {
        // 构建完整的实验报告数据
        const experimentReport = {
            type: 'complete_experiment_report',
            experimentType: experimentType || 'maxwell_speed_distribution',
            conclusion: conclusion,
            operationLog: operationLog || [],
            operationSummary: {
                totalOperations: (operationLog || []).length,
                temperatureChanges: (operationLog || []).filter(log => log.event === 'set_temperature').length,
                gasChanges: (operationLog || []).filter(log => log.event === 'change_gas').length,
                curveSaves: (operationLog || []).filter(log => log.event === 'save_curve').length,
                resets: (operationLog || []).filter(log => log.event === 'reset_simulation').length
            },
            timestamp: timestamp || new Date().toISOString(),
            submittedAt: new Date().toISOString()
        };

        // 这里可以添加数据库存储逻辑
        // 目前先记录到控制台
        console.log('Complete experiment report submitted:', experimentReport);
        console.log('Operation log details:', operationLog);

        // 模拟处理时间
        await new Promise(resolve => setTimeout(resolve, 500));

        // 返回成功响应
        return response.status(200).json({
            success: true,
            message: '实验报告提交成功',
            data: {
                submissionId: `report_${Date.now()}`,
                timestamp: experimentReport.submittedAt,
                operationCount: experimentReport.operationSummary.totalOperations,
                summary: experimentReport.operationSummary
            }
        });

    } catch (error) {
        console.error('Error submitting conclusion:', error);
        return response.status(500).json({ 
            error: 'Internal Server Error',
            message: '结论提交失败，请稍后重试'
        });
    }
}