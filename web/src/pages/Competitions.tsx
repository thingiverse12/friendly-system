import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { useAsync, useDocumentTitle } from '../hooks';
import { useToast } from '../toast';
import { CompetitionCard } from '../components/Cards';
import { JoinCompetitionModal } from '../components/JoinCompetitionModal';
import { Icon } from '../components/Icon';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Modal,
  Segmented,
  Skeleton,
  TextField,
} from '../components/UI';
import type { CompetitionSummary, CompetitionsResponse, Goal, GroupSummary } from '../types';

export function Competitions() {
  useDocumentTitle('Tävlingar');
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'public' | 'mine' | 'groups'>('public');
  const [joinTarget, setJoinTarget] = useState<CompetitionSummary | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const state = useAsync<CompetitionsResponse>(async () => api.competitions(), []);
  const goalsState = useAsync<{ goals: Goal[]; totals: { savedOre: number; targetOre: number } }>(
    async () => api.goals(false),
    [],
  );
  const groupsState = useAsync<{ groups: GroupSummary[] }>(async () => api.groups(), []);

  const goals = goalsState.data?.goals ?? [];
  const groups = groupsState.data?.groups ?? [];
  const competitions = state.data;
  const consent = user?.profile.publicCompetitionConsent ?? false;

  const reloadAll = () => {
    state.reload();
    groupsState.reload();
  };

  const joinDisabledReason = (competition: CompetitionSummary): string | null => {
    if (competition.visibility === 'public' && !consent) {
      return 'Godkänn deltagande i offentliga tävlingar under Profil och integritet.';
    }
    if (goals.filter((goal) => !goal.archived).length === 0) return 'Skapa ett sparmål först.';
    return null;
  };

  const createGroup = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      const result = await api.createGroup(groupName.trim());
      push(`Gruppen ${result.group.name} är skapad.`);
      setCreatingGroup(false);
      setGroupName('');
      groupsState.reload();
      navigate(`/grupper/${result.group.id}`);
    } catch (error) {
      setFormError(error instanceof ApiError || error instanceof Error ? error.message : 'Något gick fel.');
    } finally {
      setBusy(false);
    }
  };

  const joinGroup = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      const result = await api.joinGroup(inviteCode.trim());
      push(result.message, 'success');
      setJoiningGroup(false);
      setInviteCode('');
      groupsState.reload();
      navigate(`/grupper/${result.groupId}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Något gick fel.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">Tävlingar</h1>
          <p className="page-head__subtitle">Spara tillsammans, jämför rättvist och fira framstegen.</p>
        </div>
      </header>

      <Segmented
        label="Visa tävlingar"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'public', label: 'Offentliga', count: competitions?.public.length },
          { value: 'mine', label: 'Mina', count: competitions?.mine.length },
          { value: 'groups', label: 'Grupper', count: groups.length },
        ]}
      />

      {state.loading ? <Skeleton hero lines={4} /> : null}
      {state.error ? <ErrorState message={state.error.message} onRetry={state.reload} /> : null}

      {tab === 'public' && competitions ? (
        <>
          {!consent ? (
            <Banner tone="warning" title="Offentliga tävlingar är avstängda" icon="shield">
              Du deltar inte i offentliga tävlingar förrän du aktivt godkänner det.{' '}
              <Link to="/profil">Öppna profil och integritet</Link>
            </Banner>
          ) : null}
          <div className="score-explainer">
            <Icon name="info" size={18} />
            <div>
              <strong>Så räknas poängen:</strong> <code>100 × (aktuellt saldo − startsaldo) / låst målbelopp</code>. Bara
              förändringar efter starten räknas – tidigare sparande ger inga poäng och uttag sänker poängen. Klasser (A1–D4)
              grupperar målbelopp och startandel för bättre jämförbarhet, men garanterar inte identiska ekonomiska
              förutsättningar.
            </div>
          </div>
          {competitions.public.length === 0 ? (
            <div className="card">
              <EmptyState
                variant="trophy"
                title="Inga offentliga tävlingar just nu"
                description="Nya 7- och 30-dagars tävlingar startar automatiskt. Kom tillbaka snart."
              />
            </div>
          ) : (
            <div className="competition-grid">
              {competitions.public.map((competition) => (
                <CompetitionCard
                  key={competition.id}
                  competition={competition}
                  joining={false}
                  joinDisabledReason={joinDisabledReason(competition)}
                  onJoin={() => setJoinTarget(competition)}
                />
              ))}
            </div>
          )}
        </>
      ) : null}

      {tab === 'mine' && competitions ? (
        competitions.mine.length === 0 ? (
          <div className="card">
            <EmptyState
              variant="trophy"
              title="Du tävlar inte än"
              description="Gå med i en offentlig tävling eller starta en privat grupp med vänner."
              action={
                <Button variant="secondary" onClick={() => setTab('public')}>
                  Utforska offentliga
                </Button>
              }
            />
          </div>
        ) : (
          <div className="competition-grid">
            {competitions.mine.map((competition) => (
              <CompetitionCard key={competition.id} competition={competition} />
            ))}
          </div>
        )
      ) : null}

      {tab === 'groups' ? (
        <>
          <div className="row wrap" style={{ gap: 8 }}>
            <Button icon="users" onClick={() => setCreatingGroup(true)}>
              Skapa grupp
            </Button>
            <Button variant="secondary" icon="link" onClick={() => setJoiningGroup(true)}>
              Gå med med kod
            </Button>
          </div>

          <Banner tone="info" title="Bara resultat delas" icon="shield">
            Gruppmedlemmar ser varandras alias, placering och poäng i tävlingar – aldrig saldon, mål eller transaktioner.
          </Banner>

          {groupsState.loading ? <Skeleton lines={3} /> : null}
          {groups.length === 0 ? (
            <div className="card">
              <EmptyState
                title="Inga grupper än"
                description="Skapa en grupp för vänner, familjen eller kollegorna och tävla tillsammans i 7 eller 30 dagar."
                action={
                  <Button icon="users" onClick={() => setCreatingGroup(true)}>
                    Skapa din första grupp
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="group-grid">
              {groups.map((group) => (
                <Link key={group.id} to={`/grupper/${group.id}`} className="group-card">
                  <span className="group-card__mark" aria-hidden="true">
                    <Icon name="users" size={20} />
                  </span>
                  <span className="group-card__body">
                    <span className="group-card__name">{group.name}</span>
                    <span className="group-card__meta">
                      {group.memberCount} medlemmar · {group.competitionCount} tävlingar ·{' '}
                      {group.role === 'owner' ? 'ägare' : 'medlem'}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={17} />
                </Link>
              ))}
            </div>
          )}
        </>
      ) : null}

      {joinTarget ? (
        <JoinCompetitionModal
          open
          competitionId={joinTarget.id}
          competitionName={joinTarget.name}
          goals={goals}
          onClose={() => setJoinTarget(null)}
          onJoined={() => {
            setJoinTarget(null);
            reloadAll();
          }}
        />
      ) : null}

      <Modal open={creatingGroup} onClose={() => setCreatingGroup(false)} title="Skapa grupp">
        <form className="stack" onSubmit={createGroup} noValidate>
          {formError ? (
            <Banner tone="error" title="Kunde inte skapa gruppen" icon="info">
              {formError}
            </Banner>
          ) : null}
          <TextField
            label="Gruppnamn"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="Till exempel Vännernas gäng"
            maxLength={60}
            required
            hint="Du blir ägare och kan bjuda in med engångskoder."
          />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setCreatingGroup(false)}>
              Avbryt
            </Button>
            <Button type="submit" loading={busy}>
              Skapa grupp
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={joiningGroup} onClose={() => setJoiningGroup(false)} title="Gå med i grupp">
        <form className="stack" onSubmit={joinGroup} noValidate>
          {formError ? (
            <Banner tone="error" title="Kunde inte gå med" icon="info">
              {formError}
            </Banner>
          ) : null}
          <TextField
            label="Inbjudningskod"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            maxLength={32}
            required
            hint="Koden är personlig och kan bara användas det antal gånger gruppägaren valt."
            autoComplete="off"
          />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setJoiningGroup(false)}>
              Avbryt
            </Button>
            <Button type="submit" loading={busy}>
              Gå med
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
