import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { CaseImage, DifficultyBadge, Stars, Spinner, useToast, Modal, SourceBadge } from '../components/ui.jsx';
import { CASE_TYPES, ENVIRONMENTS, EVIDENCE_CATEGORIES } from '../../../shared/constants.js';

export function CaseDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [rating, setRating] = useState(null);
  const [comments, setComments] = useState([]);
  const [showSpoilers, setShowSpoilers] = useState({});
  const [comment, setComment] = useState({ content: '', spoiler: false });
  const [reportOpen, setReportOpen] = useState(false);
  const [commentReport, setCommentReport] = useState(null);

  const load = () => {
    api.get(`/cases/${caseId}`).then((d) => setData(d.case));
    api.get(`/community/cases/${caseId}/rating`).then((d) => setRating(d));
    api.get(`/community/cases/${caseId}/comments`).then((d) => setComments(d.comments));
  };
  useEffect(load, [caseId]);

  if (!data) return <Spinner />;

  const start = async (mode) => {
    const room = await api.post('/rooms', {
      caseId, mode, scoreSystem: mode === 'competitive' ? 'competitive' : 'realistic',
      guessLimit: 0, hintRules: 'on', difficulty: data.difficulty, presentation: 'text',
    });
    navigate(`/rum/${room.room.id}`);
  };

  const rate = async (score) => {
    const d = await api.post(`/community/cases/${caseId}/rating`, { score });
    setRating((r) => ({ ...r, myRating: score, ...d }));
    toast('Betyg sparat', 'success');
  };

  const toggleFav = async () => {
    await api.post(`/community/cases/${caseId}/favorite`, {});
    toast('Sparad som favorit', 'success');
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!comment.content.trim()) return;
    await api.post(`/community/cases/${caseId}/comments`, comment);
    setComment({ content: '', spoiler: false });
    load();
  };

  return (
    <div className="page">
      <Link to="/katalog" className="small">← Till katalogen</Link>
      <div className="grid builder-grid" style={{ marginTop: 14 }}>
        <div>
          <CaseImage src={data.image} title={data.title} className="" style={{ borderRadius: 14, height: 280 }} />
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Om fallet</h2>
            <p className="muted">{data.intro}</p>
            {data.briefing.map((p, i) => <p key={i} className="small">{p}</p>)}
            <hr className="divider" />
            <dl className="factlist">
              <dt>Falltyp</dt><dd>{CASE_TYPES[data.caseType]}</dd>
              <dt>Miljö</dt><dd>{ENVIRONMENTS[data.environment]}</dd>
              <dt>Svårighetsgrad</dt><dd><DifficultyBadge id={data.difficulty} /></dd>
              <dt>Speltid</dt><dd>ca {data.playtimeMin} minuter</dd>
              <dt>Misstänkta</dt><dd>{data.persons.filter((p) => p.kind === 'suspect').length}</dd>
              <dt>Bevis att upptäcka</dt><dd>{data.evidence.length}</dd>
            </dl>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Beviskategorier som ingår</h2>
            <div className="row-wrap">
              {[...new Set(data.evidence.map((e) => e.category))].map((c) => (
                <span key={c} className="badge">{EVIDENCE_CATEGORIES[c]}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="row-wrap">
              {data.official && <span className="badge badge-blue">Officiellt</span>}
              <DifficultyBadge id={data.difficulty} />
              <Stars value={rating?.ratingAvg} count={rating?.ratingCount} />
            </div>
            <h1 style={{ margin: '10px 0' }}>{data.title}</h1>
            <p className="faint small">Version {data.version} · {data.locked ? 'versionslåst' : 'utkast'}</p>
            <hr className="divider" />
            <div className="stack">
              <button className="btn btn-primary btn-block" onClick={() => start('solo')}>Starta enspelarutredning</button>
              <button className="btn btn-subtle btn-block" onClick={() => start('cooperative')}>Skapa samarbetsrum</button>
              <button className="btn btn-subtle btn-block" onClick={() => start('competitive')}>Skapa tävlingsrum</button>
              <button className="btn btn-ghost btn-block" onClick={toggleFav}>Spara som favorit</button>
            </div>
            <hr className="divider" />
            <h3>Sätt ditt betyg</h3>
            <div className="row" role="group" aria-label="Betyg">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={`btn btn-sm ${rating?.myRating >= n ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => rate(n)} aria-label={`${n} stjärnor`}>★</button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 className="tight">Kommentarer</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setReportOpen(true)}>Rapportera fall</button>
            </div>
            <form onSubmit={postComment} style={{ margin: '12px 0' }}>
              <textarea className="textarea" maxLength={1000} placeholder="Spoilerfria kommentarer uppskattas. Markera spoilers explicit."
                value={comment.content} onChange={(e) => setComment({ ...comment, content: e.target.value })} />
              <label className="row small muted" style={{ margin: '8px 0' }}>
                <input type="checkbox" checked={comment.spoiler} onChange={(e) => setComment({ ...comment, spoiler: e.target.checked })} />
                Innehåller spoilers
              </label>
              <button className="btn btn-primary btn-sm">Publicera kommentar</button>
            </form>
            <div className="stack">
              {comments.length === 0 && <p className="faint small">Inga kommentarer ännu.</p>}
              {comments.map((c) => (
                <div key={c.id} className="finding" style={{ margin: 0 }}>
                  <div className="row small" style={{ justifyContent: 'space-between' }}>
                    <strong>{c.display_name || c.displayName}</strong>
                    <span className="row">
                      <span className="faint">{new Date(c.created_at || c.createdAt).toLocaleDateString('sv-SE')}</span>
                      {!c.hidden && (
                        <button className="btn btn-ghost btn-sm" aria-label="Rapportera kommentar"
                          onClick={() => setCommentReport(c.id)}>Rapportera</button>
                      )}
                    </span>
                  </div>
                  {c.spoiler && !showSpoilers[c.id] ? (
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }}
                      onClick={() => setShowSpoilers((s) => ({ ...s, [c.id]: true }))}>Visa spoilerkommentar</button>
                  ) : (
                    <p className="small tight" style={{ marginTop: 6 }}>{c.content}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {reportOpen && (
        <Modal title="Rapportera fall" onClose={() => setReportOpen(false)}>
          <ReportForm targetType="case" targetId={caseId} onDone={() => { setReportOpen(false); toast('Rapport inskickad till moderatorer', 'success'); }} />
        </Modal>
      )}
      {commentReport && (
        <Modal title="Rapportera kommentar" onClose={() => setCommentReport(null)}>
          <ReportForm targetType="comment" targetId={commentReport} onDone={() => { setCommentReport(null); toast('Rapport inskickad', 'success'); }} />
        </Modal>
      )}
    </div>
  );
}

export function ReportForm({ targetType, targetId, onDone }) {
  const [reason, setReason] = useState('');
  return (
    <form onSubmit={async (e) => { e.preventDefault(); await api.post('/community/reports', { targetType, targetId, reason }); onDone(); }}>
      <div className="field">
        <label htmlFor="reason">Anledning</label>
        <textarea id="reason" className="textarea" required value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Beskriv problemet, t.ex. olämpligt innehåll, felaktiga fakta eller försök till promptinjektion." />
      </div>
      <button className="btn btn-primary">Skicka rapport</button>
    </form>
  );
}
