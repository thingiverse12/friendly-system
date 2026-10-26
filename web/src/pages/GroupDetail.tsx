import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useAsync, useDocumentTitle } from '../hooks';
import { useToast } from '../toast';
import { formatShortDate, timeLeft } from '../format';
import { CopyButton, InvitationForm } from '../components/Forms';
import { Icon } from '../components/Icon';
import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Modal,
  Pill,
  Segmented,
  SelectField,
  Skeleton,
  TextField,
} from '../components/UI';
import type { GroupDetail as GroupDetailData, InvitationMetadata } from '../types';

export function GroupDetail() {
  const { groupId = '' } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const state = useAsync<GroupDetailData>(async () => api.group(groupId), [groupId]);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<InvitationMetadata | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [creatingCompetition, setCreatingCompetition] = useState(false);
  const [busy, setBusy] = useState(false);
  const [compName, setCompName] = useState('');
  const [duration, setDuration] = useState<'7' | '30'>('7');
  const [startsIn, setStartsIn] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);

  const detail = state.data;
  useDocumentTitle(detail?.group.name ?? 'Grupp');

  const reload = () => {
    state.reload();
    void user;
  };

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      await api.revokeInvitation(groupId, revoking.id);
      push('Inbjudan är återkallad.');
      setRevoking(null);
      reload();
    } catch (error) {
      push((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      const result = await api.leaveGroup(groupId);
      push(result.groupDeleted ? 'Gruppen är borttagen eftersom du var sista medlemmen.' : 'Du har lämnat gruppen.', 'info');
      navigate('/tavlingar', { replace: true });
    } catch (error) {
      push((error as Error).message, 'error');
      setLeaving(false);
    } finally {
      setBusy(false);
    }
  };

  const createCompetition = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      const result = await api.createGroupCompetition(groupId, {
        name: compName.trim(),
        durationDays: duration === '7' ? 7 : 30,
        startsInHours: Number(startsIn),
      });
      push(`Tävlingen ${result.competition.name} är skapad.`);
      setCreatingCompetition(false);
      setCompName('');
      reload();
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) return <Skeleton hero lines={4} />;
  if (state.error) {
    if (state.error.status === 404 || state.error.status === 403) {
      return (
        <div className="card">
          <EmptyState
            title="Gruppen hittades inte"
            description="Du är inte medlem i den här gruppen, eller så har den tagits bort."
            action={<Button onClick={() => navigate('/tavlingar')}>Till tävlingar</Button>}
          />
        </div>
      );
    }
    return <ErrorState message={state.error.message} onRetry={state.reload} />;
  }
  if (!detail) return null;

  const isOwner = detail.role === 'owner';

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <Link to="/tavlingar" className="btn btn--ghost btn--sm">
          <Icon name="chevronLeft" size={16} /> Tävlingar
        </Link>
      </div>

      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">{detail.group.name}</h1>
          <p className="page-head__subtitle">
            {detail.members.length} medlemmar · du är {isOwner ? 'ägare' : 'medlem'} · skapad{' '}
            {formatShortDate(detail.group.createdAt, user?.profile.timezone)}
          </p>
        </div>
        <div className="page-head__actions">
          {isOwner ? (
            <Button icon="link" onClick={() => setCreatingInvite(true)}>
              Bjud in
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setCreatingCompetition(true)}>
            Ny tävling
          </Button>
        </div>
      </header>

      <Banner tone="info" title="Integritet i gruppen" icon="shield">
        Gruppmedlemmar ser bara alias, placering och poäng i gruppens tävlingar. Ingen kan läsa dina saldon, mål eller
        transaktioner – inte ens gruppens ägare.
      </Banner>

      <div className="detail-grid">
        <div className="stack">
          <section className="card card--pad stack" aria-labelledby="group-competitions">
            <div className="row row--between">
              <h2 id="group-competitions" className="section-header__title">
                Gruppens tävlingar
              </h2>
              <Button variant="ghost" size="sm" icon="plus" onClick={() => setCreatingCompetition(true)}>
                Ny
              </Button>
            </div>
            {detail.competitions.length === 0 ? (
              <EmptyState
                variant="trophy"
                title="Ingen tävling än"
                description="Starta en 7- eller 30-dagars tävling med gruppen. Alla väljer själva om de vill vara med."
                action={
                  <Button icon="plus" onClick={() => setCreatingCompetition(true)}>
                    Starta tävling
                  </Button>
                }
              />
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {detail.competitions.map((competition) => (
                  <Link key={competition.id} to={`/tavlingar/${competition.id}`} className="mini-goal">
                    <span className="mini-goal__art" aria-hidden="true">
                      <Icon name="trophy" size={18} />
                    </span>
                    <span className="mini-goal__body">
                      <span className="mini-goal__name">
                        {competition.name}
                        <span>{competition.durationDays} dagar</span>
                      </span>
                      <span className="mini-goal__meta">
                        <span>{competition.participantCount} deltagare</span>
                        <span>
                          {competition.status === 'active'
                            ? timeLeft(competition.endsAt)
                            : competition.status === 'upcoming'
                              ? 'Startar snart'
                              : 'Avslutad'}
                        </span>
                      </span>
                    </span>
                    <Icon name="chevronRight" size={17} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {isOwner ? (
            <section className="card card--pad stack" aria-labelledby="group-invitations">
              <div className="row row--between">
                <h2 id="group-invitations" className="section-header__title">
                  Inbjudningskoder
                </h2>
                <Button variant="ghost" size="sm" icon="plus" onClick={() => setCreatingInvite(true)}>
                  Ny kod
                </Button>
              </div>
              <p className="small muted">Koder visas bara en gång. Vi sparar endast en hash, aldrig koden i klartext.</p>
              {detail.invitations.length === 0 ? (
                <p className="small muted">Inga koder skapade än.</p>
              ) : (
                <div>
                  {detail.invitations.map((invitation) => (
                    <div key={invitation.id} className="invitation-row">
                      <span className="invitation-row__body">
                        <span>{invitation.label ?? 'Inbjudan'}</span>
                        <span className="invitation-row__meta">
                          {invitation.usesCount} / {invitation.maxUses} använda ·{' '}
                          {invitation.expiresAt
                            ? `går ut ${formatShortDate(invitation.expiresAt, user?.profile.timezone)}`
                            : 'går inte ut'}{' '}
                          · {invitation.status === 'active' ? 'aktiv' : invitation.status === 'used' ? 'använd' : invitation.status === 'expired' ? 'utgången' : 'återkallad'}
                        </span>
                      </span>
                      <Pill tone={invitation.status === 'active' ? 'emerald' : 'neutral'}>{invitation.status}</Pill>
                      {invitation.status === 'active' ? (
                        <Button variant="ghost" size="sm" onClick={() => setRevoking(invitation)}>
                          Återkalla
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>

        <div className="stack">
          <section className="card card--pad stack" aria-labelledby="group-members">
            <h2 id="group-members" className="section-header__title">
              Medlemmar
            </h2>
            <div className="member-list">
              {detail.members.map((member) => (
                <div key={member.alias} className="member-row">
                  <span className={`avatar avatar--sm ${member.role === 'owner' ? '' : ''}`} aria-hidden="true">
                    {member.alias.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="member-row__body">
                    <span className="member-row__name">
                      {member.alias}
                      {member.isYou ? <Pill tone="emerald">Du</Pill> : null}
                    </span>
                    <span className="member-row__meta">
                      {member.role === 'owner' ? 'Ägare' : 'Medlem'} · gick med{' '}
                      {formatShortDate(member.joinedAt, user?.profile.timezone)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card card--pad stack">
            <h2 className="section-header__title">Lämna gruppen</h2>
            <p className="small muted">
              Om du är ägare och det finns andra medlemmar flyttas ägarskapet till den som gick med först. Om du är ensam
              medlem tas gruppen och dess tävlingar bort.
            </p>
            <Button variant="secondary" onClick={() => setLeaving(true)}>
              Lämna gruppen
            </Button>
          </section>
        </div>
      </div>

      <Modal
        open={creatingInvite}
        onClose={() => {
          setCreatingInvite(false);
          setNewCode(null);
        }}
        title={newCode ? 'Din inbjudningskod' : 'Skapa inbjudan'}
        description={
          newCode
            ? 'Kopiera koden nu – den visas inte igen. Skicka den bara till personer du litar på.'
            : 'Välj hur länge koden ska gälla och hur många som får använda den.'
        }
      >
        {newCode ? (
          <div className="stack">
            <div className="invite-code">
              <span>{newCode}</span>
              <CopyButton value={newCode} label="Kopiera" />
            </div>
            <Banner tone="warning" title="Spara koden nu" icon="lock">
              Av säkerhetsskäl lagrar vi bara en hash av koden. Den kan inte visas igen.
            </Banner>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setCreatingInvite(false);
                  setNewCode(null);
                  reload();
                }}
              >
                Klar
              </Button>
            </div>
          </div>
        ) : (
          <InvitationForm
            groupId={groupId}
            onCancel={() => setCreatingInvite(false)}
            onDone={(code) => {
              setNewCode(code);
              reload();
            }}
          />
        )}
      </Modal>

      <Modal open={creatingCompetition} onClose={() => setCreatingCompetition(false)} title="Ny grupptävling">
        <form className="stack" onSubmit={createCompetition} noValidate>
          {formError ? (
            <Banner tone="error" title="Kunde inte skapa tävlingen" icon="info">
              {formError}
            </Banner>
          ) : null}
          <TextField
            label="Namn"
            value={compName}
            onChange={(event) => setCompName(event.target.value)}
            placeholder="Till exempel Höstens spurt"
            maxLength={80}
            required
          />
          <Segmented
            label="Längd"
            value={duration}
            onChange={(value) => setDuration(value)}
            options={[
              { value: '7', label: '7 dagar' },
              { value: '30', label: '30 dagar' },
            ]}
          />
          <SelectField label="Start" value={startsIn} onChange={(event) => setStartsIn(event.target.value)}>
            <option value="0">Nu direkt</option>
            <option value="1">Om 1 timme</option>
            <option value="24">Om 1 dag</option>
            <option value="168">Om 1 vecka</option>
          </SelectField>
          <p className="small muted">
            Starttiden sätts av servern. Startsaldon och målbelopp låses automatiskt när tävlingen börjar.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setCreatingCompetition(false)}>
              Avbryt
            </Button>
            <Button type="submit" loading={busy}>
              Skapa tävling
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={revoking !== null}
        title="Återkalla inbjudan?"
        message="Koden slutar fungera direkt. Personer som redan gått med påverkas inte."
        confirmLabel="Återkalla"
        danger
        loading={busy}
        onConfirm={revoke}
        onCancel={() => setRevoking(null)}
      />

      <ConfirmDialog
        open={leaving}
        title="Lämna gruppen?"
        message="Du tas bort från gruppen och ser inte längre dess tävlingar. Ditt sparande påverkas inte."
        confirmLabel="Lämna gruppen"
        danger
        loading={busy}
        onConfirm={leave}
        onCancel={() => setLeaving(false)}
      />
    </>
  );
}
