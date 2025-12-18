
// Dashboard integrado aos filtros do base_app.js
// Usa searchResults + filterBySubfolders, mapFile, parseJsonDate e a mesma lógica de status.
// Chart.js 4.x via CDN (mantido).
(function(){
  // ===== Loader Chart.js =====
  function loadChartJS(){
    return new Promise((resolve, reject)=>{
      if(window.Chart){ resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = ()=>resolve();
      s.onerror = ()=>reject(new Error('Falha ao carregar Chart.js'));
      document.head.appendChild(s);
    });
  }

  // ===== UI =====
  function ensureButton(){
    let btn = document.getElementById('btnDashboard');
    if(!btn){
      const toolbar = document.querySelector('.header-group, .toolbar, header, body');
      btn = document.createElement('button');
      btn.id = 'btnDashboard';
      btn.type = 'button';
      btn.textContent = 'Dashboard';
      btn.style.marginLeft = '8px';
      if(toolbar && toolbar.appendChild) toolbar.appendChild(btn);
      else document.body.insertBefore(btn, document.body.firstChild);
    }
    return btn;
  }

  function ensureContainer(){
    let host = document.getElementById('dashboardView');
    if(!host){
      host = document.createElement('section');
      host.id = 'dashboardView';
      host.setAttribute('role','region');
      const listContainer = document.querySelector('.list-container');
      if(listContainer && listContainer.parentNode) listContainer.parentNode.insertBefore(host, listContainer.nextSibling);
      else document.body.appendChild(host);
    }
    return host;
  }

  // ===== Helpers (seguindo base_app.js) =====
  const DIGITS_ONLY = /\D+/g;

  function normalizeRow(row){
    try { return (typeof mapFile==='function') ? mapFile(row) : row; } catch { return row; }
  }
  function getCurrentDataset(){
    const base = Array.isArray(window.searchResults) ? window.searchResults
                : (Array.isArray(window.fileData) ? window.fileData : []);
    return (typeof filterBySubfolders==='function') ? filterBySubfolders(base) : base;
  }
  function extractFromChave(file){
    const f = normalizeRow(file);
    const chaveRaw = (f.chNFe || '').replace(/^NFe/, '');
    const chave = chaveRaw.replace(DIGITS_ONLY, '');
    if(chave.length !== 44) return null;
    const uf   = chave.substring(0,2);
    const aa   = chave.substring(2,4);
    const mm   = chave.substring(4,6);
    const cnpj = chave.substring(6,20);
    return { uf, aa, mm, cnpj, chave };
  }
  function maskCNPJ(cnpj14){
    const d = String(cnpj14).replace(DIGITS_ONLY,'');
    if(d.length !== 14) return '—';
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
  }
  function getStatus(file){
    const f = normalizeRow(file);
    if (f.nNF === 's1') return 'Cancelado';
    if (f.nNF === 's2') return 'Evento';
    if (f.chNFe === 's3') return 'Inutilizado';
    return 'Emissao';
  }

  // ===== Helpers Fase 1 =====
  function getEmissionDate(file){
    const info = extractFromChave(file);
    if(!info) return null;
    const year = 2000 + parseInt(info.aa,10);
    const month = parseInt(info.mm,10);
    if(isNaN(year) || isNaN(month) || month<1 || month>12) return null;
    // Emissão como 1º dia do mês às 00:00:00 (proxy quando só há AAMM)
    return new Date(year, month-1, 1, 0, 0, 0);
  }
  function getModifiedDate(file){
    if (typeof parseJsonDate !== 'function') return null;
    const dt = parseJsonDate(normalizeRow(file).modified_date);
    return (dt && !isNaN(dt.getTime())) ? dt : null;
  }
  function diffDays(a, b){
    if(!a || !b) return null;
    const ms = b.getTime() - a.getTime();
    return Math.round(ms / (1000*60*60*24));
  }
  function getMonthKey(file){
    const info = extractFromChave(file);
    if(info){
      const year = 2000 + parseInt(info.aa,10);
      const month = String(parseInt(info.mm,10)).padStart(2,'0');
      return `${year}-${month}`;
    }
    const dt = getModifiedDate(file);
    if (dt) return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
    return null;
  }

  // ===== Agregadores base =====
  function countStatuses(data){
    const acc = { total:0, Emissao:0, Cancelado:0, Evento:0, Inutilizado:0 };
    data.forEach(r=>{
      const st = getStatus(r);
      acc.total++; acc[st]++;
    });
    return acc;
  }
  function groupByFolder(data){
    const m = new Map();
    data.forEach(r=>{
      const f = normalizeRow(r);
      const parts = String(f.filename||'').split(/[\\\/]+/);
      const folderIndex = parts[0] || '0';
      const base = (typeof folderMap!=='undefined' && folderMap[folderIndex]) ? folderMap[folderIndex] : folderIndex;
      const name = String(base).split(/[\\\/]+/).pop();
      m.set(name, (m.get(name)||0)+1);
    });
    return Array.from(m, ([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
  }
  function groupByCNPJ(data){
    const m = new Map();
    data.forEach(r=>{
      const info = extractFromChave(r);
      const cnpjMasked = info ? maskCNPJ(info.cnpj) : '—';
      if(cnpjMasked !== '—') m.set(cnpjMasked, (m.get(cnpjMasked)||0)+1);
    });
    return Array.from(m, ([cnpj,count])=>({cnpj,count})).sort((a,b)=>b.count-a.count);
  }

  // ===== Agregadores Fase 1 =====
  function aggregateMonthCompare(data){
    const now = new Date();
    const months = [];
    for(let i=0;i<12;i++){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      months.unshift(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
    const emis = new Map(months.map(k=>[k,0]));
    const modf = new Map(months.map(k=>[k,0]));

    data.forEach(r=>{
      const dEm = getEmissionDate(r);
      const dMd = getModifiedDate(r);
      if(dEm){
        const kEm = `${dEm.getFullYear()}-${String(dEm.getMonth()+1).padStart(2,'0')}`;
        if(emis.has(kEm)) emis.set(kEm, emis.get(kEm)+1);
      }
      if(dMd){
        const kMd = `${dMd.getFullYear()}-${String(dMd.getMonth()+1).padStart(2,'0')}`;
        if(modf.has(kMd)) modf.set(kMd, modf.get(kMd)+1);
      }
    });
    return {
      labels: months,
      emissaos: months.map(k=>emis.get(k)||0),
      modifics: months.map(k=>modf.get(k)||0)
    };
  }

  function aggregateLagPareto(data){
    // bins: [0–3], [4–7], [8–14], [15–30], [31–60], [>60]
    const bins = [
      {label:'0–3',  min:0,  max:3},
      {label:'4–7',  min:4,  max:7},
      {label:'8–14', min:8,  max:14},
      {label:'15–30',min:15, max:30},
      {label:'31–60',min:31, max:60},
      {label:'>60',  min:61, max:Infinity}
    ];
    const counts = new Array(bins.length).fill(0);
    let total = 0;

    data.forEach(r=>{
      const dEm = getEmissionDate(r);
      const dMd = getModifiedDate(r);
      const lag = diffDays(dEm, dMd);
      if(lag===null || lag<0) return; // ignora anomalias (negativas) e nulos
      total++;
      const idx = bins.findIndex(b => lag>=b.min && lag<=b.max);
      if(idx>=0) counts[idx]++;
    });

    // cumulativa (%)
    const cum = [];
    let running = 0;
    for(let i=0;i<counts.length;i++){
      running += counts[i];
      cum.push(total>0 ? Math.round((running/total)*100) : 0);
    }
    return {
      labels: bins.map(b=>b.label),
      counts,
      cumulative: cum
    };
  }

  function aggregateLagByCNPJ(data){
    // métricas por CNPJ: qtdDocs, lagMedio, p95, pct>30
    const m = new Map(); // key: masked CNPJ -> {lags:[]}
    data.forEach(r=>{
      const info = extractFromChave(r);
      if(!info) return;
      const cnpjMasked = maskCNPJ(info.cnpj);
      const dEm = getEmissionDate(r);
      const dMd = getModifiedDate(r);
      const lag = diffDays(dEm, dMd);
      if(lag===null || lag<0) return;
      const rec = m.get(cnpjMasked) || {lags:[]};
      rec.lags.push(lag);
      m.set(cnpjMasked, rec);
    });

    const stats = [];
    m.forEach((rec, cnpj)=>{
      const arr = rec.lags.sort((a,b)=>a-b);
      const n = arr.length;
      if(n===0) return;
      const avg = Math.round(arr.reduce((a,b)=>a+b,0) / n);
      const p95 = arr[Math.max(0, Math.ceil(0.95*n)-1)];
      const pct30 = Math.round((arr.filter(x=>x>30).length / n) * 100);
      stats.push({cnpj, qtdDocs:n, lagMedio:avg, p95, pct30});
    });
    stats.sort((a,b)=> (b.pct30 - a.pct30) || (b.p95 - a.p95) || (b.qtdDocs - a.qtdDocs));
    return stats.slice(0, 10);
  }

  // ===== Controle de instâncias de gráfico =====
  function destroyCharts(){
    const registry = window.__dashCharts || [];
    registry.forEach(ch=>{ try{ ch.destroy(); }catch(e){} });
    window.__dashCharts = [];
  }
  function registerChart(ch){
    if(!window.__dashCharts) window.__dashCharts = [];
    window.__dashCharts.push(ch);
  }

  // ===== Estado do botão (toggle) =====
  function setDashboardButtonState(active) {
    const btn = ensureButton();
    const label = active ? 'Voltar para a lista' : 'Dashboard';
    btn.textContent = label;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.dataset.mode = active ? 'back' : 'open';
    btn.classList.toggle('is-dashboard-open', !!active);
  }
  

// ===== Mostrar/ocultar botões da barra (Exportar CSV e Toggle Sort) =====
function toggleToolbarButtons(visible) {
  // Seletores conforme HTML
  const exportBtn   = document.getElementById('exportCsv');   // botão Exportar CSV
  const sortBtn     = document.getElementById('toggleSort');  // botão Mais novos / ordenação
  const filtersBtn  = document.getElementById('btnFilters');  // botão Filtros
  const accessKeyEl = document.getElementById('accessKey');   // campo de busca
  const fileCounter = document.getElementById('fileCounter'); // contador "Exibindo X arquivos"

  const targets = [exportBtn, sortBtn, filtersBtn, accessKeyEl, fileCounter].filter(Boolean);
  if (targets.length === 0) return; // nada a fazer se não achou

  targets.forEach((el) => {
    // Visibilidade visual
    el.style.display = visible ? '' : 'none';

    // Acessibilidade: não expor e não permitir foco quando oculto
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');

    if (!visible) {
      // guarda tabindex anterior e remove do foco
      el.dataset._prevTabIndex = String(el.tabIndex);
      el.tabIndex = -1;

      // Desabilita se for <button> (evita cliques por scripts)
      if ('disabled' in el) el.disabled = true;
    } else {
      // restaura tabindex anterior (se existir), senão usa 0
      if (el.dataset._prevTabIndex !== undefined) {
        const prev = parseInt(el.dataset._prevTabIndex, 10);
        el.tabIndex = Number.isNaN(prev) ? 0 : prev;
        delete el.dataset._prevTabIndex;
      } else {
        el.tabIndex = 0;
      }
      if ('disabled' in el) el.disabled = false;
    }
  });
}


  // ===== Render =====
  async function renderDashboard(){
    const view = ensureContainer();
    view.classList.add('active');
    setDashboardButtonState(true);
	toggleToolbarButtons(false);

    const data = getCurrentDataset();

    const st        = countStatuses(data);
    const monthCmp  = aggregateMonthCompare(data);
    const lagPareto = aggregateLagPareto(data);
    const topLag    = aggregateLagByCNPJ(data);
    const byFolder  = groupByFolder(data).slice(0,10);
    const byCNPJ    = groupByCNPJ(data).slice(0,10);



	const html = `
	  <link rel="stylesheet" href="dashboard.css">
	  <div id="dashboardHeader">
		<div>
		  <h2>Dashboard de Documentos</h2>
		  <span class="subtitle">Visão geral por pasta, status, mês/ano e CNPJ (de acordo com as pastas selecionadas)</span>
		</div>
	  </div>

	  <div class="kpi-grid">
		<div class="kpi total"><span>Total de documentos</span><strong>${st.total}</strong></div>
		<div class="kpi emissao"><span>Status: Emissão</span><strong>${st.Emissao}</strong></div>
		<div class="kpi cancelado"><span>Status: Cancelado</span><strong>${st.Cancelado}</strong></div>
		<div class="kpi evento"><span>Status: Evento</span><strong>${st.Evento}</strong></div>
		<div class="kpi inutilizado"><span>Status: Inutilizado</span><strong>${st.Inutilizado}</strong></div>
	  </div>

	  <!-- 1ª linha: Donut + Emissão × Modificação -->
	  <div class="grid-2">
		<div class="card donut">
		  <header><h3>Distribuição por status</h3></header>
		  <div class="chart-box donut-box">
			<div class="chart-canvas-wrap">
			  <canvas id="chartStatus" aria-label="Distribuição por status"></canvas>
			</div>
			<div class="legend-box" id="legendStatus" aria-label="Legenda de distribuição por status"></div>
		  </div>
		</div>

		<div class="card month-compare">
		  <header><h3>Emissão × Modificação (últimos 12 meses)</h3></header>
		  <div class="chart-box month-compare-box">
			<canvas id="chartMonthCompare" aria-label="Emissão × Modificação"></canvas>
		  </div>
		</div>
	  </div>

	  <!-- 2ª linha: Por pasta + Top CNPJs -->
	  <div class="grid-2">
		<div class="card folder">
		  <header><h3>Por pasta</h3></header>
		  <div class="chart-box folder-box">
			<canvas id="chartFolder" aria-label="Documentos por pasta"></canvas>
		  </div>
		</div>

		<div class="card cnpjs">
		  <header><h3>Top CNPJs</h3></header>
		  <div class="chart-box cnpjs-box">
			<canvas id="chartCNPJ" aria-label="Top CNPJs"></canvas>
		  </div>
		</div>
	  </div>

	  <!-- 3ª linha (unificada): Pareto + Top CNPJs por atraso -->
	  <div class="grid-2">
		<div class="card lag-pareto">
		  <header><h3>Pareto de atraso (dias)</h3></header>
		  <div class="chart-box lag-pareto-box">
			<canvas id="chartLagPareto" aria-label="Pareto de atraso"></canvas>
		  </div>
		</div>

		<div class="card top-lag">
		  <header><h3>Top CNPJs por atraso</h3></header>
		  <div class="chart-box top-lag-box">
			<table id="tableTopLag" aria-label="Top CNPJs por atraso">
			  <thead>
				<tr>
				  <th>CNPJ</th>
				  <th>Qtd</th>
				  <th>Lag médio (dias)</th>
				  <th>P95 (dias)</th>
				  <th>% > 30d</th>
				</tr>
			  </thead>
			  <tbody></tbody>
			</table>
		  </div>
		   </div>
	  </div>
	`;
	view.innerHTML = html;

    // Esconde a lista enquanto o dash está ativo
    const listContainer = document.querySelector('.list-container') || document.querySelector('.list-scroll');
    if(listContainer) listContainer.style.display = 'none';

    // Chart.js
    try { await loadChartJS(); } catch(e){ console.error(e); return; }
    destroyCharts();

    // Paleta alinhada às flags do style.css
    const flags = {
      emissao:      '#16a34a', // verde
      cancelado:    '#c0392b', // vermelho
      evento:       '#2471a3', // azul
      inutilizado:  '#d35400', // laranja
      accentBlue:   '#005a9e', // azul forte para gráficos adicionais
      accentOrange: '#f59e0b'  // laranja UI (se precisar)
    };

	// ===== Donut Status com legenda HTML e visual para itens ocultos
	const statusOrder = ['Emissao', 'Cancelado', 'Evento', 'Inutilizado'];
	const statusCounts = statusOrder.map(k => st[k] ?? 0);
	const statusColors = [flags.emissao, flags.cancelado, flags.evento, flags.inutilizado];
	const nf = new Intl.NumberFormat('pt-BR');

	// Plugin de legenda HTML com estilo/estado "oculto" e porcentagens dinâmicas
	const htmlLegendPlugin = {
	  id: 'htmlLegend',
	  afterUpdate(chart, args, opts) {
		const container = document.getElementById(opts.containerID);
		if (!container) return;

		while (container.firstChild) container.firstChild.remove();

		const ul = document.createElement('ul');
		ul.setAttribute('role', 'list');
		ul.className = 'legend-list';

		const labels = chart.data.labels ?? [];
		const dataset = chart.data.datasets[0];

		const totalVisible = dataset.data.reduce((sum, v, idx) =>
		  chart.getDataVisibility(idx) ? sum + (v || 0) : sum, 0);

		let clickLock = false;
		const safeUpdate = () => {
		  if (clickLock) return;
		  clickLock = true;
		  chart.update('none');           // sem animação = sem tremor
		  setTimeout(() => { clickLock = false; }, 50);
		};

		labels.forEach((label, i) => {
		  const li = document.createElement('li');
		  li.className = 'legend-item';
		  li.setAttribute('role', 'button');
		  li.setAttribute('tabindex', '0');

		  const isVisible = chart.getDataVisibility(i);
		  const isHidden = !isVisible;

		  const dot = document.createElement('span');
		  dot.className = 'legend-dot';
		  dot.style.background = dataset.backgroundColor[i];

		  const nice = label === 'Emissao' ? 'Emissão' : label;
		  const value = dataset.data[i] ?? 0;
		  const pct = totalVisible ? Math.round((value / totalVisible) * 100) : 0;

		  const text = document.createElement('span');
		  text.className = 'legend-text';
		  text.textContent = `${nice} — ${nf.format(value)} (${pct}%)`;

		  if (isHidden) {
			li.classList.add('is-hidden');
			text.style.textDecoration = 'line-through';
		  }
		  li.setAttribute('aria-pressed', String(isVisible));

		  const toggle = () => { chart.toggleDataVisibility(i); safeUpdate(); };
		  li.addEventListener('click', toggle);
		  li.addEventListener('keydown', (ev) => {
			if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); }
		  });

		  li.appendChild(dot);
		  li.appendChild(text);
		  ul.appendChild(li);
		});

		container.appendChild(ul);
	  }
	};


	// Instanciação do gráfico de status (mantendo sua configuração original)
	const chartStatus = new Chart(view.querySelector('#chartStatus'), {
	  type: 'doughnut',
	  data: {
		labels: statusOrder,
		datasets: [{
		  data: statusCounts,
		  backgroundColor: statusColors,
		  borderWidth: 0,
		  borderRadius: 6,
		  hoverOffset: 6
		}]
	  },
	  options: {
		responsive: true,
		maintainAspectRatio: false,   // importante p/ altura controlada via CSS
		resizeDelay: 200,             // debouncing do resize
		interaction: { mode: 'nearest', intersect: false },
		transitions: { resize: { animation: { duration: 0 } } },
		plugins: {
		  legend: { display: false },
		  tooltip: {
			callbacks: {
			  label(ctx) {
				const v = ctx.parsed ?? 0;
				const nm = ctx.label === 'Emissao' ? 'Emissão' : ctx.label;
				const ds = ctx.chart.data.datasets[0];
				const totalVisible = ds.data.reduce((sum, val, idx) =>
				  ctx.chart.getDataVisibility(idx) ? sum + (val || 0) : sum, 0);
				const pct = totalVisible ? Math.round((v / totalVisible) * 100) : 0;
				return `${nm}: ${nf.format(v)} (${pct}%)`;
			  }
			}
		  },
		  htmlLegend: { containerID: 'legendStatus' }
		},
		cutout: '62%',
		spacing: 2,
		rotation: -90
	  },
	  plugins: [htmlLegendPlugin]
	});
    registerChart(chartStatus);

    // ===== Emissão × Modificação (últimos 12 meses) — barras comparativas
    const chartMonthCompare = new Chart(view.querySelector('#chartMonthCompare'), {
      type: 'bar',
      data: {
        labels: monthCmp.labels,
        datasets: [
          { label: 'Emissão',     data: monthCmp.emissaos,  backgroundColor: flags.emissao },
          { label: 'Modificação', data: monthCmp.modifics,  backgroundColor: flags.accentBlue }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: '#eef2f7' } }
        }
      }
    });
    registerChart(chartMonthCompare);

    // ===== Pareto de atraso (barras + linha cumulativa)
    const chartLagPareto = new Chart(view.querySelector('#chartLagPareto'), {
      type: 'bar',
      data: {
        labels: lagPareto.labels,
        datasets: [
          { type: 'bar',  label: 'Qtd', data: lagPareto.counts, backgroundColor: flags.cancelado, yAxisID: 'y' },
          { type: 'line', label: 'Cumulativa (%)', data: lagPareto.cumulative, borderColor: flags.accentBlue, backgroundColor: flags.accentBlue, yAxisID: 'yr', tension: 0.25, fill: false }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y:  { beginAtZero: true, grid: { color: '#eef2f7' } },
          yr: { beginAtZero: true, grid: { display: false }, min: 0, max: 100, ticks: { callback: (v)=> `${v}%` } }
        }
      }
    });
    registerChart(chartLagPareto);

    // ===== Tabela Top CNPJs por atraso
    const tbody = view.querySelector('#tableTopLag tbody');
    const nfInt = new Intl.NumberFormat('pt-BR');
    const nfPct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
    tbody.innerHTML = topLag.map(row => `
      <tr>
        <td>${row.cnpj}</td>
        <td>${nfInt.format(row.qtdDocs)}</td>
        <td>${nfInt.format(row.lagMedio)}</td>
        <td>${nfInt.format(row.p95)}</td>
        <td>${nfPct.format(row.pct30)}%</td>
      </tr>
    `).join('');

    // ===== Barras por pasta (Top 10)
    const chartFolder = new Chart(view.querySelector('#chartFolder'), {
      type: 'bar',
      data: {
        labels: byFolder.map(x=>x.name),
        datasets: [{ label: 'Docs', data: byFolder.map(x=>x.count), backgroundColor: flags.accentBlue }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#eef2f7' } },
          y: { grid: { display: false } }
        }
      }
    });
    registerChart(chartFolder);

    // ===== Barras Top CNPJs (Top 10)
    const chartCNPJ = new Chart(view.querySelector('#chartCNPJ'), {
      type: 'bar',
      data: {
        labels: byCNPJ.map(x=>x.cnpj),
        datasets: [{ label: 'Docs', data: byCNPJ.map(x=>x.count), backgroundColor: flags.evento }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#eef2f7' } },
          y: { grid: { display: false } }
        }
      }
    });
    registerChart(chartCNPJ);

    // ===== Re-render automático quando filtros/subpastas mudarem
    document.getElementById('applyFilters')?.addEventListener('click', ()=> setTimeout(renderDashboard, 0));
    document.addEventListener('click', (e)=>{
      const target = e.target;
      if (target && target.closest('.subfolders span')) {
        setTimeout(()=>{ if (document.getElementById('dashboardView')?.classList.contains('active')) renderDashboard(); }, 0);
      }
    });
  }

  function hideDashboard(){
    destroyCharts();
    const view = document.getElementById('dashboardView');
    if(view){ view.classList.remove('active'); view.innerHTML = ''; }
    const listContainer = document.querySelector('.list-container') || document.querySelector('.list-scroll');
    if(listContainer) listContainer.style.display = '';
    setDashboardButtonState(false);
	toggleToolbarButtons(true);
  }

  // ===== Wiring (toggle único no botão Dashboard) =====
  function wire() {
    const btn = ensureButton();
    if (!btn.dataset._wired) {
      btn.addEventListener('click', () => {
        const view = document.getElementById('dashboardView');
        const isActive = !!(view && view.classList.contains('active'));
        if (isActive) hideDashboard(); else renderDashboard();
      });
      btn.dataset._wired = '1';
    }
  }
document.addEventListener('DOMContentLoaded', wire);
})();