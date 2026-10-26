import { useMemo, useState, useEffect } from 'react';
import { api } from '../api.js';
import { ConnectionBadge, useToast } from '../components/ui.jsx';
import { CONNECTION_TYPES } from '../../../shared/constants.js';

const TYPE_META = {
  person: { label: 'Person', color: '#6aa9ff' },
  evidence: { label: 'Bevis', color: '#f5a623' },
  event: { label: 'Händelse', color: '#b07bd8' },
  place: { label: 'Plats', color: '#3fbf6f' },
};

function defaultPositions(nodes, width) {
  const cols = Math.max(2, Math.floor(width / 190));
  const pos = {};
  nodes.forEach((n, i) => {
    pos[n.id] = { x: 24 + (i % cols) * 180, y: 24 + Math.floor(i / cols) * 150 };
  });
  return pos;
}

// Interaktiv bevisbräda. Kopplingar klassas av servern mot den låsta modellen.
export function Board({ roomState, refresh }) {
  const toast = useToast();
  const roomId = roomState.room.id;
  const [selected, setSelected] = useState(null);
  const [motivation, setMotivation] = useState('');
  const [width, setWidth] = useState(900);
  const storageKey = `board-pos-${roomId}`;

  const nodes = useMemo(() => {
    const c = roomState.case;
    return [
      ...c.persons.map((p) => ({ id: `person:${p.personId}`, kind: 'person', title: p.name, sub: p.roleTitle })),
      ...c.evidence.filter((e) => roomState.discoveredEvidence.includes(e.id)).map((e) => ({ id: `evidence:${e.id}`, kind: 'evidence', title: e.title, sub: e.location })),
      ...c.events.map((e) => ({ id: `event:${e.id}`, kind: 'event', title: e.label, sub: e.time })),
      ...c.locations.map((l) => ({ id: `place:${l.id}`, kind: 'place', title: l.name, sub: 'Plats' })),
    ];
  }, [roomState]);

  const [positions, setPositions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || null; } catch { return null; }
  });

  useEffect(() => {
    const el = document.querySelector('.board-wrap');
    if (el) setWidth(el.clientWidth);
  }, []);

  useEffect(() => {
    if (!positions && nodes.length) setPositions(defaultPositions(nodes, width));
  }, [nodes, positions, width]);

  useEffect(() => { if (positions) localStorage.setItem(storageKey, JSON.stringify(positions)); }, [positions, storageKey]);

  const connections = roomState.connections || [];

  const onNodeClick = (nodeId) => {
    if (!selected) { setSelected(nodeId); return; }
    if (selected === nodeId) { setSelected(null); return; }
    createConnection(selected, nodeId);
    setSelected(null);
  };

  const createConnection = async (nodeA, nodeB) => {
    try {
      const d = await api.post(`/rooms/${roomId}/connections`, { nodeA, nodeB, motivation });
      setMotivation('');
      refresh(true);
      toast(`Koppling klassad: ${CONNECTION_TYPES[d.connection.classification].label}`, d.connection.classification === 'supported' ? 'success' : 'info');
    } catch (err) { toast(err.message, 'error'); }
  };

  const remove = async (id) => {
    await api.del(`/rooms/${roomId}/connections/${id}`);
    refresh(true);
  };

  let dragId = null;
  const onPointerDown = (e, id) => {
    dragId = id;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragId) return;
    const rect = e.currentTarget.closest('.board-wrap').getBoundingClientRect();
    const x = Math.max(8, Math.min(rect.width - 158, e.clientX - rect.left - 70));
    const y = Math.max(8, Math.min(rect.height - 90, e.clientY - rect.top - 24));
    setPositions((p) => ({ ...p, [dragId]: { x, y } }));
  };
  const onPointerUp = () => { dragId = null; };

  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div className="stack">
      <div className="alert alert-info">
        Tryck på två noder i följd för att koppla ihop dem (fungerar även på mobil). Dra noderna för att organisera brädan.
        Skriv gärna en motivering innan du kopplar – servern bedömer sedan om sambandet är underbyggt, möjligt, en motsägelse eller saknar stöd.
      </div>
      <div className="field">
        <label htmlFor="mot">Motivering till nästa koppling (valfritt)</label>
        <input id="mot" className="input" value={motivation} onChange={(e) => setMotivation(e.target.value)} placeholder="T.ex. telefonens mastdata motsäger hans alibi" />
      </div>

      <div className="board-wrap" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <svg className="board-svg" aria-hidden="true">
          {connections.map((c) => {
            const a = positions[c.nodeA], b = positions[c.nodeB];
            if (!a || !b) return null;
            const color = CONNECTION_TYPES[c.classification]?.color || '#888';
            return (
              <line key={c.id} x1={a.x + 75} y1={a.y + 40} x2={b.x + 75} y2={b.y + 40}
                stroke={color} strokeWidth={2} strokeDasharray={c.classification === 'unsupported' ? '5 5' : undefined} opacity={0.85} />
            );
          })}
        </svg>
        {positions && nodes.map((n) => (
          <button key={n.id}
            className={`board-node ${selected === n.id ? 'selected' : ''}`}
            style={{ left: positions[n.id]?.x, top: positions[n.id]?.y, borderColor: selected === n.id ? 'var(--red)' : undefined }}
            onPointerDown={(e) => onPointerDown(e, n.id)}
            onClick={() => onNodeClick(n.id)}
            aria-label={`${TYPE_META[n.kind].label}: ${n.title}`}>
            <span className="node-kind" style={{ color: TYPE_META[n.kind].color }}>{TYPE_META[n.kind].label}</span>
            <strong style={{ display: 'block', marginTop: 2 }}>{n.title}</strong>
            <span className="faint" style={{ fontSize: '.72rem' }}>{n.sub}</span>
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head"><h2 className="tight">Kopplingar ({connections.length})</h2></div>
        <div className="panel-body stack">
          {connections.length === 0 && <p className="faint small">Inga kopplingar ännu. Systemet belönar resonemang som stöds av bevis – inte mängden kopplingar.</p>}
          {connections.map((c) => {
            const a = nodeById[c.nodeA], b = nodeById[c.nodeB];
            return (
              <div key={c.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <div>
                  <strong>{a?.title || c.nodeA}</strong> <span className="faint">↔</span> <strong>{b?.title || c.nodeB}</strong>
                  {c.motivation && <p className="small muted tight" style={{ marginTop: 4 }}>”{c.motivation}”</p>}
                </div>
                <div className="row">
                  <ConnectionBadge type={c.classification} />
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(c.id)} aria-label="Ta bort koppling">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
