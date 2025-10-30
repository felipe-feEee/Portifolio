const listContainer = document.querySelector('.list-container');
const headerGroup = document.querySelector('.header-group');
let itemsPerPage = 100;
let currentPage = 1;
let displayedFiles = [];
let isSearching = false;
let searchResults = [];

function loadMoreFiles() {
  const sourceData = isSearching ? searchResults : fileData;
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
  const query = document.getElementById('searchBox').value.trim();

  // Ordena os dados por data de modificaaco (mais recente primeiro)
  data.sort((a, b) => new Date(b.modified_date) - new Date(a.modified_date));

  if (!append) {
    list.innerHTML = '';
    displayedFiles = data.slice(); // reinicia se nao for append
  }

  data.forEach(file => {
    const li = document.createElement('li');

    const infoTop = document.createElement('span');
    infoTop.className = 'info-top';
    infoTop.textContent = `NFe:${file.nNF} Serie:${file.serie}`;

    const infoBottom = document.createElement('span');
    infoBottom.className = 'info-bottom';
    const fileNameOnly = file.filename.split(/[\\/]+/).pop();
    infoBottom.innerHTML = `${fileNameOnly}<br>Modificado: ${file.modified_date}`;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions';

    const openLink = document.createElement('a');
    openLink.href = file.filename;
    openLink.textContent = 'Abrir XML';
    openLink.target = '_blank';

    const copyLink = document.createElement('a');
    copyLink.href = '#';
    copyLink.textContent = 'Copiar caminho';
    copyLink.addEventListener('click', (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(file.filename).then(() => {
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
    list.appendChild(li);
  });

  counter.textContent = `Exibindo ${displayedFiles.length} de ${fileData.length} arquivos`;
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
  const query = normalizeQuery(rawQuery);

  // Atualiza o campo com a versao limpa
  searchBox.value = query;

  if (query === "") {
    isSearching = false;
    currentPage = 1;
    displayedFiles = [];
    displayFiles(fileData.slice(0, itemsPerPage));
    return;
  }

  isSearching = true;
  currentPage = 1;

  // 1. Range de chave de acesso (duas sequencias de 44 digitos)
  const accessKeyRangeMatch = query.match(/^(\d{44})-(\d{44})$/);
  if (accessKeyRangeMatch) {
    const startKey = accessKeyRangeMatch[1];
    const endKey = accessKeyRangeMatch[2];

    searchResults = fileData.filter(file => {
      const id = file.infNFe_Id?.replace(/^NFe/, '');
      return id && id >= startKey && id <= endKey;
    });

    displayedFiles = searchResults.slice(0, itemsPerPage);
    displayFiles(displayedFiles);
    return; // <- Impede que continue para outras verificacoes
  }

  // 2. Intervalo de nNF (ex: 20728-20730)
  const rangeMatch = query.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);

    searchResults = fileData.filter(file => {
      const nNF = parseInt(file.nNF, 10);
      return !isNaN(nNF) && nNF >= start && nNF <= end;
    });

    displayedFiles = searchResults.slice(0, itemsPerPage);
    displayFiles(displayedFiles);
    return;
  }

  // 3. Chave de acesso unica (mais de 10 digitos e sem hifen)
  if (!query.includes('-') && query.length > 10) {
    const fullQuery = query; // "NFe" +
    searchResults = fileData.filter(file =>
      file.infNFe_Id && file.infNFe_Id.includes(fullQuery)
    );

    displayedFiles = searchResults.slice(0, itemsPerPage);
    displayFiles(displayedFiles);
    return;
  }

  // 4. Busca simples por numero
  if (/^\d+$/.test(query)) {
    searchResults = fileData.filter(file =>
      file.nNF && file.nNF.includes(query)
    );

    displayedFiles = searchResults.slice(0, itemsPerPage);
    displayFiles(displayedFiles);
    return;
  }

  // 5. Caso invalido
  searchResults = [];
  displayedFiles = [];
  displayFiles([]);
}

// Delay de busca
let searchTimeout;
const searchBox = document.getElementById('searchBox');
searchBox.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(searchFiles, 1000);
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
};
