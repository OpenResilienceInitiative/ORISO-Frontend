import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiDeleteUserDraft, apiGetUserDrafts, IUserDraftItem } from '../../api';
import { REMOTE_DRAFT_INDEX_SCOPE } from '../../services/draftStore';
import './draftsCenter.styles';

const formatRelativeTime = (timestamp?: string | null) => {
	if (!timestamp) {
		return '';
	}
	const diffMs = Date.now() - new Date(timestamp).getTime();
	const diffMin = Math.max(0, Math.floor(diffMs / (1000 * 60)));
	if (diffMin < 1) return 'now';
	if (diffMin < 60) return `${diffMin}m`;
	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 24) return `${diffHours}h`;
	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays}d`;
};

const withEmbeddedNotificationsParam = (path: string) => {
	if (!path) {
		return null;
	}
	return `${path}${path.includes('?') ? '&' : '?'}embeddedNotifications=1`;
};

export const DraftsCenter = () => {
	const { t: translate } = useTranslation();
	const history = useHistory();
	const [selectedDraftKey, setSelectedDraftKey] = useState<string | null>(null);
	const [refreshToken, setRefreshToken] = useState(0);
	const [drafts, setDrafts] = useState<IUserDraftItem[]>([]);

	useEffect(() => {
		let isMounted = true;
		const loadRemoteDrafts = async () => {
			const response = await apiGetUserDrafts(0, 200).catch(() => null);
			if (!isMounted) {
				return;
			}
			const visibleDrafts =
				response?.items?.filter(
					(entry) => entry.scopeKey !== REMOTE_DRAFT_INDEX_SCOPE
				) || [];
			setDrafts(visibleDrafts);
		};

		void loadRemoteDrafts();
		return () => {
			isMounted = false;
		};
	}, [refreshToken]);

	useEffect(() => {
		if (!selectedDraftKey && drafts.length > 0) {
			setSelectedDraftKey(drafts[0].scopeKey);
			return;
		}
		if (
			selectedDraftKey &&
			!drafts.find((entry) => entry.scopeKey === selectedDraftKey)
		) {
			setSelectedDraftKey(drafts[0]?.scopeKey || null);
		}
	}, [drafts, selectedDraftKey]);

	const selectedDraft = useMemo(
		() => drafts.find((entry) => entry.scopeKey === selectedDraftKey) || null,
		[drafts, selectedDraftKey]
	);
	const embeddedChatPath = useMemo(
		() =>
			selectedDraft?.actionPath
				? withEmbeddedNotificationsParam(selectedDraft.actionPath)
				: null,
		[selectedDraft?.actionPath]
	);
	const getNextDraftKey = useCallback(
		(currentKey: string | null): string | null => {
			if (!drafts.length) {
				return null;
			}
			const currentIndex = currentKey
				? drafts.findIndex((entry) => entry.scopeKey === currentKey)
				: -1;
			if (currentIndex < 0 || currentIndex === drafts.length - 1) {
				return drafts[0]?.scopeKey || null;
			}
			return drafts[currentIndex + 1]?.scopeKey || null;
		},
		[drafts]
	);
	const nextDraftKey = getNextDraftKey(selectedDraftKey);

	const handleOpenDraft = useCallback(
		(entry: IUserDraftItem) => {
			if (!entry.actionPath) {
				return;
			}
			history.push(entry.actionPath);
		},
		[history]
	);

	const handleDeleteDraft = useCallback((entry: IUserDraftItem) => {
		apiDeleteUserDraft(entry.scopeKey).then(() =>
			setRefreshToken((token) => token + 1)
		);
	}, []);

	const handleNextDraft = useCallback(() => {
		if (nextDraftKey) {
			setSelectedDraftKey(nextDraftKey);
		}
	}, [nextDraftKey]);

	return (
		<div className="draftsCenter">
			<div className="draftsCenter__header">
				<h2 className="draftsCenter__title">
					{translate('drafts.center.title', 'Drafts')}
				</h2>
				<p className="draftsCenter__subtitle">
					{translate(
						'drafts.center.subtitle',
						'Unsent messages are saved per chat and thread.'
					)}
				</p>
			</div>
			<div className="draftsCenter__content">
				<div className="draftsCenter__list">
					{drafts.length === 0 ? (
						<div className="draftsCenter__empty">
							{translate('drafts.center.empty', 'No drafts yet.')}
						</div>
					) : (
						drafts.map((entry) => (
							<button
								type="button"
								key={entry.scopeKey}
								className={`draftsCenter__listItem ${
									entry.scopeKey === selectedDraftKey
										? 'draftsCenter__listItem--active'
										: ''
								}`}
								onClick={() => setSelectedDraftKey(entry.scopeKey)}
							>
								<div className="draftsCenter__listItemTagRow">
									<span className="draftsCenter__listItemTag">
										{translate('drafts.center.messageTag', 'Draft')}
									</span>
								</div>
								<div className="draftsCenter__listItemHeader">
									<span className="draftsCenter__listItemTitle">
										{entry.title ||
											translate('drafts.center.untitledChat', 'Chat')}
									</span>
									<span className="draftsCenter__listItemTime">
										{formatRelativeTime(entry.updatedAt)}
									</span>
								</div>
								<p className="draftsCenter__listItemText">{entry.text}</p>
								{entry.threadRootId && (
									<span className="draftsCenter__threadTag">
										{translate('drafts.center.thread', 'Thread')}
									</span>
								)}
							</button>
						))
					)}
				</div>
				<div
					className={`draftsCenter__detail ${
						embeddedChatPath ? 'draftsCenter__detail--embeddedChat' : ''
					}`}
				>
					{selectedDraft ? (
						<div className="draftsCenter__detailCard">
							<h3 className="draftsCenter__detailTitle">
								{selectedDraft.title ||
									translate('drafts.center.untitledChat', 'Chat')}
							</h3>
							{!embeddedChatPath && (
								<p className="draftsCenter__detailText">
									{selectedDraft.text}
								</p>
							)}
							<div className="draftsCenter__detailActions">
								<button
									type="button"
									className="draftsCenter__openButton"
									onClick={() => handleOpenDraft(selectedDraft)}
								>
									{translate('drafts.center.open', 'Open draft')}
								</button>
								<button
									type="button"
									className="draftsCenter__nextButton"
									onClick={handleNextDraft}
									disabled={!nextDraftKey}
								>
									{translate('drafts.center.next', 'Next draft')}
								</button>
								<button
									type="button"
									className="draftsCenter__deleteButton"
									onClick={() => handleDeleteDraft(selectedDraft)}
								>
									{translate('drafts.center.delete', 'Delete draft')}
								</button>
							</div>
							{embeddedChatPath && (
								<div className="draftsCenter__embeddedSession">
									<iframe
										title="drafts-chat-session"
										src={embeddedChatPath}
										className="draftsCenter__embeddedSessionFrame"
									/>
								</div>
							)}
						</div>
					) : (
						<div className="draftsCenter__empty">
							{translate(
								'drafts.center.emptyDetail',
								'Select a draft to continue writing.'
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

