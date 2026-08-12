import { IndicadoresConstrucao } from '../components/IndicadoresConstrucao';
import { NoticiasConstrucao } from '../components/NoticiasConstrucao';

export function ConstrucaoCivilPage() {
  return (
    <div className="page-stack">
      <div className="construcao-civil-grid">
        <NoticiasConstrucao />
        <IndicadoresConstrucao />
      </div>
    </div>
  );
}
