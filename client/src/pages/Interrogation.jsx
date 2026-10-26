import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Avatar, useToast } from '../components/ui.jsx';
import { EVIDENCE_CATEGORIES } from '../../../shared/constants.js';

// Förhör med tre metoder: fri fråga, föreslagna frågor och beviskonfrontation.
export function Interrogation({ roomState, person, onBack, cinematic }) {
  const toast = useToast();
  const roomId = roomState.room.id;
  const [transcript, setTranscript] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [showEvidencePicker, setShowEvidencePicker] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get(`/rooms/${roomId}/interrogations`).then((d) => {
      const mine = d.interrogations.find((i) => i.suspectId === person.personId);
      setTranscript(mine?.messages || []);
    });
  }, [roomId, person.personId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);

  const speak = (text) => {
    if (!cinematic || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'sv-SE';
    window.speechSynthesis.speak(u);
  };

  const ask = async (q, evidenceId = null) => {
    if (busy || (!q?.trim() && !evidenceId)) return;
    setBusy(true);
    try {
      const d = await api.post(`/rooms/${roomId}/interrogations`, { suspectId: person.personId, question: q, evidenceId });
      const ts = new Date().toISOString();
      setTranscript((t) => [
        ...t,
        ...(q?.trim() ? [{ id: `p${ts}`, role: 'player', content: q, evidenceId }] : []),
        { id: `s${ts}`, role: 'suspect', content: d.answer, evidenceId, source: d.source },
      ]);
      setQuestion(''); setShowEvidencePicker(false);
      speak(d.answer);
      if (d.source === 'validated_fallback') toast('Förhöret gav inget nytt – formulera om eller välj en föreslagen fråga.', 'info');
    } catch (err) {
      toast(err.message, 'error');
    } finally { setBusy(false); }
  };

  const discoveredEvidence = roomState.case.evidence.filter((e) => roomState.discoveredEvidence.includes(e.id));

  return (
    <div className="interrogation-layout">
      <aside className="panel">
        <div className="panel-body stack">
          <div className="row">
            <Avatar name={person.name} initials={person.initials} color={person.color} size="lg" />
            <div>
              <h2 className="tight">{person.name}</h2>
              <p className="faint small tight">{person.age} år · {person.roleTitle}</p>
              <span className="kind-tag">{person.kind === 'suspect' ? 'Misstänkt' : person.kind === 'witness' ? 'Vittne' : 'Offer'}</span>
            </div>
          </div>
          <p className="small muted">{person.publicProfile?.bakgrund}</p>
          <div>
            <h3>Föreslagna frågor</h3>
            <div className="suggested">
              {(person.suggestedQuestions || []).length === 0 && (
                <p className="faint small">Inga förberedda frågor.</p>
              )}
              {(person.suggestedQuestions || []).map((q) => (
                <button key={q} className="btn btn-subtle btn-sm" disabled={busy} onClick={() => ask(q)}>{q}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Tillbaka till utredningen</button>
        </div>
      </aside>

      <section className="panel">
        <div className="panel-head">
          <h2>Förhör</h2>
          <span className="spacer" />
          <button className="btn btn-subtle btn-sm" onClick={() => setShowEvidencePicker((v) => !v)}
            disabled={discoveredEvidence.length === 0}>
            Konfrontera med bevis
          </button>
        </div>
        <div className="panel-body">
          {showEvidencePicker && (
            <div className="alert alert-info" style={{ marginBottom: 14 }}>
              <strong>Välj bevis att konfrontera med:</strong>
              <div className="row-wrap" style={{ marginTop: 8 }}>
                {discoveredEvidence.map((e) => (
                  <button key={e.id} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => ask(question || `Vad säger du om: ${e.title}?`, e.id)}>
                    {e.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="chat" aria-live="polite">
            {transcript.length === 0 && (
              <div className="msg msg-system">Förhöret inlett. Ställ en fråga eller välj en föreslagen fråga. Svaren bygger på den låsta fallmodellen – inga fakta ändras under vägen.</div>
            )}
            {transcript.map((m) => (
              <div key={m.id} className={`msg msg-${m.role}`}>
                {m.evidenceId && m.role === 'player' && (
                  <span className="badge badge-amber" style={{ marginBottom: 6 }}>Bevis: {EVIDENCE_CATEGORIES[roomState.case.evidence.find((e) => e.id === m.evidenceId)?.category] || ''}</span>
                )}
                <div>{m.content}</div>
              </div>
            ))}
            {busy && <div className="msg msg-suspect faint">…</div>}
            <div ref={bottomRef} />
          </div>
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
            <input className="input" placeholder="Ställ en fri fråga…" aria-label="Skriv din fråga"
              value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={600} />
            <button className="btn btn-primary" disabled={busy || !question.trim()}>Skicka</button>
          </form>
        </div>
      </section>
    </div>
  );
}
