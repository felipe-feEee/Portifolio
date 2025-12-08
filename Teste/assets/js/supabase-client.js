// Singleton de inicialização do Supabase para browser (GitHub Pages)
// Substitua SUPABASE_URL e SUPABASE_ANON_KEY com seus valores.
const SUPABASE_URL = 'https://pwshckrmqaqymngbosgo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c2hja3JtcWFxeW1uZ2Jvc2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjAwOTEsImV4cCI6MjA3OTkzNjA5MX0.f8iX0RoqrdxJmq-EgSyn_YWPgCHMoARQTT4ygtbcoLg';
const BUCKET = 'images';
const TABLE = 'posts';

// CDN URL do bundle UMD/browser-ready. Se falhar, veja nota abaixo sobre npm/bundler.
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.33.0/dist/umd/supabase.js';

let _supabase = null;

// Inicializa e retorna o singleton supabase
export async function getSupabaseClient() {
  if (_supabase) return _supabase;

  try {
    const mod = await import(/* @vite-ignore */ SUPABASE_CDN);
    // Algumas builds expõem functions em lugares diferentes; tentamos várias possibilidades.
    const createClient =
      mod?.createClient ??
      mod?.default?.createClient ??
      window?.supabase?.createClient ??
      window?.Supabase?.createClient;

    if (!createClient) {
      console.error('createClient não encontrado no módulo importado:', mod);
      throw new Error('SDK Supabase CDN incompatível no ambiente atual. Use npm + bundler se necessário.');
    }

    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      // Ajuste de timeout/headers pode ser feito aqui se necessário
    });

    // Substitua window para facilitar debug no console
    window._supabase = _supabase;
    console.info('Supabase inicializado (singleton).');

    return _supabase;
  } catch (err) {
    console.error('Erro ao importar/init Supabase via CDN:', err);
    throw err;
  }
}

// Helpers públicos
export function getConfig() {
  return { SUPABASE_URL, BUCKET, TABLE };
}