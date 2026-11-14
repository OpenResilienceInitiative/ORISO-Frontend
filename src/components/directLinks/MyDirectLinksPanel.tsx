import {
	COUNSELLOR_START_PATH,
	useDirectLinksRedirect
} from './useDirectLinksAllowed';
import * as React from 'react';
import { useContext, useEffect, useMemo, useState } from 'react';
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
import { directInvitationSettings } from '../directInvitation/directInvitationSettings';
import { overviewSections } from './invitationsOverviewData';
import { filterTopicsForAgencies } from '../conversationCreate/agencyTopics';
import { DirectLink } from '../conversationCreate/directLink/directLink';
import { DirectLinkShareDialog } from '../conversationCreate/directLink/DirectLinkShareDialog';
import { useResponsive } from '../../hooks/useResponsive';
import { DirectLinkEditDialog } from './DirectLinkEditDialog';
import { MyDirectLinksView } from './MyDirectLinksView';
import { useMyDirectLinks } from './useMyDirectLinks';
import { CREATE_CHAT_PATH } from '../app/routePaths';

export { CREATE_CHAT_PATH };

/**
 * #2252: the 1:1 appointments for the overview. A backend without the
 * endpoint, or a failed read, leaves only the invitations.
 */
const useUpcomingAppointments = (enabled: boolean) => {
	const [appointments, setAppointments] = useState<SessionAppointment[]>([]);
	const [reload, setReload] = useState(0);
	useEffect(() => onAppointmentsChanged(() => setReload((n) => n + 1)), []);
	useEffect(() => {
		if (!enabled) return undefined;
		let active = true;
		apiGetUpcomingAppointments().then(
			(items) =>
				active && setAppointments(Array.isArray(items) ? items : []),
			() => active && setAppointments([])
		);
		return () => {
			active = false;
		};
	}, [enabled, reload]);
	return appointments;
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
	const sessionAppointments = useUpcomingAppointments(overview);
	/* #2252: an invitation with a date is edited in the shared dialog. */
	const [editingInvitation, setEditingInvitation] =
		useState<DirectLink | null>(null);
	const [invitationError, setInvitationError] = useState<string>();

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
		setSaving(true);
		setInvitationError(undefined);
		try {
			await update(editingInvitation.id, directInvitationSettings(value));
			setEditingInvitation(null);
		} catch {
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
						links={sections.links}
						onCreate={() => navigate(CREATE_CHAT_PATH)}
						onRetry={reload}
						onShowAppointmentQr={(item) => {
							const link = linkOf(item.id);
							if (link) setQrLink(link);
						}}
						onEditAppointment={(item) => {
							const link = linkOf(item.id);
							if (link) setEditingInvitation(link);
						}}
						onToggle={toggle}
						pendingIds={pendingIds}
						onShowQr={setQrLink}
						onEdit={setEditing}
					/>
					{toggleFailed && (
						<p role="alert" className="myDirectLinksPage__error">
							{t('directLink.page.toggleFailed')}
						</p>
					)}
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
			{editingInvitation?.appointment && (
				<InvitationDialog
					variant="invitation"
					mode="edit"
					initial={{
						start: new Date(editingInvitation.appointment.start),
						end: new Date(editingInvitation.appointment.end),
						withAppointment: true,
						validityMinutes: editingInvitation.validityMinutes,
						access: editingInvitation.access,
						knock: editingInvitation.knock
					}}
					saving={saving}
					error={invitationError}
					fullScreen={!fromL}
					onSubmit={saveInvitation}
					onClose={() => {
						setEditingInvitation(null);
						setInvitationError(undefined);
					}}
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
