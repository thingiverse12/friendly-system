import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useRoom } from '../use-room.js';
import { Spinner, SourceBadge, DifficultyBadge, Avatar, Modal, useToast, EmptyState } from '../components/ui.jsx';
import { Icon } from '../components/Layout.jsx';
import { SOURCE_STATUS, EVIDENCE_CATEGORIES, ROOM_MODES } from '../../../shared/constants.js';
import { Interrogation } from './Interrogation.jsx';
import { Board } from './Board.jsx';
import { Accusation } from './Accusation.jsx';
import { Solution } from './Solution.jsx';

const TABS = [
  { id: 'oversikt', label: 'Översikt' },
  { id: 'bevis', label: 'Bevis' },
  { id: 'personer', label: 'Personer' },
  { id: 'tidslinje', label: 'Tidslinje' },
  { id: 'anteckningar', label: 'Anteckningar' },
  { id: 'brada', label: 'Bevisbräda' },
  { id: 'anklagelse', label: 'Slutlig anklagelse' },
];

export function Investigation() {
  const { roomId } = useParams();
  const [search, setSearch] = useSearchParams();
  const tab = search.get('t') || 'oversikt';
  const joinCode = search.get('join');
  const { state, error, refresh } = useRoom(roomId);
  const [joinError, setJoinError] = useState(null);

  // Inbjudningslänk: försök automatiskt att ansluta med rums-koden.
  useEffect(() => {
    if (!joinCode || !error) return;
    let cancelled = false;
    api.post('/rooms/join', { code: joinCode })
      .then(() => !cancelled && refresh())
      .catch((e) => !cancelled && setJoinError(e.message));
    return () => { cancelled = true; };
  }, [joinCode, error, refresh]);
  const [activePerson, setActivePerson] = useState(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const toast = useToast();

  const setTab = (t) => setSearch(t === 'oversikt' ? {} : { t: t });

  if (error) return (
    <div className="stack">
      <div className="alert alert-error">{joinError || error}</div>
      <Link className="btn btn-ghost" to="/multiplayer">Tillbaka till multiplayer</Link>
    </div>
  );
  if (!state) return <Spinner />;

  const { room, case: c, members, discoveredEvidence } = state;
  const cinematic = room.settings?.presentation === 'cinematic';
  const solved = state.canSeeSolution;

  const speak = (text) => {
    if (!cinematic || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'sv-SE';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const copyCode = async () => {
    const link = `${window.location.origin}/rum/${room.id}?join=${room.code}`;
    await navigator.clipboard.writeText(link);
    toast('Inbjudningslänk kopierad', 'success');
  };

  const tabs = [...TABS];
  if (solved) tabs.push({ id: 'losning', label: 'Lösning' });

  return (
    <div className="page">
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <Link to="/hem" className="btn btn-ghost btn-sm" aria-label="Tillbaka">←</Link>
          <h1>{c.title}</h1>
          <DifficultyBadge id={room.difficulty} />
          <span className="badge">{ROOM_MODES[room.mode]}</span>
          {room.status === 'finished' && <span className="badge badge-green">Avslutat</span>}
          <span className="spacer" />
          <button className="btn btn-subtle btn-sm" onClick={() => setHintOpen(true)}><Icon name="search" size={15} /> Ledtråd</button>
          <button className="btn btn-subtle btn-sm" onClick={() => setAssistantOpen(true)}>AI-assistent</button>
          {room.mode !== 'solo' && (
            <button className="btn btn-primary btn-sm" onClick={() => setLobbyOpen(true)}>
              Rum {room.code} · {members.filter((m) => m.status !== 'removed').length}
            </button>
          )}
        </div>
        {room.mode === 'solo' && (
          <div className="panel-body row-wrap small muted" style={{ paddingTop: 10, paddingBottom: 10 }}>
            <span>Rumskod: <strong>{room.code}</strong></span>
            <button className="btn btn-ghost btn-sm" onClick={copyCode}>Kopiera inbjudan</button>
            <span className="spacer" />
            <span>{discoveredEvidence.length}/{c.evidence.length} bevis säkrade</span>
          </div>
        )}
      </div>

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'oversikt' && <Overview state={state} onGo={setTab} speak={speak} />}
      {tab === 'bevis' && <EvidenceTab state={state} refresh={refresh} />}
      {tab === 'personer' && <PersonsTab state={state} onPick={(p) => { setActivePerson(p); setTab('forhor'); }} />}
      {tab === 'tidslinje' && <TimelineTab state={state} />}
      {tab === 'anteckningar' && <NotesTab state={state} refresh={refresh} />}
      {tab === 'brada' && <Board roomState={state} refresh={refresh} />}
      {tab === 'anklagelse' && <Accusation roomState={state} onSolved={() => refresh(true)} goSolution={() => setTab('losning')} />}
      {tab === 'losning' && solved && <Solution roomState={state} />}
      {tab === 'forhor' && activePerson && (
        <Interrogation roomState={state} person={activePerson} cinematic={cinematic} onBack={() => setTab('personer')} />
      )}
      {tab === 'forhor' && !activePerson && <PersonsTab state={state} onPick={(p) => setActivePerson(p)} />}

      {hintOpen && <HintModal roomId={room.id} onClose={() => setHintOpen(false)} />}
      {assistantOpen && <AssistantModal roomId={room.id} onClose={() => setAssistantOpen(false)} />}
      {lobbyOpen && <LobbyModal state={state} refresh={refresh} onClose={() => setLobbyOpen(false)} toast={toast} />}
    </div>
  );
}

function Overview({ state, onGo, speak }) {
  const c = state.case;
  const recent = [...(state.events || [])].reverse().slice(0, 8);
  return (
    <div className="grid builder-grid">
      <div className="stack">
        <div className="card">
          <h2>Bakgrund</h2>
          {c.briefing.map((p, i) => <p key={i} className="small">{p}</p>)}
          {state.room.settings?.presentation === 'cinematic' && (
            <button className="btn btn-subtle btn-sm" onClick={() => speak(c.briefing.join(' '))}>Spela upp berättarröst</button>
          )}
        </div>
        <div className="card">
          <h2>Senaste händelserna</h2>
          {recent.length === 0 ? <p className="faint small">Utredningen har precis börjat.</p> : (
            <div className="stack" style={{ gap: 8 }}>
              {recent.map((e) => (
                <div key={e.seq} className="row small" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">{eventLabel(e.type)}</span>
                  <span className="faint">{new Date(e.createdAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="stack">
        <div className="card">
          <h2>Snabbfakta</h2>
          <dl className="factlist">
            <dt>Typ</dt><dd>{c.caseType.replace('_', ' ')}</dd>
            <dt>Misstänkta</dt><dd>{c.persons.filter((p) => p.kind === 'suspect').length}</dd>
            <dt>Bevis</dt><dd>{state.discoveredEvidence.length} av {c.evidence.length} upptäckta</dd>
            <dt>Kopplingar</dt><dd>{state.connections.length}</dd>
            <dt>Anteckningar</dt><dd>{state.notes.length}</dd>
          </dl>
          <hr className="divider" />
          <div className="stack">
            <button className="btn btn-primary btn-block" onClick={() => onGo('bevis')}><Icon name="grid" size={16} /> Säkra bevis</button>
            <button className="btn btn-subtle btn-block" onClick={() => onGo('personer')}><Icon name="users" size={16} /> Förhör misstänkta</button>
            <button className="btn btn-subtle btn-block" onClick={() => onGo('brada')}><Icon name="pen" size={16} /> Bygg teori på bevisbrädan</button>
          </div>
        </div>
        <SourceLegend />
      </div>
    </div>
  );
}

function SourceLegend() {
  return (
    <div className="card">
      <h2>Källstatus</h2>
      <p className="small faint">En misstänkts påstående är aldrig ett verifierat faktum bara för att det står i ett förhör.</p>
      <div className="row-wrap">
        {Object.values(SOURCE_STATUS).map((s) => <SourceBadge key={s.id} status={s.id} />)}
      </div>
    </div>
  );
}

function EvidenceTab({ state, refresh }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const discover = async (id) => {
    setBusy(id);
    try {
      await api.post(`/rooms/${state.room.id}/evidence/${id}/discover`, {});
      await refresh(true);
      toast('Bevis säkrat och lagt i utredningspärmen', 'success');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(null); }
  };
  return (
    <div className="evidence-grid">
      {state.case.evidence.map((e) => {
        const found = state.discoveredEvidence.includes(e.id);
        return (
          <article key={e.id} className={`card evidence-card ${found ? '' : 'locked'}`}>
            <div className="row-wrap">
              <span className="badge">{EVIDENCE_CATEGORIES[e.category]}</span>
              {found ? <SourceBadge status={e.sourceStatus} /> : <span className="badge">Ej upptäckt</span>}
            </div>
            {found ? (
              <>
                <h3 className="tight">{e.title}</h3>
                <p className="small muted tight">{e.description}</p>
                <p className="faint small tight">Plats: {e.location}</p>
              </>
            ) : (
              <>
                <h3 className="tight faint">Bevis i beslag — oupptäckt</h3>
                <p className="small faint tight">{e.discoverHint}</p>
                <button className="btn btn-primary btn-sm" disabled={busy === e.id} onClick={() => discover(e.id)}>
                  {busy === e.id ? 'Säkrar…' : 'Säkra bevis'}
                </button>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}

function PersonsTab({ state, onPick }) {
  return (
    <div className="stack">
      {state.case.persons.map((p) => (
        <button key={p.personId} className="person-row" style={{ textAlign: 'left', width: '100%' }} onClick={() => onPick(p)}>
          <Avatar name={p.name} initials={p.initials} color={p.color} size="lg" />
          <div style={{ flex: 1 }}>
            <span className="kind-tag">{p.kind === 'suspect' ? 'Misstänkt' : p.kind === 'witness' ? 'Vittne' : 'Offer'}</span>
            <h3 className="tight">{p.name}, {p.age}</h3>
            <p className="small muted tight">{p.roleTitle} · {p.publicProfile?.relationer}</p>
          </div>
          <span className="faint">Förhör →</span>
        </button>
      ))}
    </div>
  );
}

function TimelineTab({ state }) {
  return (
    <div className="card">
      <h2>Händelsetidslinje</h2>
      <div className="timeline" style={{ marginTop: 14 }}>
        {state.case.events.map((e) => (
          <div key={e.id} className={`tl-item kind-${e.kind}`}>
            <span className="tl-time">{e.time}</span>
            <h3 className="tight" style={{ display: 'inline', marginLeft: 8 }}>{e.label}</h3>
            <p className="small muted tight" style={{ marginTop: 4 }}>{e.detail}</p>
            <span className={`badge ${e.kind === 'confirmed' ? 'badge-green' : e.kind === 'uncertain' ? 'badge-purple' : 'badge-blue'}`} style={{ marginTop: 6 }}>
              {e.kind === 'confirmed' ? 'Bekräftad' : e.kind === 'claimed' ? 'Uppgift från person' : 'Osäker'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const NOTE_KINDS = [
  { id: 'note', label: 'Anteckning' },
  { id: 'theory', label: 'Teori' },
  { id: 'question', label: 'Fråga att undersöka' },
  { id: 'contradiction', label: 'Motsägelse' },
];

function NotesTab({ state, refresh }) {
  const toast = useToast();
  const [content, setContent] = useState('');
  const [kind, setKind] = useState('note');
  const room = state.room;
  const save = async () => {
    if (!content.trim()) return;
    await api.post(`/rooms/${room.id}/notes`, { content, kind });
    setContent('');
    await refresh(true);
    toast('Anteckning sparad', 'success');
  };
  const remove = async (id) => { await api.del(`/rooms/${room.id}/notes/${id}`); refresh(true); };
  return (
    <div className="grid builder-grid">
      <div className="card stack">
        <h2>{room.mode === 'competitive' ? 'Dina privata anteckningar' : 'Delade utredningsanteckningar'}</h2>
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Anteckningstyp">
          {NOTE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <textarea className="textarea" placeholder="Dina teorier, frågor och motsägelser…" value={content} onChange={(e) => setContent(e.target.value)} />
        <button className="btn btn-primary" onClick={save}>Spara</button>
      </div>
      <div className="stack">
        {state.notes.length === 0 && <EmptyState title="Inga anteckningar ännu">Bevisbrädan fångar kopplingar – hit skriver du resonemangen.</EmptyState>}
        {state.notes.map((n) => (
          <div key={n.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="badge badge-blue">{NOTE_KINDS.find((k) => k.id === n.kind)?.label || n.kind}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(n.id)} aria-label="Ta bort">✕</button>
            </div>
            <p className="small tight" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{n.content}</p>
            <p className="faint small tight" style={{ marginTop: 6 }}>{new Date(n.created_at).toLocaleString('sv-SE')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HintModal({ roomId, onClose }) {
  const [level, setLevel] = useState(1);
  const [hint, setHint] = useState(null);
  const request = async (l) => {
    setLevel(l);
    const d = await api.post(`/rooms/${roomId}/hints`, { level: l });
    setHint(d.hint);
  };
  return (
    <Modal title="Ledtrådssystem – tre nivåer" onClose={onClose}>
      <p className="muted small">Nivå 1 riktar uppmärksamheten, nivå 2 pekar på ett samband, nivå 3 ger konkret vägledning – men aldrig hela facit. I tävlingsläge kostar ledtrådar poäng.</p>
      <div className="row-wrap" style={{ marginBottom: 14 }}>
        {[1, 2, 3].map((l) => (
          <button key={l} className={`btn btn-sm ${level === l ? 'btn-primary' : 'btn-ghost'}`} onClick={() => request(l)}>Nivå {l}</button>
        ))}
      </div>
      {hint && <div className="alert alert-info">{hint}</div>}
    </Modal>
  );
}

function AssistantModal({ roomId, onClose }) {
  const [reply, setReply] = useState(null);
  const ask = async () => {
    const d = await api.post(`/rooms/${roomId}/assistant`, {});
    setReply(d.answer);
  };
  return (
    <Modal title="AI-utredningsassistent" onClose={onClose}>
      <p className="muted small">Assistenten ser bara de bevis du själv upptäckt. Den kan hjälpa dig att tänja – men aldrig avslöja hemliga fakta eller hitta på bevis.</p>
      <button className="btn btn-primary" onClick={ask}>Analysera mina upptäckta bevis</button>
      {reply && <div className="alert alert-info" style={{ marginTop: 14, whiteSpace: 'pre-wrap' }}>{reply}</div>}
    </Modal>
  );
}

function LobbyModal({ state, refresh, onClose, toast }) {
  const room = state.room;
  const isHost = state.membership.role === 'host';
  const link = `${window.location.origin}/rum/${room.id}?join=${room.code}`;
  const kick = async (userId) => {
    await api.post(`/rooms/${room.id}/kick`, { userId });
    await refresh(true);
    toast('Spelaren borttagen', 'success');
  };
  return (
    <Modal title={`Multiplayer – ${ROOM_MODES[room.mode]}`} onClose={onClose} wide>
      <div className="accusation-summary" style={{ marginBottom: 14 }}>
        <p className="faint small tight">Rumskod (privat rum)</p>
        <div className="row">
          <span className="lobby-code">{room.code}</span>
          <button className="btn btn-subtle btn-sm" onClick={async () => { await navigator.clipboard.writeText(link); toast('Länk kopierad', 'success'); }}>Kopiera inbjudningslänk</button>
        </div>
        <p className="faint small" style={{ marginTop: 8 }}>
          {room.mode === 'competitive'
            ? 'Tävlingsläge: egna teorier och anklagelser är hemliga tills det gemensamma avslöjandet.'
            : 'Samarbetsläge: bevis, kopplingar och anteckningar delas mellan alla i rummet.'}
        </p>
      </div>
      <h3>Spelare ({state.members.filter((m) => m.status !== 'removed').length})</h3>
      <div className="member-list">
        {state.members.filter((m) => m.status !== 'removed').map((m) => (
          <div key={m.userId} className="member-item">
            <Avatar name={m.displayName} initials={m.displayName.split(' ').map((w) => w[0]).slice(0, 2).join('')} color="#33414f" size="sm" />
            <strong>{m.displayName}</strong>
            {m.memberRole === 'host' && <span className="badge badge-red">Värd</span>}
            <span className="spacer" />
            <span className="row small">
              <span className={`dot ${m.status === 'active' ? 'dot-green' : 'dot-muted'}`} />
              {m.status === 'active' ? 'Uppkopplad' : 'Offline'}
            </span>
            {isHost && m.userId !== room.hostId && <button className="btn btn-danger btn-sm" onClick={() => kick(m.userId)}>Ta bort</button>}
          </div>
        ))}
      </div>
      {state.scores?.length > 0 && (
        <>
          <hr className="divider" />
          <h3>Poängställning</h3>
          {state.scores.map((s) => (
            <div key={s.user_id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{s.display_name}</span><strong>{s.total} p</strong>
            </div>
          ))}
        </>
      )}
      {isHost && (
        <>
          <hr className="divider" />
          <button className="btn btn-danger btn-sm" onClick={async () => { await api.post(`/rooms/${room.id}/close`, {}); onClose(); }}>Stäng rum</button>
        </>
      )}
    </Modal>
  );
}

function eventLabel(type) {
  const map = {
    'room.created': 'Rummet skapades',
    'member.joined': 'En spelare anslöt',
    'member.reconnected': 'Spelare återansluten',
    'member.removed': 'Spelare borttagen',
    'evidence.discovered': 'Nytt bevis säkrat',
    'connection.created': 'Ny koppling på bevisbrädan',
    'note.created': 'Ny anteckning',
    'hint.requested': 'Ledtråd användes',
    'interrogation.message': 'Nytt förhörssvar',
    'accusation.submitted': 'Anklagelse inlämnad',
    'solution.revealed': 'Lösningen avslöjad',
  };
  return map[type] || type;
}
