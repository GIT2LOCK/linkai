import { useEffect } from 'react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { LineChart as LineChartIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { callBackend } from '../services/backend';
import type { IndicadorConstrucao, PainelIndicadores } from '../types/backend';
import { useAsyncAction } from '../hooks/useAsyncAction';

function formatarValor(valor: number, unidade: string | null): string {
  // Valores monetarios (R$) sempre mostram as duas casas decimais, mesmo com zero a direita
  // (ex: 5,10 em vez de 5,1). Os demais indicadores continuam sem casas forcadas.
  const ehMonetario = unidade === 'R$';
  const valorFormatado = valor.toLocaleString('pt-BR', {
    minimumFractionDigits: ehMonetario ? 2 : 0,
    maximumFractionDigits: 2
  });
  return unidade ? `${valorFormatado} ${unidade}` : valorFormatado;
}

function formatarVariacao(variacao: number | null, sufixo: string | null): string {
  if (variacao === null || sufixo === null) {
    return 'Sem histórico suficiente';
  }

  const sinal = variacao > 0 ? '+' : '';
  return `${sinal}${variacao.toFixed(2)} ${sufixo}`;
}

function VariacaoIndicador({ variacao, sufixo }: { variacao: number | null; sufixo: string | null }) {
  if (variacao === null || sufixo === null) {
    return <span className="indicador-variacao neutra">{formatarVariacao(variacao, sufixo)}</span>;
  }

  const emAlta = variacao >= 0;

  return (
    <span className={`indicador-variacao ${emAlta ? 'alta' : 'baixa'}`}>
      {emAlta ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      {formatarVariacao(variacao, sufixo)}
    </span>
  );
}

function MiniGrafico({ indicador }: { indicador: IndicadorConstrucao }) {
  if (indicador.historico.length < 2) {
    return <span className="indicador-sem-grafico">Sem série suficiente para o gráfico</span>;
  }

  const emAlta = (indicador.variacao ?? 0) >= 0;

  return (
    <div className="indicador-mini-grafico">
      <ResponsiveContainer height={34} width="100%">
        <LineChart data={indicador.historico}>
          <Line
            dataKey="valor"
            dot={false}
            isAnimationActive={false}
            stroke={emAlta ? 'var(--success)' : 'var(--danger)'}
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function IndicadorCard({ indicador }: { indicador: IndicadorConstrucao }) {
  return (
    <div className="indicador-card">
      <div className="indicador-card-header">
        <span className="indicador-nome">{indicador.nome}</span>
        {indicador.fonte === 'Manual' ? <span className="badge-manual">Atualização manual</span> : null}
      </div>
      <strong className="indicador-valor">{formatarValor(indicador.valor, indicador.unidade)}</strong>
      <VariacaoIndicador sufixo={indicador.variacaoSufixo} variacao={indicador.variacao} />
      <MiniGrafico indicador={indicador} />
    </div>
  );
}

export function IndicadoresConstrucao() {
  const action = useAsyncAction(() => callBackend<PainelIndicadores>('indicadores.painel'));

  useEffect(() => {
    action.run().catch(() => undefined);
  }, [action.run]);

  const indicadores = action.data?.indicadores ?? [];

  return (
    <div className="content-band indicadores-panel">
      <LineChartIcon size={22} />
      <h3>Indicadores de mercado</h3>

      {action.error ? <div className="alert danger">{action.error}</div> : null}

      {action.loading ? (
        <p>Carregando indicadores.</p>
      ) : indicadores.length === 0 ? (
        <p>Nenhum indicador coletado até o momento.</p>
      ) : (
        <div className="indicadores-grid">
          {indicadores.map((indicador) => (
            <IndicadorCard indicador={indicador} key={indicador.codigo} />
          ))}
        </div>
      )}
    </div>
  );
}
