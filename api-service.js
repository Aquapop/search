// api-service.js — 带分页 + 自动重试 + 进度回调 + CORS处理
// 浏览器原生 fetch，零后端。适合纯前端项目。

class ApiService {
  constructor({ email = "example@example.com", apiKey = "" } = {}) {
    this.base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
    this.email = email;
    this.apiKey = apiKey; // 可留空；有 key 时速率上限更高
    
    // 当前环境检测
    this.isLocalServer = window.location.protocol === 'http:' && 
                        (window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1');
                         
    // CORS代理配置
    this.corsProxies = [
      "https://corsproxy.io/?",
      "https://cors-anywhere.herokuapp.com/",
      "https://api.allorigins.win/raw?url="
    ];
    
    this.currentProxyIndex = 0; // 默认使用第一个代理
    
    console.log(`运行环境: ${this.isLocalServer ? '本地服务器' : '直接打开HTML'}`);
  }

  // 小工具：延迟
  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
  
  // 获取当前使用的代理URL
  _getCurrentProxy() {
    return this.corsProxies[this.currentProxyIndex];
  }
  
  // 切换到下一个代理
  _switchToNextProxy() {
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.corsProxies.length;
    console.log(`切换到代理: ${this._getCurrentProxy()}`);
    return this._getCurrentProxy();
  }

  // 小工具：fetch + 重试 + CORS处理
  async _fetchWithRetry(url, opts = {}, retries = 3) {
    try {
      let finalUrl = url;
      let finalOpts = {...opts};
      
      // 如果不是本地服务器环境，需要使用CORS代理
      if (!this.isLocalServer) {
        finalUrl = this._getCurrentProxy() + encodeURIComponent(url);
      }
      
      const res = await fetch(finalUrl, finalOpts);
      
      if (res.ok) return res;
      
      // 当遇到CORS问题时，尝试切换代理
      if (res.status === 0 || res.type === 'opaque') {
        if (retries > 0 && !this.isLocalServer) {
          console.log('CORS问题，尝试切换代理...');
          this._switchToNextProxy();
          await this._sleep(300);
          return this._fetchWithRetry(url, opts, retries - 1);
        }
      }
      
      // 当429(限流)或5xx时可重试
      if (retries > 0 && (res.status === 429 || res.status >= 500)) {
        console.log(`服务器错误 ${res.status}，${retries}秒后重试...`);
        await this._sleep(1000); // 等待时间延长
        return this._fetchWithRetry(url, opts, retries - 1);
      }
      
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (retries === 0) throw err;
      
      console.log(`请求出错: ${err.message}，${retries}秒后重试...`);
      await this._sleep(1000);
      
      // 如果出错且不是本地服务器环境，尝试切换代理
      if (!this.isLocalServer) {
        this._switchToNextProxy();
      }
      
      return this._fetchWithRetry(url, opts, retries - 1);
    }
  }

  // 子函数：单次 esearch
  async _esearch(term, retMax = 1000, retStart = 0) {
    const params = new URLSearchParams({
      db: "pubmed",
      term,
      retmode: "json",
      retmax: retMax,
      retstart: retStart,
      email: this.email
    });
    if (this.apiKey) params.append("api_key", this.apiKey);

    const url = `${this.base}esearch.fcgi?${params.toString()}`;
    const res = await this._fetchWithRetry(url);
    const json = await res.json();

    const count = Number(json.esearchresult.count);
    const ids = json.esearchresult.idlist || [];
    return { count, ids };
  }

  /**
   * 分页拿全部 PMID
   * @param {string} term - 检索式
   * @param {function} onProgress - 回调(percent) (可选)
   */
  async searchPubmedAll(term, onProgress = null) {
    // Step1: 先拿总数
    const { count: total } = await this._esearch(term, 0, 0);
    const batch = 1000; // 一次拿多少篇
    let allIds = [];
    for (let start = 0; start < total; start += batch) {
      const { ids } = await this._esearch(term, batch, start);
      allIds.push(...ids);

      // 进度回调
      if (onProgress) {
        const percent = Math.min(100, Math.round((start + batch) / total * 100));
        onProgress(percent, `已获取${allIds.length}篇 / 总共${total}篇`);
      }
      // 等一下，防止被限流
      await this._sleep(120);
    }
    return allIds; // 所有 PMID
  }

  /**
   * 用 esummary 获取每篇文献的期刊名，并统计期刊出现次数
   * @param {string[]} pmids
   * @param {function} onProgress - 回调(percent)
   * @returns [{name, count}, ...]
   */
  async fetchJournals(pmids, onProgress = null) {
    const chunkSize = 200;
    const journals = {};

    for (let i = 0; i < pmids.length; i += chunkSize) {
      const slice = pmids.slice(i, i + chunkSize);

      const params = new URLSearchParams({
        db: "pubmed",
        id: slice.join(","),
        retmode: "json",
        email: this.email
      });
      if (this.apiKey) params.append("api_key", this.apiKey);

      const url = `${this.base}esummary.fcgi?${params.toString()}`;
      
      try {
        const res = await this._fetchWithRetry(url);
        const json = await res.json();
  
        Object.keys(json.result)
          .filter(k => k !== "uids")
          .forEach(k => {
            const rec = json.result[k];
            // 优先使用 fulljournalname，但如果不存在则尝试使用 source
            let jname = "";
            if (rec.fulljournalname) {
              jname = rec.fulljournalname.trim();
            } else if (rec.source) {
              jname = rec.source.trim();
            }
            
            if (jname) {
              // 清理期刊名称中的特殊字符和多余空格
              jname = jname.replace(/\s+/g, ' ').trim();
              journals[jname] = (journals[jname] || 0) + 1;
            }
          });
      } catch (err) {
        console.error(`获取期刊信息出错: ${err.message}，继续获取下一批...`);
      }

      if (onProgress) {
        const percent = Math.round(((i + chunkSize) / pmids.length) * 100);
        onProgress(percent, `已处理 ${Math.min(i + chunkSize, pmids.length)}/${pmids.length} 篇`);
      }
      // 再次等一下
      await this._sleep(120);
    }

    // 转为数组 & 按出现次数排序
    return Object.entries(journals)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 获取指定期刊某年的发文量
   * @param {string} journal 期刊名称
   * @param {number} year 年份
   * @returns {Promise<number>} 发文量
   */
  async getYearCount(journal, year) {
    const term = `"${journal}"[Journal] AND ${year}[pdat]`;
    
    try {
      const { count } = await this._esearch(term, 0, 0);
      return count;
    } catch (err) {
      console.error(`获取 ${journal} ${year}年发文量失败:`, err);
      return 0;
    }
  }
  
  /**
   * 获取指定ISSN期刊某年的发文量
   * @param {string} issn 期刊ISSN
   * @param {number} year 年份
   * @returns {Promise<number>} 发文量
   */
  async getYearCountByISSN(issn, year) {
    const term = `${issn}[issn] AND ${year}[pdat]`;
    
    try {
      const { count } = await this._esearch(term, 0, 0);
      return count;
    } catch (err) {
      console.error(`获取 ISSN:${issn} ${year}年发文量失败:`, err);
      return 0;
    }
  }

  /**
   * 获取最近5年的发文量
   * @param {string} journal 期刊名称
   * @returns {Promise<Object>} {年份: 发文量}
   */
  async getRecent5yCounts(journal) {
    // 获取当前年份
    const currentYear = new Date().getFullYear();
    const result = {};
    
    // 获取最近5年
    for (let year = currentYear - 5; year < currentYear; year++) {
      result[year] = await this.getYearCount(journal, year);
    }
    
    return result;
  }
  
  /**
   * 通过ISSN获取最近5年的发文量
   * @param {string} issn 期刊ISSN
   * @returns {Promise<Object>} {年份: 发文量}
   */
  async getRecent5yCountsByISSN(issn) {
    // 获取当前年份
    const currentYear = new Date().getFullYear();
    const result = {};
    
    // 获取最近5年
    for (let year = currentYear - 5; year < currentYear; year++) {
      result[year] = await this.getYearCountByISSN(issn, year);
    }
    
    return result;
  }

  /**
   * 查询得到PMID和期刊名的详细映射关系
   * @param {string[]} pmids
   * @param {function} onProgress - 回调(percent)
   * @returns [{pmid, journalName}, ...]  详细映射关系
   */
  async fetchPMIDJournalMapping(pmids, onProgress = null) {
    const chunkSize = 200;
    const mappings = [];

    for (let i = 0; i < pmids.length; i += chunkSize) {
      const slice = pmids.slice(i, i + chunkSize);

      const params = new URLSearchParams({
        db: "pubmed",
        id: slice.join(","),
        retmode: "json",
        email: this.email
      });
      if (this.apiKey) params.append("api_key", this.apiKey);

      const url = `${this.base}esummary.fcgi?${params.toString()}`;
      
      try {
        const res = await this._fetchWithRetry(url);
        const json = await res.json();
  
        Object.keys(json.result)
          .filter(k => k !== "uids")
          .forEach(k => {
            const rec = json.result[k];
            
            // 优先使用 fulljournalname，但如果不存在则尝试使用 source
            let jname = "";
            if (rec.fulljournalname) {
              jname = rec.fulljournalname.trim();
            } else if (rec.source) {
              jname = rec.source.trim();
            }
            
            if (jname) {
              // 清理期刊名称中的特殊字符和多余空格
              jname = jname.replace(/\s+/g, ' ').trim();
              
              // 添加PMID和期刊名的映射
              mappings.push({
                pmid: k,
                journalName: jname
              });
            }
          });
      } catch (err) {
        console.error(`获取期刊信息出错: ${err.message}，继续获取下一批...`);
      }

      if (onProgress) {
        const percent = Math.round(((i + chunkSize) / pmids.length) * 100);
        onProgress(percent, `已处理 ${Math.min(i + chunkSize, pmids.length)}/${pmids.length} 篇`);
      }
      // 再次等一下
      await this._sleep(120);
    }

    return mappings;
  }
}

// 挂到全局
window.apiService = new ApiService({ email: "your@mail.com" }); 