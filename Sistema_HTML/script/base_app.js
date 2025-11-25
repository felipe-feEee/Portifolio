const listContainer = document.querySelector('.list-container');
const headerGroup = document.querySelector('.header-group');
let itemsPerPage = 100;
let currentPage = 1;
let displayedFiles = [];
let isSearching = false;
let searchResults = [];
let sortDescending = true;

// Mapa de legendas para facilitar leitura
const fieldMap = {
  1: "filename",
  2: "modified_date",
  3: "serie",
  4: "nNF",
  5: "infNFe_Id"
};

// Converte um objeto minificado para um objeto com nomes legíveis
function mapFile(file) {
  return {
    filename: file["1"],
    modified_date: file["2"],
    serie: file["3"],
    nNF: file["4"],
    infNFe_Id: file["5"]
  };
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

function loadMoreFiles() {
  const base = isSearching ? searchResults : fileData;
  const sourceData = filterBySubfolders(base);

  const start = itemsPerPage * (currentPage - 1);
  const end = itemsPerPage * currentPage;
  const nextData = sourceData.slice(start, end);

  displayedFiles = displayedFiles.concat(nextData);
  displayFiles(nextData, true);
  currentPage++;
}

function displayFiles(data, append = false) {
  const list = document.getElementById('fileList');
  const counter = document.getElementById('fileCounter');

  // Ordena por data de modificação (mais recente primeiro)
  data.sort((a, b) => {
	  const dateA = new Date(mapFile(a).modified_date);
	  const dateB = new Date(mapFile(b).modified_date);
	  return sortDescending ? dateB - dateA : dateA - dateB;
	});


  if (!append) {
    list.innerHTML = '';
    displayedFiles = data.slice();
  }

  const now = new Date();

  data.forEach(f => {
    const file = mapFile(f); // usa helper para traduzir

    const li = document.createElement('li');

    // 🔎 Topo do card
    const infoTop = document.createElement('span');
    infoTop.className = 'info-top';

    if (file.nNF === "CANCELADO") {
      infoTop.textContent = "Cancelado";
    } else if (file.nNF === "EVENTO") {
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

    infoBottom.innerHTML = `${fileNameOnly}<br>Pasta: ${folderName}<br>Modificado: ${file.modified_date}`;

    // 🔎 Ações
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

    li.appendChild(infoTop);
    li.appendChild(infoBottom);
    li.appendChild(actionsDiv);

    // ✅ Validação de idade
    const fileDate = new Date(file.modified_date.replace(' ', 'T'));
    const diffDays = (now - fileDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 21) {
      li.classList.add('old-file');
    }

    // ✅ Diferenciação visual
    if (file.infNFe_Id === "INUTILIZADO" || file.infNFe_Id === "INUTILIZAÇÃO") {
      li.classList.add('inutilizacao');
    }
    if (file.nNF === "CANCELADO") {
      li.classList.add('cancelado');
    }
    if (file.nNF === "EVENTO") {
      li.classList.add('evento');
    }

    list.appendChild(li);
  });

  // 🔎 Atualiza contador com base filtrada
  const base = isSearching ? searchResults : fileData;
  const filtered = filterBySubfolders(base);
  counter.textContent = `Exibindo ${displayedFiles.length} de ${filtered.length} arquivos`;
}

listContainer.addEventListener('scroll', () => {
  const sourceData = isSearching ? searchResults : fileData;

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
  const searchBox = document.getElementById('searchBox');
  let rawQuery = searchBox.value.trim();

  // Normaliza a entrada
  let query = normalizeQuery(rawQuery);

  // Base inicial: todos os arquivos
  let base = fileData;

  // 🔎 Cancelamento
  if (rawQuery.length >= 3 && /^canc/i.test(rawQuery)) {
    query = "CANCELADO";
    searchBox.value = query;
    isSearching = true;
    currentPage = 1;
    base = fileData.filter(f => mapFile(f).nNF === "CANCELADO");
  }

  // 🔎 Evento
  else if (rawQuery.length >= 3 && /^event/i.test(rawQuery)) {
    query = "EVENTO";
    searchBox.value = query;
    isSearching = true;
    currentPage = 1;
    base = fileData.filter(f => mapFile(f).nNF === "EVENTO");
  }

  // 🔎 Inutilização
  else if (rawQuery.length >= 3 && /inut/i.test(rawQuery)) {
    query = "INUTILIZADO";
    searchBox.value = query;
    isSearching = true;
    currentPage = 1;
    base = fileData.filter(f => mapFile(f).infNFe_Id === "INUTILIZADO");
  }

  // 🔎 Query vazia → reset
  else if (query === "") {
    isSearching = false;
    currentPage = 1;
    base = fileData;
  }

  // 🔎 Range de chave de acesso (duas sequências de 44 dígitos)
  else if (/^(\d{44})-(\d{44})$/.test(query)) {
    const [_, startKey, endKey] = query.match(/^(\d{44})-(\d{44})$/);
    isSearching = true;
    currentPage = 1;
    base = fileData.filter(f => {
      const id = mapFile(f).infNFe_Id?.replace(/^NFe/, '');
      return id && id >= startKey && id <= endKey;
    });
  }

  // 🔎 Intervalo de nNF (ex: 20728-20730)
  else if (/^(\d+)\s*-\s*(\d+)$/.test(query)) {
    const [_, start, end] = query.match(/^(\d+)\s*-\s*(\d+)$/);
    isSearching = true;
    currentPage = 1;
    base = fileData.filter(f => {
      const nNF = parseInt(mapFile(f).nNF, 10);
      return !isNaN(nNF) && nNF >= parseInt(start, 10) && nNF <= parseInt(end, 10);
    });
  }

  // 🔎 Chave de acesso única (>10 dígitos sem hífen)
  else if (!query.includes('-') && query.length > 10) {
    isSearching = true;
    currentPage = 1;
    base = fileData.filter(f =>
      mapFile(f).infNFe_Id && mapFile(f).infNFe_Id.includes(query)
    );
  }

  // 🔎 Busca simples por número
  else if (/^\d+$/.test(query)) {
    isSearching = true;
    currentPage = 1;
    base = fileData.filter(f =>
      mapFile(f).nNF && mapFile(f).nNF.includes(query)
    );
  }

  // 🔎 Caso inválido
  else {
    isSearching = true;
    currentPage = 1;
    base = [];
  }

  // Aplica filtro de subpastas
  const filtered = filterBySubfolders(base);

  // Atualiza resultados e exibe primeira página
  searchResults = filtered;
  displayedFiles = filtered.slice(0, itemsPerPage);
  displayFiles(displayedFiles);
}

// Delay de busca
let searchTimeout;
const searchBox = document.getElementById('searchBox');
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
  loadMoreFiles();

  // Exibe a hora da última atualização formatada
  const lastUpdateDiv = document.getElementById('last-update');
  if (typeof fileData_lastUpdate !== 'undefined') {
    const rawDate = new Date(fileData_lastUpdate.replace(' ', 'T')); 
    const formattedDate = rawDate.toLocaleDateString('pt-BR') + ' ' +
                          rawDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    lastUpdateDiv.textContent = "Última atualização: " + formattedDate;
  }

  // Exibe caminho raiz e subpastas
  const header = document.getElementById('folderHeader');
  if (typeof folderMap !== 'undefined') {
    const rootPath = folderMap["0"];
    header.textContent = `Arquivos XML na pasta ${rootPath}`;

    const subfoldersDiv = document.createElement('div');
    subfoldersDiv.className = 'subfolders';

    Object.keys(folderMap)
	  .filter(k => k !== "0")
	  .forEach(k => {
		const span = document.createElement('span');
		span.textContent = folderMap[k].split(/[\\/]+/).pop();
		span.dataset.folderIndex = k;

		// Toggle seleção
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

		  // Reset paginação e renderiza novamente com filtro aplicado
		  currentPage = 1;
		  displayedFiles = [];
		  const base = isSearching ? searchResults : fileData;
		  const filtered = filterBySubfolders(base);
		  const firstPage = filtered.slice(0, itemsPerPage);
		  displayedFiles = firstPage.slice();
		  displayFiles(firstPage, false);
		});

		subfoldersDiv.appendChild(span);
	  });
	  
	document.getElementById('toggleSort').addEventListener('click', () => {
	  sortDescending = !sortDescending; // alterna flag
	  
	  const btn = document.getElementById('toggleSort');
	  btn.textContent = sortDescending ? "Mais novos" : "Mais antigos";
	  
	  currentPage = 1;
	  displayedFiles = [];
	  const base = isSearching ? searchResults : fileData;
	  const filtered = filterBySubfolders(base);
	  displayFiles(filtered.slice(0, itemsPerPage));
	});

    header.insertAdjacentElement('afterend', subfoldersDiv);
  }
};
