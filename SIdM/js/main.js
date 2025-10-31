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
let isEditingMode = false;




document.getElementById('article-content').addEventListener('click', function (e) {
  if (e.target.tagName === 'IMG') {
    const splash = document.getElementById('image-splash');
    const splashImg = document.getElementById('splash-img');
    splashImg.src = e.target.src;
    splash.style.display = 'flex';
  }
});

function closeSplash() {
  document.getElementById('image-splash').style.display = 'none';
  document.getElementById('splash-img').src = '';
}

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
    closeNewContentPanel();
  }

  // Aplica animação de saída para a esquerda
  container.style.animation = 'slideOutToLeft 0.4s ease forwards';

  // Aguarda a saída antes de trocar o conteúdo
  setTimeout(() => {
    container.innerHTML = `
      <a id="edit-article-link" href="#" onclick="editCurrentArticle()">Editar</a>
      <h1>${artigo.titulo}</h1>
      <div class="article-body">${artigo.conteudo}</div>
    `;
    container.style.animation = 'slideInFromLeft 0.6s ease forwards';


    // Atualiza os dados para edição
    editingCategoria = categoria;
    editingId = id;
  }, 400);
}

function closeNewContentPanel() {
  document.getElementById('new-content-panel').style.display = 'none';
  document.getElementById('overlay').style.display = 'none';
}

function editCurrentArticle() {
  if (!editingCategoria || !editingId) return;

  isEditingMode = true; // ← Ativa modo de edição

  const artigo =
    currentLang === 'pt'
      ? dataPT[editingCategoria][editingId]
      : dataEN[editingCategoria][editingId];

  document.getElementById('category-select').value = '';
  document.getElementById('new-category').value = editingCategoria;
  document.getElementById('content-title').value = artigo.titulo;
  document.getElementById('content-body').innerHTML = artigo.conteudo;

  document.getElementById('new-content-panel').style.display = 'block';
  document.getElementById('overlay').style.display = 'block';
  handleCategoryChange();
}

function toggleNewContentPanel() {
  const panel = document.getElementById('new-content-panel');
  const overlay = document.getElementById('overlay');

 const isHidden = panel.style.display === 'none' || panel.style.display === '';

  if (isHidden) {
    // Abrir
    overlay.style.display = 'block';
    panel.style.display = 'block';
    isEditingMode = false;
    editingCategoria = null;
    editingId = null;

    // Mostrar painel e overlay
    overlay.style.display = 'block';
    panel.style.display = 'block';

    // Preencher categorias
    const select = document.getElementById('category-select');
    select.innerHTML = '<option value="">-- Escolher existente --</option>';
    for (const categoria in contentData) {
      const option = document.createElement('option');
      option.value = categoria;
      option.textContent = categoria;
      select.appendChild(option);
    }

    // Limpar campos
    document.getElementById('new-category').value = '';
    document.getElementById('content-title').value = '';
    document.getElementById('content-body').innerHTML = '';
    handleCategoryChange();
  } else {
    // Fechar
    closeNewContentPanel();
  }
}

function addNewContent() {
  const selectedCategory = document.getElementById('category-select').value;
  const newCategory = document.getElementById('new-category').value.trim();
  const title = document.getElementById('content-title').value.trim();
  const body = document.getElementById('content-body').innerHTML.trim();

  const categoriaFinal = newCategory || selectedCategory;

  if (!title || !body) {
    alert('Título e conteúdo são obrigatórios.');
    return;
  }

  if (!categoriaFinal) {
    alert('Escolha ou digite uma categoria.');
    return;
  }

  const id = isEditingMode
    ? editingId
    : 'titulo' + (Object.keys(dataPT[categoriaFinal] || {}).length + 1);

  if (!dataPT[categoriaFinal]) dataPT[categoriaFinal] = {};
  if (!dataEN[categoriaFinal]) dataEN[categoriaFinal] = {};

  const artigo = { titulo: title, conteudo: body };
  dataPT[categoriaFinal][id] = artigo;
  dataEN[categoriaFinal][id] = { ...artigo };

  contentData = currentLang === 'pt' ? dataPT : dataEN;

  renderMenu();
  loadArticle(categoriaFinal, id);

  // Limpa o formulário
  document.getElementById('category-select').value = '';
  document.getElementById('new-category').value = '';
  document.getElementById('content-title').value = '';
  document.getElementById('content-body').value = '';
  closeNewContentPanel();

  document.getElementById('export-json-btn').style.display = 'block';

  // Finaliza modo de edição
  isEditingMode = false;
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
  // Gera o conteúdo como texto JavaScript formatado
  const exportText = [
    '// Dados multilíngues embutidos',
    'const dataPT = ' + JSON.stringify(dataPT, null, 2) + ';',
    '',
    'const dataEN = ' + JSON.stringify(dataEN, null, 2) + ';'
  ].join('');

  // Cria o arquivo Blob e prepara o link de download
  const blob = new Blob([exportText], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'conteudo_multilingue.json';
  document.body.appendChild(link); // necessário para Firefox
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

document.getElementById('search-input').addEventListener('input', function () {
  const termo = this.value.toLowerCase();
  const suggestions = document.getElementById('search-suggestions');
  suggestions.innerHTML = '';

  if (!termo) {
    suggestions.style.display = 'none';
    return;
  }

  const matches = [];

  for (const categoria in contentData) {
    const artigos = contentData[categoria];
    for (const id in artigos) {
      const { titulo, conteudo } = artigos[id];
      if (
        titulo.toLowerCase().includes(termo) ||
        conteudo.toLowerCase().includes(termo)
      ) {
        matches.push({ categoria, id, titulo });
      }
    }
  }

  if (matches.length === 0) {
    suggestions.style.display = 'none';
    return;
  }

  matches.slice(0, 10).forEach(({ categoria, id, titulo }) => {
    const li = document.createElement('li');
    li.textContent = titulo;
    li.onclick = () => {
      loadArticle(categoria, id);
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