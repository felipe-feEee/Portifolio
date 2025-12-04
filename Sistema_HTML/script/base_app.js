const listContainer = document.querySelector('.list-container');
const headerGroup = document.querySelector('.header-group');
let itemsPerPage = 100;
let currentPage = 1;
let displayedFiles = [];
let isSearching = false;
let searchResults = fileData;
let sortDescending = true;
let sortMode = 'date'; // 'date' ou 'nNF'


// Mapa de legendas para facilitar leitura
const fieldMap = {
  1: "filename",
  2: "modified_date",
  3: "serie",
  4: "nNF",
  5: "chNFe"
};

const statusMap = {
  s1: "CANCELADO",
  s2: "EVENTO",
  s3: "INUTILIZADO"
};

const ufMap = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF"
};

// Converte um objeto minificado para um objeto com nomes legíveis
function mapFile(file) {
  return {
    filename: file["1"],
    modified_date: file["2"],
    serie: typeof file["3"] === "number" ? statusMap[file["3"]] : file["3"],
    nNF: typeof file["4"] === "number" ? statusMap[file["4"]] : file["4"],
    chNFe: typeof file["5"] === "number" ? statusMap[file["5"]] : file["5"]
  };
}

function parseJsonDate(str) {
  // Exemplo: 20251125T163505
  if (!/^\d{8}T\d{6}$/.test(str)) return null;

  const y = str.slice(0, 4);
  const m = str.slice(4, 6);
  const d = str.slice(6, 8);
  const hh = str.slice(9, 11);
  const mm = str.slice(11, 13);
  const ss = str.slice(13, 15);

  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
}

function formatDisplayDate(dt) {
  if (!(dt instanceof Date) || isNaN(dt.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} `
       + `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

let selectedFolders = []; // índices (strings) das subpastas ativas

// Aplica filtro por subpastas sobre um array de dados minificados
function filterBySubfolders(data) {
  if (selectedFolders.length === 0) return data;

  return data.filter(f => {
    const file = mapFile(f);
    const folderIndex = file.filename.split(/[\\/]+/)[0];
    return selectedFolders.includes(folderIndex);
  });
}

// Formata datas como yyyy-MM-dd HH:mm:ss
function formatForCsv(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
}

// Escapa valores para CSV usando ; como separador
function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[";\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Nome do arquivo de exportação
function buildExportFilename() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `data_export_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
}

// Gera CSV apenas com as colunas na ordem solicitada, sem filename
function generateCsvFromDataFixed(sourceArray) {
  if (!sourceArray || sourceArray.length === 0) return "";

  // Cabeçalhos fixos na ordem solicitada
  const headers = [
    "chNFe",
    "nNF",
    "serie",
    "modified_date",
    "fileNameOnly",
    "folderName",
    "fullPath"
  ];

  const rows = sourceArray.map((f) => {
    const file = mapFile(f) || {};

    // Deriva fileNameOnly, folderBase, folderName e fullPath
    const parts = String(file.filename || "").split(/[\\/]+/);
    const folderIndex = parts[0] || "";
    const fileNameOnly = parts[1] || "";
    const folderBase = folderMap && folderMap[folderIndex] ? folderMap[folderIndex] : "";
    const folderName = folderBase ? folderBase.split(/[\\/]+/).pop() : "";
    const fullPath = folderBase && fileNameOnly ? (folderBase + "\\" + fileNameOnly) : (file.filename || "");

    // Monta a linha respeitando a ordem dos headers
    const values = headers.map((h) => {
      let val;

      switch (h) {
        case "chNFe":
          val = file.chNFe;
          break;
        case "nNF":
          val = file.nNF;
          break;
        case "serie":
          val = file.serie;
          break;
        case "modified_date":
          val = formatForCsv(parseJsonDate(file.modified_date));
          break;
        case "fileNameOnly":
          val = fileNameOnly;
          break;
        case "folderName":
          val = folderName;
          break;
        case "fullPath":
          val = fullPath;
          break;
      }

      // Tradução de status s1/s2/s3 para os campos que possam recebê-los
      if (typeof val === "string" && statusMap[val]) {
        val = statusMap[val];
      }

      return csvEscape(val);
    });

    return values.join(";");
  });

  const headerLine = headers.join(";");
  return [headerLine, ...rows].join("\n");
}

// Dispara download
function triggerCsvDownload(csvContent) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildExportFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Exporta os resultados filtrados respeitando a ordenação atual
function handleExport() {
  const base = searchResults;
  const filtered = filterBySubfolders(base);

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'nNF') {
      const na = parseInt(mapFile(a).nNF, 10);
      const nb = parseInt(mapFile(b).nNF, 10);
      const va = isNaN(na) ? Number.MIN_SAFE_INTEGER : na;
      const vb = isNaN(nb) ? Number.MIN_SAFE_INTEGER : nb;
      return sortDescending ? (vb - va) : (va - vb);
    } else {
      const da = parseJsonDate(mapFile(a).modified_date);
      const db = parseJsonDate(mapFile(b).modified_date);
      const va = da ? da.getTime() : 0;
      const vb = db ? db.getTime() : 0;
      return sortDescending ? (vb - va) : (va - vb);
    }
  });

  const csv = generateCsvFromDataFixed(sorted);
  triggerCsvDownload(csv);
}

// Bind do botão (já existente no seu index)
document.addEventListener("DOMContentLoaded", () => {
  const btnExport = document.getElementById("exportCsv");
  if (btnExport) btnExport.addEventListener("click", handleExport);
});

function loadMoreFiles() {
  const base = searchResults;
  const filtered = filterBySubfolders(base);

  // aplica ordenação ANTES de cortar
  const sorted = [...filtered].sort((a, b) => {
    const da = parseJsonDate(mapFile(a).modified_date);
    const db = parseJsonDate(mapFile(b).modified_date);
    return sortDescending ? (db.getTime() - da.getTime()) : (da.getTime() - db.getTime());
  });

  const start = itemsPerPage * (currentPage - 1);
  const end = itemsPerPage * currentPage;
  const nextData = sorted.slice(start, end);

  displayedFiles = displayedFiles.concat(nextData);
  displayFiles(nextData, true);
  currentPage++;
}

function displayFiles(data, append = false) {
  const list = document.getElementById('fileList');
  const counter = document.getElementById('fileCounter');

  // 🔎 Ordena conforme o modo atual
  if (sortMode === 'date') {
    data.sort((a, b) => {
      const da = parseJsonDate(mapFile(a).modified_date);
      const db = parseJsonDate(mapFile(b).modified_date);
      const va = da ? da.getTime() : 0;
      const vb = db ? db.getTime() : 0;
      return sortDescending ? (vb - va) : (va - vb);
    });
  } else if (sortMode === 'nNF') {
    data.sort((a, b) => {
      const na = parseInt(mapFile(a).nNF, 10);
      const nb = parseInt(mapFile(b).nNF, 10);
      const va = isNaN(na) ? Number.MIN_SAFE_INTEGER : na;
      const vb = isNaN(nb) ? Number.MIN_SAFE_INTEGER : nb;
      return sortDescending ? (vb - va) : (va - vb);
    });
  }

  if (!append) {
    list.innerHTML = '';
    displayedFiles = data.slice();
  }

  const now = new Date();

  data.forEach(f => {
    const file = mapFile(f);
    const li = document.createElement('li');

    // 🔎 Topo do card
    const infoTop = document.createElement('span');
    infoTop.className = 'info-top';

    if (file.nNF === "s1") {
      infoTop.textContent = "Cancelado";
    } else if (file.nNF === "s2") {
      infoTop.textContent = "Evento";
    } else {
      infoTop.textContent = `NFe:${file.nNF} Serie:${file.serie}`;
    }

    // 🔎 Parte inferior
    const infoBottom = document.createElement('span');
    infoBottom.className = 'info-bottom';

    const parts = file.filename.split(/[\\/]+/);
    const folderIndex = parts[0];
    const fileNameOnly = parts[1];

    let folderName;
    if (folderIndex === "0") {
      folderName = folderMap["0"].split(/[\\/]+/).pop();
    } else {
      folderName = folderMap[folderIndex].split(/[\\/]+/).pop();
    }

    const fileDate = parseJsonDate(file.modified_date);
    const displayDate = formatDisplayDate(fileDate);

    infoBottom.innerHTML = `${fileNameOnly}<br>Pasta: ${folderName}<br>Modificado: ${displayDate}`;

    li.appendChild(infoTop);
    li.appendChild(infoBottom);

    // ✅ Validação de idade
    const diffDays = fileDate ? Math.floor((now - fileDate) / (1000 * 60 * 60 * 24)) : Infinity;

    if (diffDays > 21) {
      const chaveDiv = document.createElement('div');
      chaveDiv.className = 'chave-acesso';
      chaveDiv.textContent = `Chave NFe: ${file.chNFe}`;
      li.appendChild(chaveDiv);
      li.classList.add('old-file');
    } else {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'actions';

      const fullPath = folderMap[folderIndex] + "\\" + fileNameOnly;

      const openLink = document.createElement('a');
      openLink.href = fullPath;
      openLink.textContent = 'Abrir XML';
      openLink.target = '_blank';

      const copyLink = document.createElement('a');
      copyLink.href = '#';
      copyLink.textContent = 'Copiar caminho';
      copyLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(fullPath).then(() => {
          copyLink.textContent = 'Copiado';
          setTimeout(() => {
            copyLink.textContent = 'Copiar caminho';
          }, 2000);
        }).catch(err => {
          console.error('Erro ao copiar:', err);
        });
      });

      actionsDiv.appendChild(openLink);
      actionsDiv.appendChild(copyLink);
      li.appendChild(actionsDiv);
    }

    // ✅ Diferenciação visual por status
    if (file.chNFe === "s3") {
      li.classList.add('inutilizacao');
    }
    if (file.nNF === "s1") {
      li.classList.add('cancelado');
    }
    if (file.nNF === "s2") {
      li.classList.add('evento');
    }

    list.appendChild(li);
  });

  // 🔎 Atualiza contador
  const base = searchResults;
  const filtered = filterBySubfolders(base);
  counter.textContent = `Exibindo ${displayedFiles.length} de ${filtered.length} arquivos`;
}

listContainer.addEventListener('scroll', () => {
  const sourceData = searchResults;

  if (listContainer.scrollTop + listContainer.clientHeight >= listContainer.scrollHeight - 10) {
    if (displayedFiles.length < sourceData.length) {
      loadMoreFiles();
    }
  }
});

function normalizeQuery(input) {
  const allNumbers = input.match(/\d+/g);
  if (!allNumbers) return '';

  // Verifica se ha duas sequencias de 44 digitos
  const accessKeys = allNumbers.filter(n => n.length === 44);

  if (accessKeys.length === 2) {
    return `${accessKeys[0]}-${accessKeys[1]}`;
  }

  // Caso nao sejam chaves de acesso, aplica logica anterior
  if (allNumbers.length === 1) {
    return allNumbers[0];
  }

  if (allNumbers.length >= 2) {
    const first = allNumbers[0];
    const second = allNumbers[1] + allNumbers.slice(2).join('');
    return `${first}-${second}`;
  }

  return '';
}

// Funcao de busca
function searchFiles() {
  const searchBox = document.getElementById('accessKey');
  let rawQuery = searchBox.value.trim();
  let query = normalizeQuery(rawQuery);
  let base = fileData;

  isSearching = true;
  currentPage = 1;

  // Flags de controle
  isSearching = true;
  currentPage = 1;

  // Cancelamento
  if (/^canc/i.test(rawQuery)) {
    query = "CANCELADO";
    searchBox.value = query;
    base = fileData.filter(f => f["4"] === "s1");
    sortMode = 'date';
  }

  // Evento
  else if (/^event/i.test(rawQuery)) {
    query = "EVENTO";
    searchBox.value = query;
    base = fileData.filter(f => f["4"] === "s2");
    sortMode = 'date';
  }

  // Inutilização
  else if (/inut/i.test(rawQuery)) {
    query = "INUTILIZADO";
    searchBox.value = query;
    base = fileData.filter(f => f["5"] === "s3");
    sortMode = 'date';
  }

  // Arquivos antigos (modificados há mais de 21 dias)
  else if (/^antigo$/i.test(rawQuery)) {
    const agora = new Date()
    base = fileData.filter(f => {
      const fileDate = parseJsonDate(mapFile(f).modified_date)
      if (!fileDate) return false
      const diffDays = Math.floor((agora - fileDate) / (1000 * 60 * 60 * 24))
      return diffDays > 21
    })
    query = "ANTIGO"
    searchBox.value = query
    sortMode = 'date'
  }

  // Query vazia → reset
  else if (query === "") {
    isSearching = false;
    currentPage = 1;
    base = fileData;
    sortMode = 'date';
  }

  // Intervalo de chave de acesso (duas de 44 dígitos)
  else if (/^(\d{44})-(\d{44})$/.test(query)) {
    const [_, startKey, endKey] = query.match(/^(\d{44})-(\d{44})$/);
    base = fileData.filter(f => {
      const id = mapFile(f).chNFe?.replace(/^NFe/, '');
      return id && id >= startKey && id <= endKey;
    });
    sortMode = 'date';
  }

  // Intervalo de nNF (ex: 20728-20730)
  else if (/^(\d+)\s*-\s*(\d+)$/.test(query)) {
    const [_, start, end] = query.match(/^(\d+)\s*-\s*(\d+)$/);
    base = fileData.filter(f => {
      const nNF = parseInt(mapFile(f).nNF, 10);
      return !isNaN(nNF) && nNF >= parseInt(start, 10) && nNF <= parseInt(end, 10);
    });
    sortMode = 'nNF';
  }

  // Chave de acesso única (>10 dígitos sem hífen)
  else if (!query.includes('-') && query.length > 10) {
    base = fileData.filter(f =>
      mapFile(f).chNFe && mapFile(f).chNFe.includes(query)
    );
    sortMode = 'date';
  }

  // Busca simples por número (nNF contém)
  else if (/^\d+$/.test(query)) {
    base = fileData.filter(f =>
      mapFile(f).nNF && mapFile(f).nNF.includes(query)
    );
    sortMode = 'nNF';
  }

  // Caso inválido
  else {
    base = [];
    sortMode = 'date';
  }

  // --- NOVO: aplicar filtros extras ---
  const status = document.getElementById("filterStatus")?.value.trim();
  const cnpj = document.getElementById("filter_CNPJ")?.value.trim();
  const serie = document.getElementById("filter_serie")?.value.trim();
  const nNF = document.getElementById("filter_nNF")?.value.trim();
  const chNFe = document.getElementById("filter_infNFe_Id")?.value.trim();
  const uf = document.getElementById("filterUF")?.value.trim();
  const ano = document.getElementById("filterAno")?.value.trim();
  const mes = document.getElementById("filterMes")?.value.trim();

base = base.filter(f => {
  const file = mapFile(f);
  const chave = file.chNFe?.replace(/^NFe/, "");

  if (!chave || chave.length !== 44) return false;

  const ufCode = chave.substring(0, 2);   // dígitos 1–2
  const anoCode = chave.substring(2, 4);  // dígitos 3–4
  const mesCode = chave.substring(4, 6);  // dígitos 5–6
  const cnpjExtraido = chave.substring(6, 20);

  // --- UF, Ano, Mês ---
  if (uf && ufCode !== uf) return false;
  if (ano && anoCode !== ano) return false;
  if (mes && mesCode !== mes) return false;

  // --- Status ---
  if (status && status !== "") {
    if (!(f["4"] === status || f["5"] === status)) return false;
  }

  // --- CNPJ ---
  const cleanCnpj = cnpjExtraido.replace(/\D/g, "");
  const cleanFiltro = cnpj?.replace(/\D/g, "");
  if (cleanFiltro && !cleanCnpj.includes(cleanFiltro)) return false;

  // --- Série ---
  if (serie && (!file.serie || !file.serie.includes(serie))) return false;

  // --- nNF ---
  if (nNF && (!file.nNF || !file.nNF.includes(nNF))) return false;

  // --- Chave digitada ---
  if (chNFe && (!file.chNFe || !file.chNFe.includes(chNFe))) return false;

  return true;
});

  // Aplica filtro de subpastas
  const filtered = filterBySubfolders(base);

  // Ordenação e exibição (igual ao seu código atual)
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'nNF') {
      const na = parseInt(mapFile(a).nNF, 10);
      const nb = parseInt(mapFile(b).nNF, 10);
      const va = isNaN(na) ? Number.MIN_SAFE_INTEGER : na;
      const vb = isNaN(nb) ? Number.MIN_SAFE_INTEGER : nb;
      return sortDescending ? (vb - va) : (va - vb);
    } else {
      const da = parseJsonDate(mapFile(a).modified_date);
      const db = parseJsonDate(mapFile(b).modified_date);
      const va = da ? da.getTime() : 0;
      const vb = db ? db.getTime() : 0;
      return sortDescending ? (vb - va) : (va - vb);
    }
  });
  
  updateFilterButtonState()
  searchResults = sorted;
  displayedFiles = sorted.slice(0, itemsPerPage);
  displayFiles(displayedFiles, false);
}

function initSubfolders(header) {
  const subfoldersDiv = document.createElement('div');
  subfoldersDiv.className = 'subfolders';

  Object.keys(folderMap)
    .filter(k => k !== "0")
    .forEach(k => {
      const span = document.createElement('span');
      span.textContent = folderMap[k].split(/[\\/]+/).pop();
      span.dataset.folderIndex = k;

      span.addEventListener('click', () => {
        const idx = span.dataset.folderIndex;
        const pos = selectedFolders.indexOf(idx);

        if (pos >= 0) {
          selectedFolders.splice(pos, 1);
          span.classList.remove('active');
        } else {
          selectedFolders.push(idx);
          span.classList.add('active');
        }

        currentPage = 1;
        displayedFiles = [];

        if (isSearching) {
          searchFiles();
        } else {
          const base = fileData;
          const filtered = filterBySubfolders(base);
          searchResults = filtered;
          displayedFiles = filtered.slice(0, itemsPerPage);
          displayFiles(displayedFiles, false);
        }
      });

      subfoldersDiv.appendChild(span);
    });

  header.insertAdjacentElement('afterend', subfoldersDiv);
}

/* ============================
   initSubfolders(header)
   - Cria a área .subfolders logo após o header (mantém compatibilidade)
   - Adiciona/remover classe .active nos spans
   - Atualiza selectedFolders e reexecuta busca/paginação
   ============================ */
function initSubfolders(header) {
  // Remove qualquer subfolders já existente para evitar duplicação
  const existing = document.querySelector('.subfolders');
  if (existing) existing.remove();

  const subfoldersDiv = document.createElement('div');
  subfoldersDiv.className = 'subfolders';

  // Proteção caso folderMap não exista
  if (typeof folderMap === 'undefined') {
    header.insertAdjacentElement('afterend', subfoldersDiv);
    return;
  }

  Object.keys(folderMap)
    .filter(k => k !== "0")
    .forEach(k => {
      const span = document.createElement('span');
      span.textContent = folderMap[k].split(/[\\/]+/).pop();
      span.dataset.folderIndex = k;
      // Se já estiver selecionado no estado, aplica classe
      if (selectedFolders.includes(String(k))) span.classList.add('active');

      span.addEventListener('click', () => {
        const idx = String(span.dataset.folderIndex);
        const pos = selectedFolders.indexOf(idx);

        if (pos >= 0) {
          selectedFolders.splice(pos, 1);
          span.classList.remove('active');
        } else {
          selectedFolders.push(idx);
          span.classList.add('active');
        }

        // Reset de paginação e dados exibidos
        currentPage = 1;
        displayedFiles = [];

        // Reaplica busca/filtragem conforme estado atual
        if (isSearching) {
          searchFiles();
        } else {
          const base = fileData;
          const filtered = filterBySubfolders(base);
          searchResults = filtered;
          displayedFiles = filtered.slice(0, itemsPerPage);
          displayFiles(displayedFiles, false);
        }

        // Atualiza estado visual do botão de filtros (caso haja filtros ativos)
        updateFilterButtonState();
      });

      subfoldersDiv.appendChild(span);
    });

  header.insertAdjacentElement('afterend', subfoldersDiv);
}

/* ============================
   updateFilterButtonState()
   - Lê todos os campos do painel de filtros e aplica .active-filter no #btnFilters
   - Deve ser chamado sempre que um campo de filtro mudar
   ============================ */
function updateFilterButtonState() {
  const btnFilters = document.getElementById("btnFilters");
  if (!btnFilters) return;

  const status = document.getElementById("filterStatus")?.value?.trim() || "";
  const cnpj   = document.getElementById("filter_CNPJ")?.value?.trim() || "";
  const serie  = document.getElementById("filter_serie")?.value?.trim() || "";
  const nNF    = document.getElementById("filter_nNF")?.value?.trim() || "";
  const chNFe  = document.getElementById("filter_infNFe_Id")?.value?.trim() || "";
  const uf     = document.getElementById("filterUF")?.value?.trim() || "";
  const ano    = document.getElementById("filterAno")?.value?.trim() || "";
  const mes    = document.getElementById("filterMes")?.value?.trim() || "";

  const hasStatus = status !== "";

  if (hasStatus || cnpj || serie || nNF || chNFe || uf || ano || mes || selectedFolders.length > 0) {
    btnFilters.classList.add("active-filter");
  } else {
    btnFilters.classList.remove("active-filter");
  }
}

/* ============================
   initFilters()
   - Constrói o formulário de filtros dentro de #filterForm
   - Adiciona listeners para inputs/selects para atualizar o estado do botão
   - Garante que o botão "Aplicar" execute a busca e feche o painel
   - Mantém IDs esperados pelo restante do sistema
   ============================ */
function initFilters() {
  // Proteção: se não existir o form, aborta
  const form = document.getElementById("filterForm");
  if (!form) return;

  // Limpa conteúdo anterior (se houver)
  form.innerHTML = '';

  // Mapa local de status e campos (mantendo compatibilidade com seu código)
  const statusMapLocal = { s1: "Cancelado", s2: "Evento", s3: "Inutilizado" };
  const fieldMapLocal = { infNFe_Id: "Chave de Acesso", nNF: "Número NF", serie: "Série", CNPJ: "CNPJ" };

  // --- Status select ---
  const statusLabel = document.createElement("label");
  statusLabel.textContent = "Status:";
  statusLabel.htmlFor = "filterStatus";
  const statusSelect = document.createElement("select");
  statusSelect.id = "filterStatus";
  statusSelect.innerHTML = `<option value="">Todos</option>`;
  Object.entries(statusMapLocal).forEach(([key, label]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = label;
    statusSelect.appendChild(opt);
  });
  form.appendChild(statusLabel);
  form.appendChild(statusSelect);

  // --- Campos textuais ---
  Object.entries(fieldMapLocal).forEach(([field, label]) => {
    const lbl = document.createElement("label");
    lbl.textContent = label + ":";
    lbl.htmlFor = "filter_" + field;
    const input = document.createElement("input");
    input.type = "text";
    input.id = "filter_" + field;
    input.placeholder = label;
    form.appendChild(lbl);
    form.appendChild(input);
  });

  // --- UF select ---
  const ufLabel = document.createElement("label");
  ufLabel.textContent = "UF:";
  ufLabel.htmlFor = "filterUF";
  const ufSelect = document.createElement("select");
  ufSelect.id = "filterUF";
  const optAllUF = document.createElement("option");
  optAllUF.value = "";
  optAllUF.textContent = "Todos";
  ufSelect.appendChild(optAllUF);

  if (typeof ufMap !== 'undefined') {
    const ufEntries = Object.entries(ufMap).sort((a, b) => a[1].localeCompare(b[1]));
    ufEntries.forEach(([code, sigla]) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = sigla;
      ufSelect.appendChild(opt);
    });
  }
  form.appendChild(ufLabel);
  form.appendChild(ufSelect);

  // --- Ano e Mês ---
  const anoLabel = document.createElement("label");
  anoLabel.textContent = "Ano:";
  anoLabel.htmlFor = "filterAno";
  const anoInput = document.createElement("input");
  anoInput.type = "text";
  anoInput.id = "filterAno";
  anoInput.placeholder = "AA (ex: 25)";
  form.appendChild(anoLabel);
  form.appendChild(anoInput);

  const mesLabel = document.createElement("label");
  mesLabel.textContent = "Mês:";
  mesLabel.htmlFor = "filterMes";
  const mesInput = document.createElement("input");
  mesInput.type = "text";
  mesInput.id = "filterMes";
  mesInput.placeholder = "MM (01-12)";
  form.appendChild(mesLabel);
  form.appendChild(mesInput);

  // --- Botão Aplicar (mantém id applyFilters) ---
  const applyBtn = document.createElement("button");
  applyBtn.id = "applyFilters";
  applyBtn.textContent = "Aplicar";
  applyBtn.type = "button";
  applyBtn.style.alignSelf = "center";
  applyBtn.style.marginTop = "12px";
  form.appendChild(applyBtn);

  // --- Listeners: atualiza estado do botão de filtros quando algo muda ---
  const inputsToWatch = [
    statusSelect,
    document.getElementById("filter_infNFe_Id"),
    document.getElementById("filter_nNF"),
    document.getElementById("filter_serie"),
    document.getElementById("filter_CNPJ"),
    ufSelect,
    anoInput,
    mesInput
  ];

  // Alguns inputs podem ainda não existir no DOM (por id), então selecionamos dinamicamente
  const dynamicWatch = Array.from(form.querySelectorAll('input, select'));
  dynamicWatch.forEach(el => {
    el.addEventListener('input', updateFilterButtonState);
    el.addEventListener('change', updateFilterButtonState);
  });

  // Aplica filtros ao clicar em "Aplicar"
  applyBtn.addEventListener('click', (e) => {
    e.preventDefault();

    // Sanitização leve: remove não-dígitos da chave de acesso
    const accessKeyEl = document.getElementById("accessKey");
    if (accessKeyEl) {
      accessKeyEl.value = accessKeyEl.value.replace(/\D/g, "").slice(0, 44);
    }

    // Reset de paginação e dados exibidos
    currentPage = 1;
    displayedFiles = [];

    // Executa busca com os filtros aplicados
    searchFiles();

    // Fecha painel e overlay (se existirem)
    document.getElementById("overlay")?.classList.add("hidden");
    document.getElementById("filterPanel")?.classList.add("hidden");
  });

  // Inicializa estado do botão de filtros (caso já haja valores)
  updateFilterButtonState();

  // Overlay e botão de filtros: garantir que abram/fechem corretamente (não sobrescreve handlers existentes)
  const overlay = document.getElementById("overlay");
  const panel = document.getElementById("filterPanel");
  const btnFilters = document.getElementById("btnFilters");
  const closeBtn = document.getElementById("closeFilters");

  // Se btnFilters existir e não tiver listener, adiciona toggle seguro
  if (btnFilters && !btnFilters.dataset._hasToggle) {
    btnFilters.addEventListener('click', (e) => {
      e.preventDefault();
      if (panel && !panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        overlay?.classList.add('hidden');
        btnFilters.classList.remove('active-filter');
        btnFilters.setAttribute('aria-expanded', 'false');
      } else {
        panel?.classList.remove('hidden');
        overlay?.classList.remove('hidden');
        btnFilters.classList.add('active-filter');
        btnFilters.setAttribute('aria-expanded', 'true');
      }
    });
    btnFilters.dataset._hasToggle = '1';
  }

  // Overlay fecha o painel ao clicar fora (se não tiver listener já)
  if (overlay && !overlay.dataset._hasListener) {
    overlay.addEventListener('click', () => {
      panel?.classList.add('hidden');
      overlay.classList.add('hidden');
      btnFilters?.classList.remove('active-filter');
      btnFilters?.setAttribute('aria-expanded', 'false');
    });
    overlay.dataset._hasListener = '1';
  }

  // Botão X fecha o painel
  if (closeBtn && !closeBtn.dataset._hasClose) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      panel?.classList.add('hidden');
      overlay?.classList.add('hidden');
      btnFilters?.classList.remove('active-filter');
      btnFilters?.setAttribute('aria-expanded', 'false');
    });
    closeBtn.dataset._hasClose = '1';
  }

  // Fechar com ESC (apenas uma vez)
  if (!document.body.dataset._hasEscFilter) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (panel && !panel.classList.contains('hidden')) {
          panel.classList.add('hidden');
          overlay?.classList.add('hidden');
          btnFilters?.classList.remove('active-filter');
          btnFilters?.setAttribute('aria-expanded', 'false');
        }
      }
    });
    document.body.dataset._hasEscFilter = '1';
  }
}

// Delay de busca
let searchTimeout;
const searchBox = document.getElementById('accessKey');
searchBox.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(searchFiles, 3000);
});

// Busca ao pressionar Enter
searchBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(searchTimeout);
    searchFiles();
  }
});

window.onload = () => {
  // Primeira carga
  currentPage = 1;
  displayedFiles = [];
  loadMoreFiles();

  // Exibe a hora da última atualização formatada
  const lastUpdateDiv = document.getElementById('last-update');
  if (typeof fileData_lastUpdate !== 'undefined') {
    const rawDate = parseJsonDate(fileData_lastUpdate);
    const formattedDate = rawDate ? formatDisplayDate(rawDate) : fileData_lastUpdate;
    lastUpdateDiv.innerHTML = "Última atualização:<br>" + formattedDate;
  }

  // Subpastas
  if (typeof folderMap !== 'undefined') {
    const header = document.getElementById('folderHeader');
    header.textContent = `Arquivos XML na pasta ${folderMap["0"]}`;
    initSubfolders(header); // já monta os spans e adiciona eventos
  }

  // Filtros
  initFilters();

  // Botão de ordenação
  document.getElementById('toggleSort').addEventListener('click', () => {
    sortDescending = !sortDescending;

    const btn = document.getElementById('toggleSort');
    btn.innerHTML = `<span id="sortIcon">${sortDescending ? "⬇️" : "⬆️"}</span> ${sortDescending ? "Descendente" : "Ascendente"}`;

    currentPage = 1;
    displayedFiles = [];

    const base = searchResults;
    const filtered = filterBySubfolders(base);

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === 'nNF') {
        const na = parseInt(mapFile(a).nNF, 10);
        const nb = parseInt(mapFile(b).nNF, 10);
        const va = isNaN(na) ? Number.MIN_SAFE_INTEGER : na;
        const vb = isNaN(nb) ? Number.MIN_SAFE_INTEGER : nb;
        return sortDescending ? (vb - va) : (va - vb);
      } else {
        const da = parseJsonDate(mapFile(a).modified_date);
        const db = parseJsonDate(mapFile(b).modified_date);
        const va = da ? da.getTime() : 0;
        const vb = db ? db.getTime() : 0;
        return sortDescending ? (vb - va) : (va - vb);
      }
    });

    displayFiles(sorted.slice(0, itemsPerPage));
  });

};



