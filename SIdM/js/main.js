// Dados multilíngues embutidos
const dataPT = {
  "NFe": {
    "titulo1": {
      "titulo": "Como emitir uma NFe",
      "conteudo": "Para emitir uma NFe, você deve acessar o sistema autorizado e preencher os dados fiscais corretamente."
    },
    "titulo2": {
      "titulo": "Erros comuns na NFe",
      "conteudo": "Erros comuns incluem CFOP incorreto, dados do destinatário inválidos e problemas com o certificado digital."
    },
    "titulo3": {
      "titulo": "Cancelamento de NFe",
      "conteudo": "O cancelamento deve ser feito em até 24 horas após a emissão, salvo exceções previstas na legislação."
    }
  },
  "CTe": {
    "titulo1": {
      "titulo": "Introdução ao CTe",
      "conteudo": "O Conhecimento de Transporte Eletrônico é um documento fiscal digital que substitui o modelo em papel."
    },
    "titulo2": {
      "titulo": "CTe OS vs CTe Normal",
      "conteudo": "O CTe OS é usado para serviços de transporte de pessoas, enquanto o CTe normal é para cargas."
    },
    "titulo3": {
      "titulo": "Manifesto do CTe",
      "conteudo": "O manifesto consolida os CTes emitidos para uma mesma operação de transporte."
    }
  }
};

const dataEN = {
  "NFe": {
    "titulo1": {
      "titulo": "How to issue an NFe",
      "conteudo": "To issue an NFe, you must access the authorized system and correctly fill in the tax data."
    },
    "titulo2": {
      "titulo": "Common NFe Errors",
      "conteudo": "Common errors include incorrect CFOP, invalid recipient data, and digital certificate issues."
    },
    "titulo3": {
      "titulo": "NFe Cancellation",
      "conteudo": "Cancellation must be done within 24 hours after issuance, except in cases provided by law."
    },
    "titulo4": {
      "titulo": "Teste",
      "conteudo": "TESTES"
    }
  },
  "CTe": {
    "titulo1": {
      "titulo": "Introduction to CTe",
      "conteudo": "The Electronic Transport Knowledge is a digital tax document that replaces the paper model."
    },
    "titulo2": {
      "titulo": "CTe OS vs Regular CTe",
      "conteudo": "CTe OS is used for passenger transport services, while regular CTe is for cargo."
    },
    "titulo3": {
      "titulo": "CTe Manifest",
      "conteudo": "The manifest consolidates the CTes issued for the same transport operation."
    }
  }
};

let currentLang = 'pt';
let contentData = dataPT;
let editingCategoria = null;
let editingId = null;


function setLanguage(lang) {
  // Salva o artigo atual (se houver)
  const currentArticle = document.querySelector('#article-content h1')?.textContent;
  let selectedCategoria = null;
  let selectedId = null;

  for (const categoria in contentData) {
    for (const id in contentData[categoria]) {
      if (contentData[categoria][id].titulo === currentArticle) {
        selectedCategoria = categoria;
        selectedId = id;
        break;
      }
    }
  }

  // Salva categorias abertas
  const openCategories = Array.from(document.querySelectorAll('#menu > ul > li.active > span'))
    .map(span => span.textContent);

  // Troca idioma
  currentLang = lang;
  contentData = lang === 'pt' ? dataPT : dataEN;

  // Re-renderiza
  renderMenu(openCategories);
  
  if (selectedCategoria && selectedId) {
    loadArticle(selectedCategoria, selectedId);
  } else {
    renderWelcome();
  }
}

function renderWelcome() {
  const article = document.getElementById('article-content');
  article.innerHTML = `
    <h1>${currentLang === 'pt' ? 'Bem-vindo' : 'Welcome'}</h1>
    <p>${currentLang === 'pt'
      ? 'Selecione um item no menu para ver o conteúdo.'
      : 'Select an item from the menu to view the content.'}</p>
  `;
}

function renderMenu(openCategories = []) {
  const menu = document.getElementById('menu');
  menu.innerHTML = '';

  const ul = document.createElement('ul');

  for (const categoria in contentData) {
    const liCategoria = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = categoria;

    if (openCategories.includes(categoria)) {
      liCategoria.classList.add('active');
    }

    span.onclick = () => {
      liCategoria.classList.toggle('active');
    };

    liCategoria.appendChild(span);

    const ulTitulos = document.createElement('ul');

    for (const id in contentData[categoria]) {
      const artigo = contentData[categoria][id];
      const liTitulo = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = artigo.titulo;
      link.onclick = (e) => {
        e.preventDefault();
        loadArticle(categoria, id);
      };
      liTitulo.appendChild(link);
      ulTitulos.appendChild(liTitulo);
    }

    liCategoria.appendChild(ulTitulos);
    ul.appendChild(liCategoria);
  }

  menu.appendChild(ul);
}


function loadArticle(categoria, id) {
  const artigo = contentData[categoria][id];
  const container = document.getElementById('article-content');

  // Verifica se estava em modo de edição antes de carregar novo conteúdo
  const wasEditing = editingCategoria !== null && editingId !== null;

  // Fecha o painel apenas se estava em modo de edição
  if (wasEditing) {
    document.getElementById('new-content-panel').style.display = 'none';
  }

  // Aplica animação de saída para a esquerda
  container.style.animation = 'slideOutToLeft 0.4s ease forwards';

  // Aguarda a saída antes de trocar o conteúdo
  setTimeout(() => {
    container.innerHTML = `
      <a id="edit-article-link" href="#" onclick="editCurrentArticle()">Editar</a>
      <h1>${artigo.titulo}</h1>
      <p>${artigo.conteudo}</p>
    `;
    container.style.animation = 'slideInFromLeft 0.6s ease forwards';


    // Atualiza os dados para edição
    editingCategoria = categoria;
    editingId = id;
  }, 400);
}



function editCurrentArticle() {
  if (!editingCategoria || !editingId) return;

  // Usa a linguagem atual para carregar o conteúdo correto
  const artigo =
    currentLang === 'pt'
      ? dataPT[editingCategoria][editingId]
      : dataEN[editingCategoria][editingId];

  // Preenche o formulário com os dados do artigo atual
  document.getElementById('category-select').value = '';
  document.getElementById('new-category').value = editingCategoria;
  document.getElementById('content-title').value = artigo.titulo;
  document.getElementById('content-body').value = artigo.conteudo;

  // Mostra o painel de edição
  document.getElementById('new-content-panel').style.display = 'block';

  // Garante que o campo de nova categoria esteja visível
  handleCategoryChange();
}

function toggleNewContentPanel() {
  const panel = document.getElementById('new-content-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';

  // Preenche a combobox com categorias existentes
  const select = document.getElementById('category-select');
  select.innerHTML = '<option value="">-- Escolher existente --</option>';
  for (const categoria in contentData) {
    const option = document.createElement('option');
    option.value = categoria;
    option.textContent = categoria;
    select.appendChild(option);
  }
}

function addNewContent() {
  const selectedCategory = document.getElementById('category-select').value;
  const newCategory = document.getElementById('new-category').value.trim();
  const title = document.getElementById('content-title').value.trim();
  const body = document.getElementById('content-body').value.trim();

  const isEditing = editingCategoria && editingId;
  const categoriaFinal = newCategory || selectedCategory;

  if (!title || !body) {
    alert('Título e conteúdo são obrigatórios.');
    return;
  }

  if (!categoriaFinal) {
    alert('Escolha ou digite uma categoria.');
    return;
  }

  const id = isEditing
    ? editingId
    : 'titulo' + (Object.keys(dataPT[categoriaFinal] || {}).length + 1);

  // Garante que a categoria exista nos dois idiomas
  if (!dataPT[categoriaFinal]) dataPT[categoriaFinal] = {};
  if (!dataEN[categoriaFinal]) dataEN[categoriaFinal] = {};

  // Cria ou atualiza o conteúdo em ambos os idiomas
  const artigo = { titulo: title, conteudo: body };
  dataPT[categoriaFinal][id] = artigo;
  dataEN[categoriaFinal][id] = { ...artigo };

  // Atualiza a linguagem atual
  contentData = currentLang === 'pt' ? dataPT : dataEN;

  renderMenu();
  loadArticle(categoriaFinal, id);

  // Limpa o formulário
  document.getElementById('category-select').value = '';
  document.getElementById('new-category').value = '';
  document.getElementById('content-title').value = '';
  document.getElementById('content-body').value = '';
  document.getElementById('new-content-panel').style.display = 'none';

  // Mostra botão de exportação
  document.getElementById('export-json-btn').style.display = 'block';

  // Finaliza modo de edição
  editingCategoria = null;
  editingId = null;
  document.getElementById('edit-article-link').style.display = 'none';
}

function handleCategoryChange() {
  const select = document.getElementById('category-select');
  const wrapper = document.getElementById('new-category-wrapper');

  if (select.value) {
    // Categoria existente selecionada → esconder campo de nova categoria
    wrapper.style.maxHeight = '0';
    wrapper.style.opacity = '0';
    wrapper.style.margin = '0';
    wrapper.style.overflow = 'hidden';
  } else {
    // Nenhuma categoria selecionada → mostrar campo de nova categoria
    wrapper.style.maxHeight = '200px';
    wrapper.style.opacity = '1';
    wrapper.style.marginTop = '1rem';
    wrapper.style.overflow = 'visible';
  }
}

function exportContentData() {
  // Gera o conteúdo como texto JavaScript
  const exportText =
    '// Dados multilíngues embutidos\n' +
    'const dataPT = ' + JSON.stringify(dataPT, null, 2) + ';\n\n' +
    'const dataEN = ' + JSON.stringify(dataEN, null, 2) + ';';

  // Cria o blob e link de download
  const blob = new Blob([exportText], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'conteudo_multilingue.js';
  a.click();

  URL.revokeObjectURL(url);
}

document.getElementById('search-input').addEventListener('input', function () {
  const term = this.value.toLowerCase();
  const suggestions = document.getElementById('search-suggestions');
  suggestions.innerHTML = '';

  if (!term) {
    suggestions.style.display = 'none';
    return;
  }

  const matches = [];

  for (const categoria in contentData) {
    for (const id in contentData[categoria]) {
      const artigo = contentData[categoria][id];
      if (
        artigo.titulo.toLowerCase().includes(term) ||
        artigo.conteudo.toLowerCase().includes(term)
      ) {
        matches.push({ categoria, id, titulo: artigo.titulo });
      }
    }
  }

  if (matches.length === 0) {
    suggestions.style.display = 'none';
    return;
  }

  matches.slice(0, 10).forEach(match => {
    const li = document.createElement('li');
    li.textContent = match.titulo;
    li.onclick = () => {
      loadArticle(match.categoria, match.id);
      suggestions.style.display = 'none';
      document.getElementById('search-input').value = '';
    };
    suggestions.appendChild(li);
  });

  suggestions.style.display = 'block';
});

window.onload = () => {
  renderMenu();
  renderWelcome();
};