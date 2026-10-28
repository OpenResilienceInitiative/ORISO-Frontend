import * as React from 'react';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserDataContext } from '../../globalState';
import {
	apiGetTenantAgenciesTopics,
	TenantAgenciesTopicsInterface
} from '../../api/apiGetTenantAgenciesTopics';
import { DirectLinkUpdate } from '../../api/apiDirectLinks';
import { filterTopicsForAgencies } from '../conversationCreate/agencyTopics';
import { DirectLink } from '../conversationCreate/directLink/directLink';
import { DirectLinkShareDialog } from '../conversationCreate/directLink/DirectLinkShareDialog';
import { useResponsive } from '../../hooks/useResponsive';
import { DirectLinkEditDialog } from './DirectLinkEditDialog';
import { MyDirectLinksView } from './MyDirectLinksView';
import { useMyDirectLinks } from './useMyDirectLinks';

export const CREATE_CHAT_PATH =
	'/sessions/consultant/sessionView/createGroupChat/';

/** #1894: list + QR + edit, wired to UserService#1479. */
export const MyDirectLinksPanel = () => {
	const navigate = useNavigate();
	const { fromL } = useResponsive();
	const { userData } = useContext(UserDataContext);
	const { links, state, toggleFailed, reload, toggle, update } =
		useMyDirectLinks();
	const [qrLink, setQrLink] = useState<DirectLink | null>(null);
	const [editing, setEditing] = useState<DirectLink | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
	const [topics, setTopics] = useState<TenantAgenciesTopicsInterface[]>([]);

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

	return (
		<>
			<MyDirectLinksView
				state={state}
				links={links}
				toggleFailed={toggleFailed}
				onToggle={toggle}
				onShowQr={setQrLink}
				onEdit={setEditing}
				onCreate={() => navigate(CREATE_CHAT_PATH)}
				onRetry={reload}
			/>
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

/** Clock navigation entry (route /direct-links). */
export const MyDirectLinksPage = () => (
	<div className="myDirectLinksPage" data-testid="my-direct-links-page">
		<MyDirectLinksPanel />
	</div>
);

/** Settings → "Meine Links": the same list. */
export const MyLinksSettings = () => (
	<div className="myDirectLinksPage myDirectLinksPage--settings">
		<MyDirectLinksPanel />
	</div>
);
