import { useEffect } from 'react';
import { ArrowUpRight, Building2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { callBackend } from '../services/backend';
import type { CurrencyQuote, HomeOverview, MarketQuote, WorkUpdate } from '../types/backend';
import { useAsyncAction } from '../hooks/useAsyncAction';

export function HomePage() {
  const overview = useAsyncAction(() => callBackend<HomeOverview>('home.overview'));

  useEffect(() => {
    overview.run().catch(() => undefined);
  }, [overview.run]);

  const data = overview.data;

  return (
    <div className="page-stack home-page">
      <SectionHeader
        title="Página Inicial"
        description="Radar executivo com obras da Linka Engenharia, construtoras da B3 e moedas contra o real."
        actions={
          <button className="button secondary" disabled={overview.loading} onClick={() => overview.run()} type="button">
            <RefreshCw size={16} />
            Atualizar
          </button>
        }
      />

      {overview.error ? <div className="alert danger">{overview.error}</div> : null}

      <div className="home-layout">
        <div className="home-main-column">
          <section className="home-hero">
            <div>
              <span className="home-hero-kicker">Linka Engenharia</span>
              <h2>Obras, mercado e câmbio em um único painel.</h2>
              <p>
                Acompanhe as atualizações relevantes da operação e indicadores financeiros
                que ajudam na leitura do setor de construção.
              </p>
            </div>
            <div className="home-hero-meta">
              <span>Atualizado</span>
              <strong>{data ? formatDate(data.updatedAt) : 'carregando'}</strong>
            </div>
          </section>

          <section className="home-section">
            <div className="home-section-heading">
              <div>
                <span>Obras Linka</span>
                <h3>Principais notícias e atualizações</h3>
              </div>
              <Building2 size={20} />
            </div>

            <div className="work-grid">
              {(data?.workUpdates ?? placeholderWorks).map((item) => (
                <WorkCard item={item} key={item.title} />
              ))}
            </div>
          </section>

          <section className="home-section">
            <div className="home-section-heading">
              <div>
                <span>Mercado B3</span>
                <h3>Construtoras e incorporadoras</h3>
              </div>
              <TrendingUp size={20} />
            </div>

            <div className="market-grid">
              {(data?.marketQuotes ?? placeholderStocks).map((item) => (
                <MarketCard item={item} key={item.symbol} />
              ))}
            </div>
          </section>
        </div>

        <aside className="currency-rail">
          <div className="home-section-heading compact">
            <div>
              <span>Câmbio</span>
              <h3>Moedas vs BRL</h3>
            </div>
          </div>

          <div className="currency-list">
            {(data?.currencyQuotes ?? placeholderCurrencies).map((item) => (
              <CurrencyRow item={item} key={item.code} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function WorkCard({ item }: { item: WorkUpdate }) {
  return (
    <article className="work-card">
      <div className="work-card-top">
        <span>{item.category}</span>
        {item.progress !== null ? <strong>{item.progress}%</strong> : null}
      </div>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      <div className="work-meta">{item.meta}</div>
      {item.progress !== null ? (
        <div className="progress-track" aria-label={`Progresso ${item.progress}%`}>
          <span style={{ width: `${item.progress}%` }} />
        </div>
      ) : null}
      <a className="source-link" href={item.source_url} rel="noreferrer" target="_blank">
        Fonte
        <ArrowUpRight size={14} />
      </a>
    </article>
  );
}

function MarketCard({ item }: { item: MarketQuote }) {
  const positive = (item.change_percent ?? 0) >= 0;

  return (
    <article className="market-card">
      <div className="market-symbol">
        <span>{item.symbol}</span>
        {positive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
      </div>
      <strong>{formatMoney(item.price, item.currency)}</strong>
      <small>{item.name}</small>
      <div className={positive ? 'quote-change positive' : 'quote-change negative'}>
        {formatPercent(item.change_percent)}
      </div>
    </article>
  );
}

function CurrencyRow({ item }: { item: CurrencyQuote }) {
  const positive = (item.change_percent ?? 0) >= 0;

  return (
    <div className="currency-row">
      <div>
        <strong>{item.code}</strong>
        <span>{item.name}</span>
      </div>
      <div>
        <strong>{formatMoney(item.bid, 'BRL')}</strong>
        <span className={positive ? 'quote-change positive' : 'quote-change negative'}>
          {formatPercent(item.change_percent)}
        </span>
      </div>
    </div>
  );
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) {
    return '-';
  }

  return new Intl.NumberFormat('pt-BR', {
    currency,
    maximumFractionDigits: currency === 'BRL' ? 2 : 4,
    minimumFractionDigits: 2,
    style: 'currency'
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return '-';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

const placeholderWorks: WorkUpdate[] = [
  {
    category: 'Carregando',
    meta: 'Aguardando backend',
    progress: null,
    source_url: 'https://linka.eng.br/obras/',
    summary: 'Buscando atualizações de obras da Linka Engenharia.',
    title: 'Atualizações de obras'
  }
];

const placeholderStocks: MarketQuote[] = [
  {
    change_percent: null,
    currency: 'BRL',
    name: 'Aguardando mercado',
    price: null,
    source: 'loading',
    symbol: 'B3'
  }
];

const placeholderCurrencies: CurrencyQuote[] = [
  {
    bid: null,
    change_percent: null,
    code: 'BRL',
    name: 'Aguardando cotações',
    source: 'loading'
  }
];
