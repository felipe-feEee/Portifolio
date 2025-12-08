import { getSupabaseClient, getConfig } from './supabase-client.js';

const { TABLE, BUCKET } = getConfig();

async function init() {
  const supabase = await getSupabaseClient();

  // Elementos DOM
  const authState = document.getElementById('auth-state');
  const signoutBtn = document.getElementById('signout');
  const createBtn = document.getElementById('createBtn');
  const fileInput = document.getElementById('file');
  const titleInput = document.getElementById('title');
  const contentInput = document.getElementById('content');
  const createStatus = document.getElementById('create-status');
  const postsDiv = document.getElementById('posts');
  const refreshBtn = document.getElementById('refresh');

  // Atualiza estado auth no DOM
  function updateAuthUI() {
    const session = supabase.auth.getSession
      ? supabase.auth.getSession()
      : null;
    // supabase-js v2: auth.getSession() é async; mas persistSession já guardou token no localStorage.
    // Usamos auth.getUser() para obter info atual se disponível.
    if (supabase.auth?.getUser) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          authState.textContent = `Autenticado: ${data.user.email ?? data.user.id}`;
          signoutBtn.style.display = '';
        } else {
          authState.textContent = 'Não autenticado';
          signoutBtn.style.display = 'none';
        }
      }).catch(() => {
        authState.textContent = 'Não autenticado';
        signoutBtn.style.display = 'none';
      });
    } else {
      authState.textContent = 'Estado de autenticação indisponível nesta build.';
    }
  }

  // Se quiser testar sem autenticação, com permissões públicas no bucket e tabela, pule login.
  updateAuthUI();

  // Signout handler
  signoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    updateAuthUI();
    alert('Desconectado');
  });

  // Criar post com upload
  createBtn.addEventListener('click', async () => {
    createStatus.textContent = '';
    const file = fileInput.files?.[0];
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title) return alert('Forneça um título.');
    if (!file) return alert('Selecione uma imagem.');

    createBtn.disabled = true;
    createStatus.textContent = 'Enviando imagem...';

    try {
      // Gera file path
      const timestamp = Date.now();
      const ext = file.name.split('.').pop();
      const filePath = `uploads/${timestamp}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Faz upload
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.error('Upload error', uploadError);
        throw uploadError;
      }

      // Tenta obter public URL (apenas se bucket for público)
      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      const imageUrl = publicUrlData?.publicUrl ?? null;

      createStatus.textContent = 'Criando post no banco...';

      // Ajuste o payload conforme os campos exatos da sua tabela 'posts'
      const payload = {
        title,
        content,
        image_url: imageUrl,
        created_at: new Date().toISOString()
      };

      const { data: insertData, error: insertError } = await supabase
        .from(TABLE)
        .insert([payload])
        .select();

      if (insertError) {
        console.error('Insert error', insertError);
        throw insertError;
      }

      createStatus.textContent = 'Post criado com sucesso!';
      titleInput.value = '';
      contentInput.value = '';
      fileInput.value = '';

      await listarPosts(); // atualiza lista

    } catch (err) {
      console.error('Erro ao criar post:', err);
      createStatus.textContent = 'Erro: ' + (err.message ?? JSON.stringify(err));
      alert('Erro: ' + (err.message ?? JSON.stringify(err)));
    } finally {
      createBtn.disabled = false;
    }
  });

  // Listar posts
  async function listarPosts() {
    postsDiv.innerHTML = 'Carregando...';
    try {
      // Ajuste o select conforme colunas reais
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.error('Erro listar posts', error);
        postsDiv.innerHTML = 'Erro ao carregar posts: ' + error.message;
        return;
      }

      if (!data || data.length === 0) {
        postsDiv.innerHTML = '<p>Nenhum post ainda.</p>';
        return;
      }

      postsDiv.innerHTML = '';
      data.forEach(post => {
        const el = document.createElement('div');
        el.className = 'post';
        const img = post.image_url ? `<img src="${post.image_url}" alt="img" style="max-width:200px;display:block" />` : '';
        el.innerHTML = `<h3>${escapeHtml(post.title ?? '')}</h3>${img}<p>${escapeHtml(post.content ?? '')}</p><small>${post.created_at ?? ''}</small>`;
        postsDiv.appendChild(el);
      });
    } catch (err) {
      console.error('Erro ao listar posts:', err);
      postsDiv.innerHTML = 'Erro ao listar posts';
    }
  }

  // Util: escape simples
  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // Refresh button
  refreshBtn.addEventListener('click', listarPosts);

  // Inicial load
  await listarPosts();

  // Observador de auth state (opcional): atualiza UI quando sessão muda
  if (supabase.auth?.onAuthStateChange) {
    supabase.auth.onAuthStateChange(() => {
      updateAuthUI();
    });
  }
}

init().catch(err => {
  console.error('Erro na inicialização do app:', err);
  alert('Falha ao inicializar. Verifique console para detalhes.');
});