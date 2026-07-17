/**
 * IncompletionReportDetail.tsx
 * ────────────────────────────
 * Standalone per-workcell page for the Incompletion Report (reached from the
 * report's workcell list). Just the back button + workcell header around the
 * shared WorkcellIncompletionPanel — the table content lives in that panel,
 * which is also embedded as the "Report" tab on the Cycle Time workcell page.
 *
 * Route: /cycle-time/incompletion/:customer
 */

import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import WorkcellIncompletionPanel from './WorkcellIncompletionPanel';

export default function IncompletionReportDetail() {
  const navigate = useNavigate();
  const { customer = '' } = useParams();
  const logo = getWorkcellLogo(customer);

  return (
    <div className="p-5">
      <button
        onClick={() => navigate('/cycle-time/incompletion')}
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Incompletion Report
      </button>

      <div className="mb-4 flex items-center gap-3">
        {logo && (
          <div
            className="w-24 h-9 rounded border border-border flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ backgroundColor: getWorkcellLogoBg(customer) ?? '#ffffff' }}
          >
            <img src={logo} alt={customer} className="w-full h-full object-contain p-0.5" />
          </div>
        )}
        <h1 className="text-lg font-semibold text-foreground">{customer}</h1>
      </div>

      <WorkcellIncompletionPanel customer={customer} />
    </div>
  );
}
