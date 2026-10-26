import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { Spinner, useToast, Modal } from '../components/ui.jsx';
import { ReportForm } from './CaseDetail.jsx';

export function Moderation() {
  const toast = useToast();
  const [reports, setReports] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);

  const load = useCallback(() => {
    api.get('/community/moderation/reports').then((d) => setReports(d.reports)).catch((e) => setReports({ error: e.message }));
  }, []);
  useEffect(load, []);

  const act = async (action, targetType, targetId) => {
    await api.post('/community/moderation/action', { action, targetType, targetId });
    toast('Åtgärd utförd', 'success');
    load();
  };

  if (!reports) return <Spinner />;
  if (reports.error) return <div className="alert alert-error">{reports.error}. Denna sida kräver moderator- eller adminroll.</div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Moderering</h1>
          <p>Öppna rapporter från spelare. Åtgärder loggas och påverkar publicerat innehåll direkt.</p>
        </div>
      </div>
      {reports.length === 0 ? (
        <div className="card empty-state"><h3>Inga öppna rapporter</h3></div>
      ) : (
        <div className="stack">
          {reports.map((r) => (
            <div key={r.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{r.target_type === 'case' ? 'Fall' : r.target_type === 'comment' ? 'Kommentar' : 'Användare'}: {r.target_id}</strong>
                <span className="faint small">{new Date(r.created_at).toLocaleString('sv-SE')}</span>
              </div>
              <p className="small muted" style={{ margin: '8px 0' }}>{r.reason}</p>
              <div className="row-wrap">
                {r.target_type === 'comment' && <button className="btn btn-primary btn-sm" onClick={() => act('hide_comment', 'comment', r.target_id)}>Dölj kommentar</button>}
                {r.target_type === 'case' && <button className="btn btn-danger btn-sm" onClick={() => act('unpublish_case', 'case', r.target_id)}>Avpublicera fall</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => act('dismiss_report', 'report', r.id)}>Avfärda rapport</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {reportTarget && (
        <Modal title="Rapportera" onClose={() => setReportTarget(null)}>
          <ReportForm targetType={reportTarget.type} targetId={reportTarget.id}
            onDone={() => { setReportTarget(null); toast('Rapport inskickad', 'success'); }} />
        </Modal>
      )}
    </div>
  );
}
