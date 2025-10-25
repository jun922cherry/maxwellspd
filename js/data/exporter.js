// 数据导出模块：导出当前指标为CSV
/**
 * 将当前指标面板的数据导出为CSV文件。
 */
export function exportIndicatorsToCSV() {
  try {
    const st = (window.State && window.State.getState && window.State.getState()) ? window.State.getState() : window.appState || {};
    if (typeof window.getCurrentIndicatorsData !== 'function') {
      console.error('UIManager.getCurrentIndicatorsData 不可用');
      if (typeof window.showErrorModal === 'function') window.showErrorModal('导出失败：无法获取数据。');
      return;
    }
    const indicatorsData = window.getCurrentIndicatorsData();
    if (!indicatorsData) {
      console.error('无法获取指标数据进行导出。');
      if (typeof window.showErrorModal === 'function') window.showErrorModal('导出失败：无法获取数据。');
      return;
    }

    const headers = ['Indicator', 'Value_Theoretical', 'Value_Simulated', 'Unit'];
    const rows = [
      ['最概然速率 (Vp)', format(indicatorsData.vpTheoretical, 'fixed1'), format(indicatorsData.vpSimulated, 'fixed1'), 'm/s'],
      ['方均根速率 (Vrms)', format(indicatorsData.vrmsTheoretical, 'fixed1'), format(indicatorsData.vrmsSimulated, 'fixed1'), 'm/s'],
      ['分布熵 (相对)', '--', format(indicatorsData.entropy, 'fixed4'), '无单位'],
      ['当前有效温度 (Teff)', '--', format(indicatorsData.temperatureEffective, 'fixed2'), 'K'],
      ['粒子总数 (N)', '--', String(indicatorsData.particleCount ?? '--'), '个'],
      ['当前总动能', '--', format(indicatorsData.keTotal, 'exp3'), 'J'],
      ['平均动能/粒子', '--', format(indicatorsData.keAverage, 'exp3'), 'J'],
      ['相对压强 (Prel)', '--', format(indicatorsData.pressureRelative, 'fixed3'), '相对值'],
      ['模拟时间尺度', '--', String(indicatorsData.timeScale ?? '--'), 'x'],
      ['平均自由程 (λ)', format(indicatorsData.mfpTheoretical, 'exp3'), format(indicatorsData.mfpSimulated, 'exp3'), 'm']
    ];

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      const sanitized = row.map(field => '"' + String(field ?? '').replace(/"/g, '""') + '"');
      csvContent += sanitized.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `maxwellspd_data_${timestamp}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof window.showEvaluationReportModal === 'function') {
      // 可选：提示
    }
  } catch (e) {
    console.error('导出CSV失败:', e);
    if (typeof window.showErrorModal === 'function') window.showErrorModal('导出失败：发生异常');
  }
}

function format(value, type) {
  if (!Number.isFinite(value)) return '--';
  switch (type) {
    case 'fixed1': return value.toFixed(1);
    case 'fixed2': return value.toFixed(2);
    case 'fixed3': return value.toFixed(3);
    case 'fixed4': return value.toFixed(4);
    case 'exp3': return value.toExponential(3);
    default: return String(value);
  }
}

// 暴露到 window
window.Exporter = { exportIndicatorsToCSV };
export default { exportIndicatorsToCSV };
