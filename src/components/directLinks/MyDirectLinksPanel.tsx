import {
	COUNSELLOR_START_PATH,
	useDirectLinksRedirect
} from './useDirectLinksAllowed';
import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserDataContext } from '../../globalState';
import {
	apiGetTenantAgenciesTopics,
	TenantAgenciesTopicsInterface
} from '../../api/apiGetTenantAgenciesTopics';
import { DirectLinkUpdate } from '../../api/apiDirectLinks';
import {
	apiGetUpcomingAppointments,
	type SessionAppointment
} from '../../api/apiSessionAppointments';
import { onAppointmentsChanged } from '../sessionsList/timeline/conversationAppointments';
import { InvitationsOverview } from '../directInvitation/InvitationsOverview';
import { InvitationDialog } from '../directInvitation/InvitationDialog';
import type { InvitationDialogValue } from '../directInvitation/invitationModel';
import {
	nextExpiryRead,
	READ_RETRY_MS
} from '../directInvitation/invitationModel';
import { directInvitationSettings } from '../directInvitation/directInvitationSettings';
import { overviewSections } from './invitationsOverviewData';
import { useSendNewLink } from '../directInvitation/useSendNewLink';
import { invitationErrorEntry } from '../directInvitation/invitationErrorSnackbar';
import { appSnackbarStack } from '../m3Snackbar/snackbarStack';
import { filterTopicsForAgencies } from '../conversationCreate/agencyTopics';
import { DirectLink } from '../conversationCreate/directLink/directLink';
import { DirectLinkShareDialog } from '../conversationCreate/directLink/DirectLinkShareDialog';
import { useResponsive } from '../../hooks/useResponsive';
import { DirectLinkEditDialog } from './DirectLinkEditDialog';
import { MyDirectLinksView } from './MyDirectLinksView';
import { useMyDirectLinks } from './useMyDirectLinks';
import { CREATE_CHAT_PATH } from '../app/routePaths';
import { FETCH_ERRORS } from '../../api/fetchData';

export { CREATE_CHAT_PATH };

/**
 * #2252: the 1:1 appointments for the overview. A backend without the
 * endpoint (404) has none; any other failed read is `failed`, never "no
 * appointments", and `retry` reads them again while the invitations stay.
 * Until the first read has answered they are `loading`, not "none yet".
 */
const useUpcomingAppointments = (enabled: boolean) => {
	const [appointments, setAppointments] = useState<SessionAppointment[]>([]);
	const [failed, setFailed] = useState(false);
	const [answered, setAnswered] = useState(false);
	const [reload, setReload] = useState(0);
	const retry = useCallback(() => setReload((n) => n + 1), []);
	useEffect(() => onAppointmentsChanged(retry), [retry]);
	useEffect(() => {
		if (!enabled) return undefined;
		let active = true;
		apiGetUpcomingAppointments().then(
			(items) => {
				if (!active) return;
				setAppointments(Array.isArray(items) ? items : []);
				setFailed(false);
				setAnswered(true);
			},
			(error: unknown) => {
				if (!active) return;
				const missing =
					(error as Error | undefined)?.message ===
					FETCH_ERRORS.NO_MATCH;
				setAppointments([]);
				setFailed(!missing);
				setAnswered(true);
			}
		);
		return () => {
			active = false;
		};
	}, [enabled, reload]);
	return { appointments, failed, loading: enabled && !answered, retry };
};

/**
 * #1894: list + QR + edit, wired to UserService#1479. With `overview`
 * (#2252, the clock page) it is "Termine & Direkteinladungen": invitations
 * with a date and the 1:1 appointments by day, the others as tiles.
 */
export const MyDirectLinksPanel = ({
	overview = false,
	title,
	description,
	compact = false
}: {
	overview?: boolean;
	/** *19: the calendar shows the list as "Links ohne Termin". */
	title?: string;
	description?: string;
	/**
	 * FE#2494 *2a/*2b: the calendar lists links as compact rows and has no
	 * create button of its own (product decision); see CalendarLinksSection
	 * for where new links come from.
	 */
	compact?: boolean;
} = {}) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { fromL } = useResponsive();
	const { userData } = useContext(UserDataContext);
	const { links, state, toggleFailed, pendingIds, reload, toggle, update } =
		useMyDirectLinks();
	const [qrLink, setQrLink] = useState<DirectLink | null>(null);
	const [editing, setEditing] = useState<DirectLink | null>(null);
	const [saving, setSaving] = useState(false);
	const [legacySaving, setLegacySaving] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
	const [topics, setTopics] = useState<TenantAgenciesTopicsInterface[]>([]);
	const {
		appointments: sessionAppointments,
		failed: appointmentsFailed,
		loading: appointmentsLoading,
		retry: retryAppointments
	} = useUpcomingAppointments(overview);
	/* #2252, decision 7: "Neuen Link senden" for an expired invitation. */
	const newLink = useSendNewLink();
	/* A failed switch is a titled pop-up, not a box in the page. */
	useEffect(() => {
		if (!overview || !toggleFailed) return;
		appSnackbarStack.enqueue(
			invitationErrorEntry({
				id: 'direct-link-toggle-failed',
				title: t('directLink.page.toggleFailedTitle'),
				text: t('directLink.page.toggleFailed'),
				t
			})
		);
	}, [overview, t, toggleFailed]);
	/* #2252: an invitation with a date is edited in the shared dialog. */
	const [editingInvitation, setEditingInvitation] =
		useState<DirectLink | null>(null);
	const [invitationError, setInvitationError] = useState<string>();
	/* Each open of the invitation dialog is its own editor: a save that
	   answers after it was closed (or another one opened) changes nothing,
	   not even the busy state, and a new editor starts without one. */
	const invitationEditor = useRef(0);
	const openInvitationEditor = (link: DirectLink | null) => {
		invitationEditor.current += 1;
		setEditingInvitation(link);
		setInvitationError(undefined);
		setSaving(false);
	};

	/* An invitation whose validity ends while the overview is open moves to
	   the expired section: the list is read again once its end has passed.
	   A failed read keeps the old list, so nothing would change and no new
	   timer start: it is asked again until a read succeeds. */
	useEffect(() => {
		if (!overview) return;
		const delay = nextExpiryRead(links);
		if (delay === undefined) return;
		let active = true;
		let timer: number | undefined;
		const refresh = () => {
			void reload().then((read) => {
				if (!read && active)
					timer = window.setTimeout(refresh, READ_RETRY_MS);
			});
		};
		timer = window.setTimeout(refresh, delay);
		return () => {
			active = false;
			window.clearTimeout(timer);
		};
	}, [links, overview, reload]);

	// Topics only matter once someone edits; a failed load keeps the topic fixed.
	useEffect(() => {
		if (!editing || topics.length) return;
		apiGetTenantAgenciesTopics()
			.then((result) => setTopics(result || []))
			.catch(() => setTopics([]));
	}, [editing, topics.length]);

	const topicOptions = useMemo(
		() =>
			filterTopicsForAgencies(
				topics,
				userData?.agencies ?? [],
				editing?.agencyId ?? null
			)
				.filter((topic) => topic.id != null)
				.map((topic) => ({
					value: String(topic.id),
					label: topic.name
				})),
		[editing?.agencyId, topics, userData?.agencies]
	);

	const closeEdit = () => {
		setEditing(null);
		setSaveFailed(false);
	};

	/* The legacy dialog has its own busy flag: closed while saving, it must
	   not free the invitation editor's Save (#2285). */
	const save = async (link: DirectLink, change: DirectLinkUpdate) => {
		setLegacySaving(true);
		setSaveFailed(false);
		try {
			await update(link.id, change);
			closeEdit();
		} catch {
			setSaveFailed(true);
		} finally {
			setLegacySaving(false);
		}
	};

	const saveInvitation = async (value: InvitationDialogValue) => {
		if (!editingInvitation) return;
		const editor = invitationEditor.current;
		setSaving(true);
		setInvitationError(undefined);
		try {
			await update(editingInvitation.id, directInvitationSettings(value));
			if (editor === invitationEditor.current) openInvitationEditor(null);
		} catch {
			if (editor === invitationEditor.current)
				setInvitationError(t('directLink.edit.failed'));
		} finally {
			if (editor === invitationEditor.current) setSaving(false);
		}
	};

	const sections = overview
		? overviewSections(
				links,
				sessionAppointments,
				t('directInvitation.overview.appointmentName')
			)
		: null;
	const linkOf = (id: string) => links.find((link) => link.id === id);

	return (
		<>
			{sections ? (
				<>
					<InvitationsOverview
						/* The overview waits for both reads: appointments not
						   read yet must not look like "nothing yet". */
						state={
							state === 'ready' && appointmentsLoading
								? 'loading'
								: state
						}
						appointments={sections.appointments}
						expired={sections.expired}
						onSendNewLink={(item) => void newLink.send(item.id)}
						sendingIds={newLink.pendingIds}
						links={sections.links}
						onCreate={() => navigate(CREATE_CHAT_PATH)}
						onRetry={reload}
						appointmentsFailed={appointmentsFailed}
						onRetryAppointments={retryAppointments}
						onShowAppointmentQr={(item) => {
							const link = linkOf(item.id);
							if (link) setQrLink(link);
						}}
						onEditAppointment={(item) => {
							const link = linkOf(item.id);
							if (link) openInvitationEditor(link);
						}}
						onToggle={toggle}
						pendingIds={pendingIds}
						onShowQr={setQrLink}
						onEdit={(link) => {
							/* Legacy direct links still use the legacy editor. A
							   Direkteinladung is identifiable by its invitation-only
							   access / knock settings even without an appointment. */
							if (
								link.access !== undefined ||
								link.knock !== undefined
							)
								openInvitationEditor(link);
							else setEditing(link);
						}}
					/>
					{newLink.dialog}
				</>
			) : (
				<MyDirectLinksView
					state={state}
					links={links}
					toggleFailed={toggleFailed}
					onToggle={toggle}
					pendingIds={pendingIds}
					onShowQr={setQrLink}
					onEdit={setEditing}
					onCreate={
						compact ? undefined : () => navigate(CREATE_CHAT_PATH)
					}
					onRetry={reload}
					title={title}
					description={description}
					variant={compact ? 'rows' : 'tiles'}
				/>
			)}
			{editingInvitation && (
				<InvitationDialog
					variant="invitation"
					mode="edit"
					initial={{
						...(editingInvitation.appointment
							? {
									start: new Date(
										editingInvitation.appointment.start
									),
									end: new Date(
										editingInvitation.appointment.end
									),
									withAppointment: true
								}
							: {}),
						validityMinutes: editingInvitation.validityMinutes,
						access: editingInvitation.access,
						knock: editingInvitation.knock
					}}
					saving={saving}
					error={invitationError}
					fullScreen={!fromL}
					onSubmit={saveInvitation}
					onClose={() => openInvitationEditor(null)}
				/>
			)}
			{qrLink && (
				<DirectLinkShareDialog
					open
					link={qrLink}
					onClose={() => setQrLink(null)}
					fullScreen={!fromL}
				/>
			)}
			<DirectLinkEditDialog
				link={editing}
				topics={topicOptions}
				saving={legacySaving}
				failed={saveFailed}
				fullScreen={!fromL}
				onClose={closeEdit}
				onSave={save}
			/>
		</>
	);
};

/**
 * Clock navigation entry (route /direct-links). Opened by URL while no medium
 * is allowed, it leaves for the counsellor start page once that is known.
 */
export const MyDirectLinksPage = () => {
	const leaving = useDirectLinksRedirect(
		true,
		(pathname) => pathname.startsWith('/direct-links'),
		COUNSELLOR_START_PATH
	);
	if (leaving) return null;
	return (
		<div className="myDirectLinksPage" data-testid="my-direct-links-page">
			<MyDirectLinksPanel overview />
		</div>
	);
};

/** Settings → "Meine Links": the same list. */
export const MyLinksSettings = () => (
	<div className="myDirectLinksPage myDirectLinksPage--settings">
		<MyDirectLinksPanel />
	</div>
);
