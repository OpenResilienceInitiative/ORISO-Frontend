import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGetDeletedAskerSessions } from '../../api/apiGetDeletedAskerSessions';
import { apiPutDeletedAskerArchive } from '../../api/apiPutDeletedAskerArchive';
import { mobileDetailView } from '../app/navigationHandler';
import {
	announceDeletedAskerArchived,
	parseFormerSessionId
} from '../sessionsList/deletedAskerPath';
import {
	DeletedAskerArchiveState,
	DeletedAskerNotice
} from './DeletedAskerNotice';

const LIST_PATH = '/sessions/consultant/sessionView';

const formatDay = (iso: string | undefined, language: string) => {
	if (!iso) return null;
	const time = Date.parse(iso);
	if (!Number.isFinite(time)) return null;
	const options: Intl.DateTimeFormatOptions = {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	};
	try {
		return new Date(time).toLocaleDateString(
			(language || 'de').split('@')[0],
			options
		);
	} catch {
		return new Date(time).toLocaleDateString('de', options);
	}
};

/** Route component for `/sessions/consultant/sessionView/deleted/:formerSessionId`. */
export const DeletedAskerSessionView = () => {
	const { t: translate, i18n } = useTranslation();
	const navigate = useNavigate();
	const { formerSessionId: param } = useParams();
	const formerSessionId = parseFormerSessionId(param);
	const [deletedAt, setDeletedAt] = useState<string | undefined>();
	const [archiveState, setArchiveState] =
		useState<DeletedAskerArchiveState>('idle');

	useEffect(() => {
		mobileDetailView();
	}, []);

	// The date and whether it is archived already; a chat whose advice seeker
	// is only marked for deletion has no placeholder yet, so neither is known.
	useEffect(() => {
		if (formerSessionId === null) return undefined;
		const controller = new AbortController();
		Promise.all([
			apiGetDeletedAskerSessions(controller.signal),
			apiGetDeletedAskerSessions(controller.signal, { archived: true })
		]).then(([active, archived]) => {
			if (controller.signal.aborted) return;
			const own = (list: typeof active) =>
				list.find((entry) => entry.formerSessionId === formerSessionId);
			const found = own(active) ?? own(archived);
			setDeletedAt(found?.deletedAt);
			setArchiveState(own(archived) ? 'archived' : 'idle');
		});
		return () => controller.abort();
	}, [formerSessionId]);

	const handleArchive = useCallback(() => {
		if (formerSessionId === null) return;
		setArchiveState('busy');
		apiPutDeletedAskerArchive(formerSessionId)
			.then(() => {
				setArchiveState('archived');
				announceDeletedAskerArchived(formerSessionId);
				navigate(LIST_PATH);
			})
			.catch(() => setArchiveState('failed'));
	}, [formerSessionId, navigate]);

	if (formerSessionId === null) return null;

	return (
		<DeletedAskerNotice
			translate={translate}
			deletedOn={formatDay(deletedAt, i18n.language)}
			archiveState={archiveState}
			onArchive={archiveState === 'archived' ? undefined : handleArchive}
			backPath={LIST_PATH}
		/>
	);
};
