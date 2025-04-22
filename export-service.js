// export-service.js - 导出服务
// 负责处理数据导出和整合功能

class ExportService {
  constructor() {
    // 保存检索结果的存储位置
    this.storagePMIDKey = 'gbd_pmid_journal_data';
    this.storageYearlyCounts = 'gbd_yearly_counts_data';
    this.storageJournalMetrics = 'gbd_journal_metrics_data';
  }

  /**
   * 第一阶段：导出PMID和期刊映射数据
   * @param {Array} journals - 期刊数据数组，包含基础信息
   * @param {Array} pmidToJournal - PMID到期刊的映射数组
   */
  exportPMIDJournalMapping(journals, pmidToJournal) {
    // 保存数据到localStorage用于后续整合
    localStorage.setItem(this.storagePMIDKey, JSON.stringify({
      journals: journals,
      pmidToJournal: pmidToJournal
    }));

    // 准备CSV数据
    let csvContent = "PMID,JournalName\n";
    
    // 添加PMID到期刊的映射
    pmidToJournal.forEach(item => {
      csvContent += `${item.pmid},"${item.journalName}"\n`;
    });
    
    // 添加期刊统计信息
    csvContent += "\n期刊名称,文献数量\n";
    journals.forEach(journal => {
      csvContent += `"${journal.name}",${journal.gdbCount}\n`;
    });
    
    // 下载CSV文件
    this.downloadCSV(csvContent, 'pmid_journal_mapping.csv');
    
    return {
      journals: journals,
      pmidToJournal: pmidToJournal
    };
  }

  /**
   * 第二阶段：导出期刊影响因子和分区数据
   * @param {Array} journals - 带有ISSN、影响因子和分区的期刊数据
   */
  exportJournalMetrics(journals) {
    // 保存数据到localStorage用于后续整合
    localStorage.setItem(this.storageJournalMetrics, JSON.stringify(journals));

    // 准备CSV数据
    let csvContent = "期刊名称,ISSN,影响因子,中科院分区,文献数量\n";
    
    journals.forEach(journal => {
      csvContent += `"${journal.name}","${journal.issn || ''}","${journal.impactFactor}","${journal.zkyQuartile}",${journal.gdbCount}\n`;
    });
    
    // 下载CSV文件
    this.downloadCSV(csvContent, 'journal_metrics.csv');
    
    return journals;
  }

  /**
   * 第三阶段：导出期刊年发文量数据
   * @param {Array} journalsWithYearlyCounts - 带有年发文量的期刊数据
   */
  exportJournalYearlyCounts(journalsWithYearlyCounts) {
    // 保存数据到localStorage用于后续整合
    localStorage.setItem(this.storageYearlyCounts, JSON.stringify(journalsWithYearlyCounts));

    // 准备CSV数据
    // 获取当前年份，显示最近5年
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 5; y < currentYear; y++) {
      years.push(y);
    }
    
    // 创建表头
    let csvContent = "期刊名称,ISSN";
    years.forEach(year => {
      csvContent += `,${year}年发文量`;
    });
    csvContent += "\n";
    
    // 添加数据行
    journalsWithYearlyCounts.forEach(journal => {
      csvContent += `"${journal.name}","${journal.issn || ''}"`;
      
      years.forEach(year => {
        const count = journal.yearlyCounts[year] || 0;
        csvContent += `,${count}`;
      });
      
      csvContent += "\n";
    });
    
    // 下载CSV文件
    this.downloadCSV(csvContent, 'journal_yearly_counts.csv');
    
    return journalsWithYearlyCounts;
  }

  /**
   * 第四阶段：整合所有数据并导出完整CSV
   * 可以直接调用该方法从localStorage读取之前保存的数据
   */
  exportIntegratedData() {
    // 从localStorage读取数据
    const pmidJournalData = JSON.parse(localStorage.getItem(this.storagePMIDKey) || '{"journals":[],"pmidToJournal":[]}');
    const journalMetricsData = JSON.parse(localStorage.getItem(this.storageJournalMetrics) || '[]');
    const yearlyCountsData = JSON.parse(localStorage.getItem(this.storageYearlyCounts) || '[]');
    
    // 获取当前年份，显示最近5年
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 5; y < currentYear; y++) {
      years.push(y);
    }
    
    // 准备整合后的CSV数据
    let csvContent = "期刊名称,ISSN,影响因子,中科院分区,文献数量";
    // 添加年发文量列
    years.forEach(year => {
      csvContent += `,${year}年发文量`;
    });
    csvContent += ",近5年总发文量\n";
    
    // 整合数据 - 使用journalMetricsData作为基础，因为它已包含ISSN、IF和分区
    const baseJournals = journalMetricsData.length > 0 ? journalMetricsData : pmidJournalData.journals;
    
    baseJournals.forEach(journal => {
      const name = journal.name;
      const issn = journal.issn || "";
      const impactFactor = journal.impactFactor || "—";
      const zkyQuartile = journal.zkyQuartile || "—";
      const count = journal.gdbCount || 0;
      
      // 查找年发文量数据
      const yearlyData = yearlyCountsData.find(j => j.name === name) || { yearlyCounts: {} };
      const yearlyCounts = yearlyData.yearlyCounts || {};
      
      // 计算总发文量
      let totalYearlyCount = 0;
      
      // 添加基础数据到CSV
      csvContent += `"${name}","${issn}","${impactFactor}","${zkyQuartile}",${count}`;
      
      // 添加各年发文量
      years.forEach(year => {
        const yearCount = yearlyCounts[year] || 0;
        totalYearlyCount += yearCount;
        csvContent += `,${yearCount}`;
      });
      
      // 添加总发文量
      csvContent += `,${totalYearlyCount}\n`;
    });
    
    // 下载CSV文件
    this.downloadCSV(csvContent, 'integrated_journal_data.csv');
    
    return {
      journals: baseJournals,
      yearlyCountsData: yearlyCountsData
    };
  }

  /**
   * 辅助方法：下载CSV文件
   * @param {string} content - CSV内容
   * @param {string} fileName - 文件名
   */
  downloadCSV(content, fileName) {
    // 添加BOM以确保Excel正确识别UTF-8编码
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    
    // 创建下载链接
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// 创建全局实例
window.exportService = new ExportService(); 