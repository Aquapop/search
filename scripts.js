// 主要JavaScript逻辑
document.addEventListener('DOMContentLoaded', function() {
    // 添加筛选结果计数和导出按钮的样式
    const style = document.createElement('style');
    style.textContent = `
        .filter-count {
            margin: 15px 0;
            padding: 10px;
            background-color: #f0f8ff;
            border-radius: 4px;
            font-weight: bold;
            text-align: center;
            border: 1px solid #add8e6;
        }
        
        #export-filtered-btn {
            margin-top: 10px;
            margin-bottom: 15px;
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            display: block;
            width: 100%;
        }
        
        #export-filtered-btn:hover {
            background-color: #45a049;
        }
    `;
    document.head.appendChild(style);

    // 元素引用
    const searchMethodSelect = document.getElementById('search-method');
    const apiSearchContainer = document.getElementById('api-search-container');
    const fileUploadContainer = document.getElementById('file-upload-container');
    const searchBtn = document.getElementById('search-btn');
    const processFileBtn = document.getElementById('process-file-btn');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.querySelector('.progress');
    const statusText = document.getElementById('status-text');
    const resultsSection = document.querySelector('.results-section');
    const journalCount = document.getElementById('journal-count');
    const journalsList = document.getElementById('journals-list');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // 分步骤导出按钮
    const exportStep1Btn = document.getElementById('export-step1-btn');
    const exportStep2Btn = document.getElementById('export-step2-btn');
    const exportStep3Btn = document.getElementById('export-step3-btn');
    const exportStep4Btn = document.getElementById('export-step4-btn');
    const getYearlyCountsBtn = document.getElementById('get-yearly-counts-btn');

    // 分阶段按钮
    const stage1Btn = document.getElementById('stage1-btn');
    const stage2Btn = document.getElementById('stage2-btn');
    const stage3Btn = document.getElementById('stage3-btn');
    const stage4Btn = document.getElementById('stage4-btn');

    // 数据存储
    let journals = [];
    let originalJournals = []; // 保存筛选前的原始期刊数据
    let filteredJournals = []; // 保存筛选后的期刊数据
    let pmidToJournalMappings = [];  // 保存PMID到期刊的映射
    
    // 映射对象
    window.issnMap = {}; // 期刊名到ISSN的映射
    window.normalizedIssnMap = {}; // 标准化后的期刊名到ISSN的映射
    window.ifMap = {}; // ISSN到影响因子的映射
    window.zkyMap = {}; // ISSN到中科院分区的映射
    window.eIssnMap = {}; // eISSN到影响因子和分区的映射
    
    // 初始化导出服务
    if (!window.exportService) {
        window.exportService = {
            exportPMIDJournalMapping: function(journals, mappings) {
                // 创建CSV内容
                let csv = "PMID,Journal Name\n";
                mappings.forEach(item => {
                    csv += `${item.pmid},"${item.journalName}"\n`;
                });
                
                // 触发下载
                this.downloadCSV(csv, "pmid_journal_mapping.csv");
            },
            
            exportJournalMetrics: function(journals) {
                // 创建CSV内容
                let csv = "Journal Name,ISSN,Impact Factor,ZKY Quartile,GDB Count\n";
                journals.forEach(journal => {
                    csv += `"${journal.name}","${journal.issn || ''}","${journal.impactFactor || ''}","${journal.zkyQuartile || ''}",${journal.gdbCount}\n`;
                });
                
                // 触发下载
                this.downloadCSV(csv, "journal_metrics.csv");
            },
            
            exportJournalYearlyCounts: function(journals) {
                // 获取所有年份
                const years = new Set();
                journals.forEach(journal => {
                    if (journal.yearlyCounts) {
                        Object.keys(journal.yearlyCounts).forEach(year => years.add(year));
                    }
                });
                
                // 按降序排序年份
                const sortedYears = Array.from(years).sort((a, b) => b - a);
                
                // 创建CSV标题
                let csv = "Journal Name,ISSN,Impact Factor,ZKY Quartile,GDB Count";
                sortedYears.forEach(year => {
                    csv += `,${year} Count`;
                });
                csv += "\n";
                
                // 添加期刊数据
                journals.forEach(journal => {
                    csv += `"${journal.name}","${journal.issn || ''}","${journal.impactFactor || ''}","${journal.zkyQuartile || ''}",${journal.gdbCount}`;
                    
                    // 添加每年的发文量
                    sortedYears.forEach(year => {
                        const count = journal.yearlyCounts && journal.yearlyCounts[year] ? journal.yearlyCounts[year] : 0;
                        csv += `,${count}`;
                    });
                    
                    csv += "\n";
                });
                
                // 触发下载
                this.downloadCSV(csv, "journal_yearly_counts.csv");
            },
            
            exportFilteredJournals: function(journals) {
                // 创建CSV内容
                let csv = "Journal Name,ISSN,Impact Factor,ZKY Quartile,GDB Count\n";
                journals.forEach(journal => {
                    csv += `"${journal.name}","${journal.issn || ''}","${journal.impactFactor || ''}","${journal.zkyQuartile || ''}",${journal.gdbCount}\n`;
                });
                
                // 触发下载
                this.downloadCSV(csv, "filtered_journals.csv");
            },
            
            exportIntegratedData: function(journalsToExport) {
                // 使用传入的期刊列表，若未指定则使用全局journals
                const journals = journalsToExport || window.journals;
                
                // 获取所有年份
                const years = new Set();
                journals.forEach(journal => {
                    if (journal.yearlyCounts) {
                        Object.keys(journal.yearlyCounts).forEach(year => years.add(year));
                    }
                });
                
                // 按降序排序年份
                const sortedYears = Array.from(years).sort((a, b) => b - a);
                
                // 创建CSV标题
                let csv = "Journal Name,ISSN,Impact Factor,ZKY Quartile,GDB Count";
                sortedYears.forEach(year => {
                    csv += `,${year} Count`;
                });
                csv += "\n";
                
                // 添加期刊数据
                journals.forEach(journal => {
                    csv += `"${journal.name}","${journal.issn || ''}","${journal.impactFactor || ''}","${journal.zkyQuartile || ''}",${journal.gdbCount}`;
                    
                    // 添加每年的发文量
                    sortedYears.forEach(year => {
                        const count = journal.yearlyCounts && journal.yearlyCounts[year] ? journal.yearlyCounts[year] : 0;
                        csv += `,${count}`;
                    });
                    
                    csv += "\n";
                });
                
                // 触发下载
                this.downloadCSV(csv, "integrated_journal_data.csv");
            },
            
            downloadCSV: function(csv, filename) {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        };
    }
    
    // 初始化: 加载ISSN和期刊数据
    loadJournalData();

    // 切换数据输入方式
    searchMethodSelect.addEventListener('change', function() {
        if (this.value === 'api') {
            apiSearchContainer.style.display = 'block';
            fileUploadContainer.style.display = 'none';
        } else {
            apiSearchContainer.style.display = 'none';
            fileUploadContainer.style.display = 'block';
        }
    });

    // 第一阶段：检索PubMed文献，获取PMID与期刊映射
    stage1Btn.addEventListener("click", async () => {
        startStage1();
    });

    // API检索功能也触发第一阶段
    searchBtn.addEventListener("click", async () => {
        startStage1();
    });

    // 第二阶段：获取影响因子和中科院分区
    stage2Btn.addEventListener("click", async () => {
        if (!pmidToJournalMappings.length) {
            alert("请先完成第一阶段：检索PubMed文献，获取PMID与期刊映射");
            return;
        }
        processJournalMetrics();
    });

    // 第三阶段：获取年发文量数据
    stage3Btn.addEventListener("click", async () => {
        if (!journals.length) {
            alert("请先完成第二阶段：获取影响因子和中科院分区");
            return;
        }
        fetchYearlyCounts();
    });

    // 第四阶段：整合所有数据
    stage4Btn.addEventListener("click", async () => {
        if (!journals.length) {
            alert("请先完成前面的阶段");
            return;
        }
        integrateAllData();
    });

    // 导出按钮事件
    exportStep1Btn.addEventListener("click", () => {
        if (!pmidToJournalMappings.length) {
            alert("请先进行检索获取PMID和期刊数据");
            return;
        }
        window.exportService.exportPMIDJournalMapping(journals, pmidToJournalMappings);
    });

    exportStep2Btn.addEventListener("click", () => {
        if (!journals.length) {
            alert("请先获取期刊影响因子和分区数据");
            return;
        }
        window.exportService.exportJournalMetrics(journals);
    });

    exportStep3Btn.addEventListener("click", () => {
        // 使用筛选后的期刊（如果有），否则使用全部期刊
        const journalsToExport = filteredJournals.length > 0 ? filteredJournals : journals;
        
        const journalsWithCounts = journalsToExport.filter(j => j.yearlyCounts && Object.keys(j.yearlyCounts).length > 0);
        if (journalsWithCounts.length === 0) {
            alert("请先获取期刊年发文量数据");
            return;
        }
        window.exportService.exportJournalYearlyCounts(journalsWithCounts);
    });

    exportStep4Btn.addEventListener("click", () => {
        // 使用筛选后的期刊（如果有），否则使用全部期刊
        const journalsToExport = filteredJournals.length > 0 ? filteredJournals : journals;
        window.exportService.exportIntegratedData(journalsToExport);
    });

    getYearlyCountsBtn.addEventListener("click", () => {
        if (!journals.length) {
            alert("请先获取期刊基础数据");
            return;
        }
        fetchYearlyCounts();
    });

    // 筛选按钮
    applyFilterBtn.addEventListener("click", () => {
        // 正确获取筛选参数值
        const minPublications = parseInt(document.getElementById("min-publications")?.value) || 1;
        const zkyQuartileFilter = document.getElementById("zky-quartile")?.value || "all";
        
        console.log("应用筛选条件:", { minPublications, zkyQuartileFilter });
        
        // 筛选逻辑完全重写
        const filtered = journals.filter(journal => {
            // 文章数量条件
            const meetCount = journal.gdbCount >= minPublications;
            if (!meetCount) {
                return false;
            }
            
            // 中科院分区条件
            if (zkyQuartileFilter !== "all") {
                const filterZkyNumber = parseInt(zkyQuartileFilter);
                if (!isNaN(filterZkyNumber)) {
                    // 从期刊分区提取数字部分
                    const zkyValue = journal.zkyQuartile || "";
                    let journalZkyNumber = 999; // 默认很大的数（低分区）
                    
                    // 匹配形如"X区"的格式
                    const zkyMatch = zkyValue.match(/^(\d+)区$/);
                    if (zkyMatch) {
                        journalZkyNumber = parseInt(zkyMatch[1]);
                    } 
                    // 如果就是数字，直接使用
                    else if (!isNaN(parseInt(zkyValue))) {
                        journalZkyNumber = parseInt(zkyValue);
                    }
                    
                    // 分区数字小的更好，1区>2区>3区>4区
                    // "3区及以上"意味着要筛选1、2、3区的期刊
                    const meetZky = journalZkyNumber <= filterZkyNumber;
                    console.log(`期刊[${journal.name}] 分区值[${journal.zkyQuartile}] 转为数字[${journalZkyNumber}], 筛选条件[${filterZkyNumber}], 结果[${meetZky ? '通过' : '不通过'}]`);
                    
                    if (!meetZky) {
                        return false;
                    }
                }
            }
            
            // 通过所有筛选条件
            return true;
        });
        
        // 保存筛选结果 - 确保这是一个新的数组引用，避免共享引用导致的问题
        filteredJournals = [...filtered];
        
        // 输出筛选结果的信息以便调试
        console.log(`筛选结果: ${filteredJournals.length}/${journals.length} 本期刊`);
        console.log("前5个筛选结果:", filteredJournals.slice(0, 5).map(j => j.name).join(", "));
        
        // 显示筛选结果计数
        const filterCountElem = document.createElement("div");
        filterCountElem.id = "filter-count";
        filterCountElem.className = "filter-count";
        filterCountElem.innerHTML = `筛选结果: ${filteredJournals.length}/${journals.length} 本期刊`;
        
        // 确保filter-section存在
        let filterSection = document.querySelector('.filter-section');
        if (!filterSection) {
            filterSection = document.createElement('div');
            filterSection.className = 'filter-section';
            const resultsSection = document.querySelector('.results-section');
            if (resultsSection) {
                const container = resultsSection.querySelector('.container');
                if (container) {
                    // 将筛选区域添加到exports-steps-panel后面
                    const exportsPanel = document.querySelector('.export-steps-panel');
                    if (exportsPanel) {
                        container.insertBefore(filterSection, exportsPanel.nextSibling);
                    } else {
                        container.insertBefore(filterSection, document.querySelector('.journals-container'));
                    }
                }
            }
        }
        
        // 如果已存在筛选结果显示，则替换
        const existingCount = document.getElementById("filter-count");
        if (existingCount) {
            existingCount.replaceWith(filterCountElem);
        } else {
            filterSection.appendChild(filterCountElem);
        }
        
        // 添加/更新导出筛选结果按钮
        // 如果已存在按钮，重新绑定事件处理程序以确保使用最新的筛选结果
        let exportFilteredBtn = document.getElementById("export-filtered-btn");
        if (exportFilteredBtn) {
            // 移除所有现有的事件监听器
            const newBtn = exportFilteredBtn.cloneNode(true);
            exportFilteredBtn.parentNode.replaceChild(newBtn, exportFilteredBtn);
            exportFilteredBtn = newBtn;
        } else {
            exportFilteredBtn = document.createElement("button");
            exportFilteredBtn.id = "export-filtered-btn";
            exportFilteredBtn.className = "btn btn-primary";
            exportFilteredBtn.style.marginLeft = "10px";
            exportFilteredBtn.style.backgroundColor = "#4CAF50";
            exportFilteredBtn.style.color = "white";
            exportFilteredBtn.style.border = "none";
            exportFilteredBtn.style.padding = "8px 16px";
            exportFilteredBtn.style.borderRadius = "4px";
            exportFilteredBtn.style.cursor = "pointer";
            exportFilteredBtn.innerText = "导出筛选结果";
            filterSection.appendChild(exportFilteredBtn);
        }
        
        // 重新绑定点击处理程序，确保使用当前的filteredJournals
        exportFilteredBtn.addEventListener("click", () => {
            console.log(`准备导出当前筛选结果，共 ${filteredJournals.length} 本期刊`);
            // 创建一个副本，确保导出的是当前的筛选结果
            const currentFilteredJournals = [...filteredJournals];
            exportFilteredData(currentFilteredJournals);
        });
        
        // 添加恢复全部期刊按钮
        if (!document.getElementById("reset-filter-btn")) {
            const resetFilterBtn = document.createElement("button");
            resetFilterBtn.id = "reset-filter-btn";
            resetFilterBtn.className = "btn btn-secondary";
            resetFilterBtn.style.marginLeft = "10px";
            resetFilterBtn.style.backgroundColor = "#f8f9fa";
            resetFilterBtn.style.color = "#212529";
            resetFilterBtn.style.border = "1px solid #dee2e6";
            resetFilterBtn.style.padding = "8px 16px";
            resetFilterBtn.style.borderRadius = "4px";
            resetFilterBtn.style.cursor = "pointer";
            resetFilterBtn.innerText = "显示全部期刊";
            resetFilterBtn.addEventListener("click", resetFilter);
            filterSection.appendChild(resetFilterBtn);
        }
        
        // 使用筛选结果更新期刊列表显示
        renderJournals(filteredJournals);
    });
    
    // 恢复全部期刊显示
    function resetFilter() {
        // 清空筛选结果
        filteredJournals = [];
        // 重新渲染全部期刊
        renderJournals(journals);
        // 更新筛选结果计数
        const filterCountElem = document.getElementById("filter-count");
        if (filterCountElem) {
            filterCountElem.innerHTML = `显示全部期刊: ${journals.length} 本`;
        }
        console.log("已恢复显示全部期刊");
    }
    
    // 导出筛选结果
    function exportFilteredData(data) {
        console.log(`exportFilteredData被调用，数据长度: ${data?.length || 0}`);
        
        // 数据验证：确保是有效的数据数组
        if (!Array.isArray(data) || data.length === 0) {
            alert("没有筛选结果可导出");
            return;
        }
        
        try {
            // 创建CSV内容
            let csvContent = "期刊名称,ISSN,影响因子,中科院分区,文献数量\n";
            
            // 输出前5个记录以便调试
            console.log("导出的前5个期刊:", data.slice(0, 5).map(j => j.name).join(", "));
            
            // 处理每个期刊记录
            data.forEach(journal => {
                csvContent += `"${journal.name}","${journal.issn || ''}","${journal.impactFactor || ''}","${journal.zkyQuartile || ''}",${journal.gdbCount}\n`;
            });
            
            // 下载CSV文件
            const BOM = "\uFEFF"; // 添加BOM以确保Excel正确识别UTF-8编码
            const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
            
            // 创建下载链接
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            
            // 添加时间戳到文件名，避免浏览器缓存问题
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.setAttribute("download", `filtered_journal_metrics_${timestamp}.csv`);
            link.style.visibility = 'hidden';
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`成功导出 ${data.length} 本期刊数据`);
        } catch (e) {
            console.error("导出筛选结果失败:", e);
            alert("导出失败: " + e.message);
        }
    }

    // 排序按钮
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const filterBy = btn.getAttribute("data-filter");
            
            // 移除所有按钮的active类
            filterBtns.forEach(b => b.classList.remove("active"));
            
            // 添加active类到当前按钮
            btn.classList.add("active");
            
            // 根据筛选条件排序期刊
            // 使用当前显示的期刊列表（可能是筛选后的）
            const currentJournals = filteredJournals.length > 0 ? filteredJournals : journals;
            let sorted = [...currentJournals];
            
            if (filterBy === "count") {
                sorted.sort((a, b) => b.gdbCount - a.gdbCount);
            } else if (filterBy === "if") {
                sorted.sort((a, b) => {
                    const ifA = a.impactFactor === "—" ? -1 : parseFloat(a.impactFactor);
                    const ifB = b.impactFactor === "—" ? -1 : parseFloat(b.impactFactor);
                    return ifB - ifA;
                });
            } else if (filterBy === "quartile") {
                sorted.sort((a, b) => {
                    // 将分区转换为数字进行排序，"1区"最高，"4区"最低，没有分区的排在最后
                    const getQuartileValue = q => {
                        if (q === "—") return 5;
                        const match = q.match(/(\d+)区/);
                        return match ? parseInt(match[1]) : 5;
                    };
                    return getQuartileValue(a.zkyQuartile) - getQuartileValue(b.zkyQuartile);
                });
            }
            
            renderJournals(sorted);
        });
    });

    // 第一阶段：检索PubMed文献，获取PMID与期刊映射关系
    async function startStage1() {
        progressContainer.style.display = "block";
        updateProgress(0, "开始检索PubMed...");

        const keywords = document.getElementById("keywords").value;

        try {
            // ① 分页抓全部 PMID
            const pmids = await window.apiService.searchPubmedAll(keywords, (pct, msg) => {
                updateProgress(pct * 0.4, "[Step1] " + msg); // 前40%进度
            });
            updateProgress(40, `拿到${pmids.length}篇文献, 开始获取期刊名...`);

            // ② 获取PMID到期刊的映射关系
            pmidToJournalMappings = await window.apiService.fetchPMIDJournalMapping(pmids, (pct, msg) => {
                updateProgress(40 + pct * 0.5, "[Step2] " + msg); // 中间50%
            });
            updateProgress(90, `获取了${pmidToJournalMappings.length}篇文献的期刊数据`);

            // ③ 统计期刊发文量
            const journalCounts = {};
            pmidToJournalMappings.forEach(item => {
                const journal = item.journalName;
                journalCounts[journal] = (journalCounts[journal] || 0) + 1;
            });
            
            // 转换为数组并排序
            const journalArr = Object.entries(journalCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);
                
            updateProgress(95, `找到${journalArr.length}本期刊`);
            console.log("pmids.length =", pmids.length); 
            console.log("journals =", journalArr);

            // 处理期刊基础数据（不含年发文量）
            journals = journalArr.map(j => {
                return {
                    name: j.name, // 保留原始名称用于显示
                    issn: "",     // ISSN 将在第二阶段处理
                    impactFactor: "—",
                    zkyQuartile: "—",
                    gdbCount: j.count,
                    reviewTime: "—",
                    acceptanceRate: "—",
                    diseases: [],
                    papers: [],
                    yearlyCounts: {} // 初始化为空对象，后续步骤填充
                };
            });

            updateProgress(100, "第一阶段完成：文献PMID和期刊映射已获取！");
            
            // 显示结果
            setTimeout(() => {
                progressContainer.style.display = "none";
                resultsSection.style.display = "block";
                renderJournals(journals);
                
                // 提示用户可以进行下一阶段
                alert("第一阶段完成！已获取期刊基础数据。请点击\"第二阶段\"按钮继续获取影响因子和中科院分区。");
            }, 300);
            
            // 导出第一阶段数据
            window.exportService.exportPMIDJournalMapping(journals, pmidToJournalMappings);
        } catch (e) {
            console.error(e);
            alert("出错啦：" + e.message);
            progressContainer.style.display = "none";
        }
    }
    
    // 第二阶段：处理影响因子和中科院分区数据
    async function processJournalMetrics() {
        try {
            progressContainer.style.display = "block";
            updateProgress(0, "开始处理期刊影响因子和分区数据...");
            
            // 处理每个期刊的ISSN、影响因子和分区
            for (let i = 0; i < journals.length; i++) {
                const journal = journals[i];
                const journalName = journal.name;
                
                // 更新进度
                updateProgress(Math.round((i / journals.length) * 100), 
                    "处理期刊 " + (i+1) + "/" + journals.length + ": " + journalName);
                
                // 1. 查找ISSN
                const issn = window.issnMap[journalName];
                
                if (issn) {
                    journal.issn = issn;
                    
                    // 标准化ISSN格式 - 移除所有非数字和X字符
                    const normalizedIssn = issn.replace(/[^0-9X]/g, '');
                    
                    // 2. 使用ISSN查找影响因子和分区
                    // 尝试多种格式匹配：原格式、标准化格式、带连字符格式
                    if (window.ifMap[issn]) {
                        journal.impactFactor = window.ifMap[issn] || "—";
                        journal.zkyQuartile = window.zkyMap[issn] || "—";
                        console.log("期刊 \"" + journalName + "\" 的ISSN: " + issn + ", IF: " + journal.impactFactor + ", 分区: " + journal.zkyQuartile);
                    } 
                    // 尝试使用带连字符的格式 XXXX-XXXX
                    else if (normalizedIssn.length === 8 && window.ifMap[normalizedIssn.slice(0, 4) + "-" + normalizedIssn.slice(4)]) {
                        const formattedIssn = normalizedIssn.slice(0, 4) + "-" + normalizedIssn.slice(4);
                        journal.impactFactor = window.ifMap[formattedIssn] || "—";
                        journal.zkyQuartile = window.zkyMap[formattedIssn] || "—";
                        console.log("期刊 \"" + journalName + "\" 通过格式化ISSN匹配: " + formattedIssn + ", IF: " + journal.impactFactor + ", 分区: " + journal.zkyQuartile);
                    }
                    // 尝试不带连字符的纯数字格式
                    else if (window.ifMap[normalizedIssn]) {
                        journal.impactFactor = window.ifMap[normalizedIssn] || "—";
                        journal.zkyQuartile = window.zkyMap[normalizedIssn] || "—";
                        console.log("期刊 \"" + journalName + "\" 通过标准化ISSN匹配: " + normalizedIssn + ", IF: " + journal.impactFactor + ", 分区: " + journal.zkyQuartile);
                    }
                    // 尝试通过eISSN匹配
                    else if (window.eIssnMap[issn]) {
                        journal.impactFactor = window.eIssnMap[issn].impactFactor || "—";
                        journal.zkyQuartile = window.eIssnMap[issn].zkyQuartile || "—";
                        console.log("期刊 \"" + journalName + "\" 通过eISSN匹配: " + issn + ", IF: " + journal.impactFactor + ", 分区: " + journal.zkyQuartile);
                    }
                    // 尝试使用标准化的eISSN格式
                    else if (window.eIssnMap[normalizedIssn]) {
                        journal.impactFactor = window.eIssnMap[normalizedIssn].impactFactor || "—";
                        journal.zkyQuartile = window.eIssnMap[normalizedIssn].zkyQuartile || "—";
                        console.log("期刊 \"" + journalName + "\" 通过标准化eISSN匹配: " + normalizedIssn + ", IF: " + journal.impactFactor + ", 分区: " + journal.zkyQuartile);
                    }
                    // 尝试使用带连字符的eISSN格式
                    else if (normalizedIssn.length === 8 && window.eIssnMap[normalizedIssn.slice(0, 4) + "-" + normalizedIssn.slice(4)]) {
                        const formattedIssn = normalizedIssn.slice(0, 4) + "-" + normalizedIssn.slice(4);
                        journal.impactFactor = window.eIssnMap[formattedIssn].impactFactor || "—";
                        journal.zkyQuartile = window.eIssnMap[formattedIssn].zkyQuartile || "—";
                        console.log("期刊 \"" + journalName + "\" 通过格式化eISSN匹配: " + formattedIssn + ", IF: " + journal.impactFactor + ", 分区: " + journal.zkyQuartile);
                    }
                    else {
                        journal.impactFactor = "—";
                        journal.zkyQuartile = "—";
                        console.log("期刊 \"" + journalName + "\" 的ISSN: " + issn + " 在影响因子数据中未找到匹配");
                    }
                } else {
                    console.log("未找到期刊 \"" + journalName + "\" 的ISSN");
                }
            }
            
            updateProgress(100, "第二阶段完成：期刊影响因子和分区数据已处理！");
            
            // 重新渲染期刊列表
            setTimeout(() => {
                progressContainer.style.display = "none";
                // 保存原始期刊数据
                originalJournals = [...journals];
                // 清空筛选结果
                filteredJournals = [];
                
                renderJournals(journals);
                
                // 确保filter-section存在并可见
                let filterSection = document.querySelector('.filter-section');
                if (!filterSection) {
                    // 如果不存在，创建一个
                    filterSection = document.createElement('div');
                    filterSection.className = 'filter-section';
                    // 将其添加到合适的位置，比如结果部分的上方
                    const resultsSection = document.querySelector('.results-section');
                    if (resultsSection) {
                        const container = resultsSection.querySelector('.container');
                        if (container) {
                            // 添加到container，放在journals-container前面
                            container.insertBefore(filterSection, document.querySelector('.journals-container'));
                        }
                    }
                }
                
                // 确保筛选区域可见并添加明显的视觉提示
                filterSection.style.display = "block";
                filterSection.style.backgroundColor = "#f8f9fa";
                filterSection.style.padding = "15px";
                filterSection.style.borderRadius = "5px";
                filterSection.style.marginBottom = "20px";
                filterSection.style.border = "2px solid #28a745";
                
                // 添加提示文字
                const filterHint = document.createElement('div');
                filterHint.className = 'filter-hint';
                filterHint.innerHTML = '<strong>提示：</strong>您现在可以筛选期刊，再进行第三阶段操作，以减少处理的期刊数量';
                filterHint.style.marginBottom = '10px';
                filterHint.style.color = '#28a745';
                
                // 检查提示是否已存在
                if (!filterSection.querySelector('.filter-hint')) {
                    filterSection.insertBefore(filterHint, filterSection.firstChild);
                }
                
                // 提示用户可以进行筛选，然后进行下一阶段
                alert("第二阶段完成！已处理期刊影响因子和分区数据。您现在可以筛选期刊，然后点击\"第三阶段\"按钮获取期刊年发文量。");
            }, 300);
            
            // 导出第二阶段数据
            window.exportService.exportJournalMetrics(journals);
        } catch (e) {
            console.error(e);
            alert("处理期刊影响因子和分区数据出错：" + e.message);
            progressContainer.style.display = "none";
        }
    }
    
    // 第三阶段：获取年发文量的独立函数
    async function fetchYearlyCounts() {
        try {
            progressContainer.style.display = "block";
            updateProgress(0, "开始获取期刊年发文量数据...");
            
            // 使用筛选后的期刊列表（如果有筛选），否则使用全部期刊
            const journalsToProcess = filteredJournals.length > 0 ? filteredJournals : journals;
            
            // 显示将处理的期刊数量
            updateProgress(2, `将处理 ${journalsToProcess.length} 本期刊的年发文量`);
            
            // 分批获取年发文量数据，每批最多3个期刊
            const batchSize = 3;
            for (let i = 0; i < journalsToProcess.length; i += batchSize) {
                const batch = journalsToProcess.slice(i, i + batchSize);
                updateProgress(5 + (i / journalsToProcess.length) * 90, 
                    "获取年发文量 " + (i+1) + "-" + Math.min(i+batchSize, journalsToProcess.length) + "/" + journalsToProcess.length);
                
                // 对每批进行并行处理
                const batchPromises = batch.map(async (journal) => {
                    try {
                        if (journal.issn) {
                            // 使用ISSN获取5年发文量数据
                            journal.yearlyCounts = await window.apiService.getRecent5yCountsByISSN(journal.issn);
                        } else {
                            // 如果没有ISSN，则使用期刊名称获取
                            journal.yearlyCounts = await window.apiService.getRecent5yCounts(journal.name);
                        }
                        console.log("获取期刊 \"" + journal.name + "\" 年发文量成功:", journal.yearlyCounts);
                    } catch (err) {
                        console.error("获取期刊 \"" + journal.name + "\" 年发文量失败:", err);
                        journal.yearlyCounts = {}; // 出错时设为空对象
                    }
                    return journal;
                });
                
                // 等待当前批次完成
                await Promise.all(batchPromises);
            }

            updateProgress(100, "第三阶段完成：年发文量数据获取完成！");
            setTimeout(() => {
                progressContainer.style.display = "none";
                // 重新渲染使用当前的筛选结果
                renderJournals(journalsToProcess); 
                
                // 提示用户可以进行最后阶段
                alert("第三阶段完成！已获取期刊年发文量数据。请点击\"第四阶段\"按钮整合所有数据。");
            }, 300);
            
            // 导出第三阶段数据
            window.exportService.exportJournalYearlyCounts(journalsToProcess);
        } catch (e) {
            console.error(e);
            alert("获取年发文量出错：" + e.message);
            progressContainer.style.display = "none";
        }
    }
    
    // 第四阶段：整合所有数据
    function integrateAllData() {
        try {
            progressContainer.style.display = "block";
            updateProgress(0, "开始整合所有数据...");
            
            // 使用筛选后的期刊（如果有），否则使用全部期刊
            const journalsToProcess = filteredJournals.length > 0 ? filteredJournals : journals;
            
            // 导出整合后的数据
            window.exportService.exportIntegratedData(journalsToProcess);
            
            updateProgress(100, "第四阶段完成：所有数据已整合！");
            setTimeout(() => {
                progressContainer.style.display = "none";
                alert("第四阶段完成！所有数据已整合并导出。");
            }, 300);
        } catch (e) {
            console.error(e);
            alert("整合数据出错：" + e.message);
            progressContainer.style.display = "none";
        }
    }
    
    // 加载期刊数据
    function loadJournalData() {
        progressContainer.style.display = "block";
        updateProgress(0, "加载期刊数据...");
        
        // 初始化映射对象
        window.issnMap = {}; // 期刊名到ISSN的映射
        window.ifMap = {};   // ISSN到影响因子的映射
        window.zkyMap = {};  // ISSN到中科院分区的映射
        window.eIssnMap = {}; // eISSN到影响因子和分区的映射
        window.normalizedIssnMap = {}; // 标准化ISSN的映射
        window.normalizedEIssnMap = {}; // 标准化eISSN的映射
        
        Promise.all([
            // 加载期刊名称到ISSN的映射
            fetch("journal_issn.csv")
                .then(response => response.text())
                .then(csvData => {
                    console.log("成功加载journal_issn.csv");
                    const rows = csvData.split("\n").slice(1); // 跳过标题行
                    rows.forEach(row => {
                        if (!row.trim()) return;
                        
                        // 改进CSV解析，正确处理带引号的字段
                        let parts = [];
                        let inQuotes = false;
                        let currentField = '';
                        
                        for (let i = 0; i < row.length; i++) {
                            const char = row[i];
                            
                            if (char === '"') {
                                inQuotes = !inQuotes;
                            } else if (char === ',' && !inQuotes) {
                                parts.push(currentField);
                                currentField = '';
                            } else {
                                currentField += char;
                            }
                        }
                        
                        // 添加最后一个字段
                        parts.push(currentField);
                        
                        // 处理字段，移除可能残留的引号
                        parts = parts.map(part => part.replace(/^"|"$/g, '').trim());
                        
                        if (parts.length >= 3) {
                            const title = parts[0];
                            const issn = parts[2];
                            if (title && issn) {
                                window.issnMap[title] = issn;
                                // 为调试目的打印Lancet的匹配
                                if (title.includes("Lancet")) {
                                    console.log(`添加期刊映射: "${title}" -> ${issn}`);
                                }
                            }
                        }
                    });
                    console.log(`加载了 ${Object.keys(window.issnMap).length} 个期刊到ISSN的映射`);
                })
                .catch(error => {
                    console.error("加载journal_issn.csv出错:", error);
                }),
            
            // 2. 加载journal_merged.csv获取ISSN和eISSN到影响因子的映射
            fetch("journal_merged.csv")
                .then(response => response.text())
                .then(csvData => {
                    console.log("成功加载journal_merged.csv");
                    const rows = csvData.split("\n").slice(1); // 跳过标题行
                    
                    rows.forEach(row => {
                        if (!row.trim()) return;
                        
                        // 改进CSV解析，使用与journal_issn.csv相同的解析方法
                        let parts = [];
                        let inQuotes = false;
                        let currentField = '';
                        
                        for (let i = 0; i < row.length; i++) {
                            const char = row[i];
                            
                            if (char === '"') {
                                inQuotes = !inQuotes;
                            } else if (char === ',' && !inQuotes) {
                                parts.push(currentField);
                                currentField = '';
                            } else {
                                currentField += char;
                            }
                        }
                        
                        // 添加最后一个字段
                        parts.push(currentField);
                        
                        // 处理字段，移除可能残留的引号
                        parts = parts.map(part => part.replace(/^"|"$/g, '').trim());
                        
                        if (parts.length >= 6) {
                            const issn = parts[2].trim();
                            const eIssn = parts[3].trim();
                            const impactFactor = parts[4].trim() || "";
                            const zkyQuartile = parts[5] ? parts[5].trim() : "—";
                            
                            // 标准化ISSN格式，移除所有非数字和X字符
                            let normalizedIssn = "";
                            let normalizedEIssn = "";
                            
                            if (issn && issn !== "N/A") {
                                normalizedIssn = issn.replace(/[^0-9X]/g, '');
                                // 建立ISSN到影响因子和分区的映射
                                window.ifMap[issn] = impactFactor;
                                window.zkyMap[issn] = zkyQuartile;
                                
                                // 同样为标准化格式创建映射
                                if (normalizedIssn.length === 8) {
                                    window.ifMap[normalizedIssn] = impactFactor;
                                    window.zkyMap[normalizedIssn] = zkyQuartile;
                                    
                                    // 创建带连字符的格式
                                    const formattedIssn = normalizedIssn.slice(0, 4) + "-" + normalizedIssn.slice(4);
                                    window.ifMap[formattedIssn] = impactFactor;
                                    window.zkyMap[formattedIssn] = zkyQuartile;
                                }
                                
                                // 调试输出JMIR系列期刊
                                if (issn.includes("2369") || issn.includes("JMIR")) {
                                    console.log(`添加ISSN映射: ${issn} -> IF:${impactFactor}, 分区:${zkyQuartile}`);
                                    if (normalizedIssn.length === 8) {
                                        console.log(`添加标准化ISSN映射: ${normalizedIssn} -> IF:${impactFactor}, 分区:${zkyQuartile}`);
                                    }
                                }
                            }
                            
                            // 建立eISSN到影响因子和分区的映射
                            if (eIssn && eIssn !== "N/A") {
                                normalizedEIssn = eIssn.replace(/[^0-9X]/g, '');
                                
                                window.eIssnMap[eIssn] = {
                                    impactFactor: impactFactor,
                                    zkyQuartile: zkyQuartile
                                };
                                
                                // 同样为标准化eISSN格式创建映射
                                if (normalizedEIssn.length === 8) {
                                    window.eIssnMap[normalizedEIssn] = {
                                        impactFactor: impactFactor,
                                        zkyQuartile: zkyQuartile
                                    };
                                    
                                    // 创建带连字符的格式
                                    const formattedEIssn = normalizedEIssn.slice(0, 4) + "-" + normalizedEIssn.slice(4);
                                    window.eIssnMap[formattedEIssn] = {
                                        impactFactor: impactFactor,
                                        zkyQuartile: zkyQuartile
                                    };
                                }
                                
                                // 调试输出JMIR系列期刊
                                if (eIssn.includes("2369") || eIssn.includes("JMIR")) {
                                    console.log(`添加eISSN映射: ${eIssn} -> IF:${impactFactor}, 分区:${zkyQuartile}`);
                                    if (normalizedEIssn.length === 8) {
                                        console.log(`添加标准化eISSN映射: ${normalizedEIssn} -> IF:${impactFactor}, 分区:${zkyQuartile}`);
                                    }
                                }
                            }
                        }
                    });
                    
                    console.log(`加载了 ${Object.keys(window.ifMap).length} 个ISSN到影响因子的映射`);
                    console.log(`加载了 ${Object.keys(window.eIssnMap).length} 个eISSN到影响因子的映射`);
                    
                    updateProgress(100, "期刊数据加载完成！");
                    
                    // 隐藏进度条
                    setTimeout(() => {
                        progressContainer.style.display = "none";
                        console.log("数据加载完成：");
                        console.log(`- 期刊名到ISSN映射：${Object.keys(window.issnMap).length}条`);
                        console.log(`- ISSN到影响因子映射：${Object.keys(window.ifMap).length}条`);
                        console.log(`- eISSN到影响因子映射：${Object.keys(window.eIssnMap).length}条`);
                    }, 500);
                })
                .catch(error => {
                    console.error("加载journal_merged.csv出错:", error);
                    updateProgress(100, "期刊数据加载完成！");
                    progressContainer.style.display = "none";
                    alert("加载期刊数据出错: " + error.message);
                })
        ])
        .then(() => {
            updateProgress(100, "期刊数据加载完成！");
            setTimeout(() => {
                progressContainer.style.display = "none";
                
                // 显示加载结果摘要
                console.log("数据加载完成：");
                console.log(`- 期刊名到ISSN映射：${Object.keys(window.issnMap).length}条`);
                console.log(`- ISSN到影响因子映射：${Object.keys(window.ifMap).length}条`);
                console.log(`- eISSN到影响因子映射：${Object.keys(window.eIssnMap).length}条`);
            }, 300);
        })
        .catch(error => {
            console.error("加载期刊数据出错:", error);
            alert("加载期刊数据出错: " + error.message);
            progressContainer.style.display = "none";
        });
    }

    // 更新进度条
    function updateProgress(percent, message) {
        progressBar.style.width = `${percent}%`;
        statusText.textContent = message;
    }

    // 渲染期刊列表
    function renderJournals(journalsList) {
        journalCount.textContent = journalsList.length;
        
        // 清空列表
        const journalsListElement = document.getElementById('journals-list');
        journalsListElement.innerHTML = "";
        
        // 添加每个期刊
        journalsList.forEach(journal => {
            const card = document.createElement("div");
            card.className = "journal-card";
            
            // 创建基本信息 UI
            let html = `
                <h3>${journal.name}</h3>
                <div class="journal-metrics">
                    <div class="metric">
                        <span class="metric-label">GBD文献</span>
                        <span class="metric-value">${journal.gdbCount}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">ISSN</span>
                        <span class="metric-value">${journal.issn || "—"}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">影响因子</span>
                        <span class="metric-value">${journal.impactFactor}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">中科院分区</span>
                        <span class="metric-value">${journal.zkyQuartile}</span>
                    </div>
                </div>
            `;
            
            // 如果有年发文量数据，添加到卡片
            if (journal.yearlyCounts && Object.keys(journal.yearlyCounts).length > 0) {
                html += `<div class="yearly-counts">
                    <h4>近五年年发文量</h4>
                    <div class="counts-grid">`;
                
                // 按年份排序（最近的年份在前）
                const years = Object.keys(journal.yearlyCounts).sort((a, b) => b - a);
                
                years.forEach(year => {
                    html += `
                        <div class="year-count">
                            <span class="year">${year}</span>
                            <span class="count">${journal.yearlyCounts[year]}</span>
                        </div>
                    `;
                });
                
                html += `</div></div>`;
            }
            
            card.innerHTML = html;
            journalsListElement.appendChild(card);
        });
    }

    // 格式化接受率
    function parseAcceptanceRate(rateStr) {
        if (!rateStr || rateStr === "—") return null;
        const match = rateStr.match(/(\d+(?:\.\d+)?)%/);
        return match ? parseFloat(match[1]) : null;
    }
});

// 从查询参数中获取并设置默认值
function setDefaultFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (query) {
        document.getElementById('keywords').value = query;
    }
}

setDefaultFromQuery(); 