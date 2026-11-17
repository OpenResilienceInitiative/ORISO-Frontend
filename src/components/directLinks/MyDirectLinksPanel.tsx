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
import { timerDelay } from '../directInvitation/invitationModel';
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
 */
const useUpcomingAppointments = (enabled: boolean) => {
	const [appointments, setAppointments] = useState<SessionAppointment[]>([]);
	const [failed, setFailed] = useState(false);
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
			},
			(error: unknown) => {
				if (!active) return;
				const missing =
					(error as Error | undefined)?.message ===
					FETCH_ERRORS.NO_MATCH;
				setAppointments([]);
				setFailed(!missing);
			}
		);
		return () => {
			active = false;
		};
	}, [enabled, reload]);
	return { appointments, failed, retry };
};

/**
 * #1894: list + QR + edit, wired to UserService#1479. With `overview`
 * (#2252, the clock page) it is "Termine & Direkteinladungen": invitations
 * with a date and the 1:1 appointments by day, the others as tiles.
 */
export const MyDirectLinksPanel = ({
	overview = false
}: {
	overview?: boolean;
}) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { fromL } = useResponsive();
	const { userData } = useContext(UserDataContext);
	const { links, state, toggleFailed, pendingIds, reload, toggle, update } =
		useMyDirectLinks();
	const [qrLink, setQrLink] = useState<DirectLink | null>(null);
	const [editing, setEditing] = useState<DirectLink | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
	const [topics, setTopics] = useState<TenantAgenciesTopicsInterface[]>([]);
	const {
		appointments: sessionAppointments,
		failed: appointmentsFailed,
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
	   answers after it was closed (or another one opened) changes nothing. */
	const invitationEditor = useRef(0);
	const openInvitationEditor = (link: DirectLink | null) => {
		invitationEditor.current += 1;
		setEditingInvitation(link);
		setInvitationError(undefined);
	};

	/* An invitation whose validity ends while the overview is open moves to
	   the expired section: the list is read again once its end has passed. */
	useEffect(() => {
		if (!overview) return;
		const now = Date.now();
		const nextEnd = links
			.filter((link) => !link.expired && link.expiresAt)
			.map((link) => new Date(link.expiresAt!).getTime())
			.filter((end) => Number.isFinite(end) && end > now)
			.sort((a, b) => a - b)[0];
		if (nextEnd === undefined) return;
		const delay = timerDelay(new Date(nextEnd + 1000));
		const timer = window.setTimeout(reload, delay);
		return () => window.clearTimeout(timer);
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

	const save = async (link: DirectLink, change: DirectLinkUpdate) => {
		setSaving(true);
		setSaveFailed(false);
		try {
			await update(link.id, change);
			closeEdit();
		} catch {
			setSaveFailed(true);
		} finally {
			setSaving(false);
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
			setSaving(false);
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
						state={state}
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
					onCreate={() => navigate(CREATE_CHAT_PATH)}
					onRetry={reload}
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
				saving={saving}
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
