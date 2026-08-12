import { useEffect } from 'react';
import { Newspaper } from 'lucide-react';
import { callBackend } from '../services/backend';
import type { NoticiaConstrucao } from '../types/backend';
import { useAsyncAction } from '../hooks/useAsyncAction';

function formatarData(dataIso: string | null): string {
  if (!dataIso) {
    return 'Sem data';
  }

  return new Date(dataIso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function NoticiasConstrucao() {
  const action = useAsyncAction(() =>
    callBackend<NoticiaConstrucao[]>('noticias.recentes', { limite: 6 })
  );

  useEffect(() => {
    action.run().catch(() => undefined);
  }, [action.run]);

  const noticias = action.data ?? [];

  return (
    <div className="content-band">
      <Newspaper size={22} />
      <h3>Notícias de construção civil</h3>

      {action.error ? <div className="alert danger">{action.error}</div> : null}

      {action.loading ? (
        <p>Carregando notícias recentes.</p>
      ) : noticias.length === 0 ? (
        <p>Nenhuma notícia coletada até o momento.</p>
      ) : (
        <div className="noticias-grid">
          {noticias.map((noticia) => (
            <a
              className="noticia-card"
              href={noticia.url}
              key={noticia.url}
              rel="noreferrer"
              target="_blank"
            >
              <span className="noticia-fonte">{noticia.fonte}</span>
              <strong>{noticia.titulo}</strong>
              {noticia.resumo ? <p>{noticia.resumo}</p> : null}
              <span className="noticia-data">{formatarData(noticia.dataPublicacao)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
