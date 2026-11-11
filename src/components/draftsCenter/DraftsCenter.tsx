import * as React from 'react';
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	apiDeleteUserDraft,
	type IUserDraftItem
} from '../../api/apiUserDrafts';
import { useRemoteDrafts } from '../../hooks/useRemoteDrafts';
import {
	getDraftNavigationScope,
	toDraftResumePath
} from '../../services/draftNavigation';
import {
	getDraftAuthSessionIdentity,
	getDraftCryptographyForWindow,
	registerDraftCryptographyFrame,
	subscribeDraftCryptographyForWindow
} from '../../services/draftCryptographyWindow';
import { useResponsive } from '../../hooks/useResponsive';
import './draftsCenter.styles';
import { isComposerFullscreenMessage } from '../../utils/embeddedComposerFullscreen';

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

const getDraftPreviewText = (rawText?: string | null) => {
	if (!rawText) {
		return '';
	}
	const htmlToText = (input: string) => {
		if (typeof window === 'undefined') {
			return input.replace(/<[^>]*>/g, ' ');
		}
		const parser = new DOMParser();
		const doc = parser.parseFromString(input, 'text/html');
		return doc.body.textContent || '';
	};
	const normalized = rawText
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<\/blockquote>/gi, '\n');
	return htmlToText(normalized)
		.replace(/\n{3,}/g, '\n\n')
		.trim();
};

export const DraftsCenter = () => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	const { untilL } = useResponsive();
	const [selectedDraftKey, setSelectedDraftKey] = useState<string | null>(
		null
	);
	const embeddedFrameRef = useRef<HTMLIFrameElement | null>(null);
	const unregisterFrame = useRef<(() => void) | null>(null);
	const setEmbeddedFrame = useCallback((frame: HTMLIFrameElement | null) => {
		unregisterFrame.current?.();
		embeddedFrameRef.current = frame;
		unregisterFrame.current = frame
			? registerDraftCryptographyFrame(frame)
			: null;
	}, []);
	const [embeddedFullscreen, setEmbeddedFullscreen] = useState(false);

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (
				event.origin !== window.location.origin ||
				event.source !== embeddedFrameRef.current?.contentWindow ||
				!isComposerFullscreenMessage(event.data)
			) {
				return;
			}
			setEmbeddedFullscreen(event.data.expanded);
		};
		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	}, []);
	const drafts = useRemoteDrafts();
	const draftOwner = useSyncExternalStore(
		subscribeDraftCryptographyForWindow,
		getDraftAuthSessionIdentity,
		() => null
	);
	const draftCryptography = useSyncExternalStore(
		subscribeDraftCryptographyForWindow,
		getDraftCryptographyForWindow,
		() => null
	);

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
		() =>
			drafts.find((entry) => entry.scopeKey === selectedDraftKey) || null,
		[drafts, selectedDraftKey]
	);
	const embeddedChatPath = selectedDraft
		? toDraftResumePath(selectedDraft, true)
		: null;
	// A replaced frame starts collapsed and never posts `false`.
	useEffect(() => {
		setEmbeddedFullscreen(false);
	}, [embeddedChatPath]);
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
			const path = toDraftResumePath(entry);
			if (path) navigate(path);
		},
		[navigate]
	);

	const handleSelectDraft = useCallback(
		(entry: IUserDraftItem) => {
			if (untilL) {
				handleOpenDraft(entry);
				return;
			}
			setSelectedDraftKey(entry.scopeKey);
		},
		[handleOpenDraft, untilL]
	);

	const handleDeleteDraft = useCallback((entry: IUserDraftItem) => {
		const scope = getDraftNavigationScope(entry);
		if (scope) void apiDeleteUserDraft(scope);
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
					{translate('drafts.center.title')}
				</h2>
				<p className="draftsCenter__subtitle">
					{translate('drafts.center.subtitle')}
				</p>
			</div>
			<div className="draftsCenter__content">
				<div className="draftsCenter__list">
					{drafts.length === 0 ? (
						<div className="draftsCenter__empty">
							{draftOwner && !draftCryptography ? (
								<Link to="/profile/einstellungen/sicherheit">
									{translate(
										'profile.encryption.recover.cta'
									)}
								</Link>
							) : (
								translate('drafts.center.empty')
							)}
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
								onClick={() => handleSelectDraft(entry)}
							>
								<div className="draftsCenter__listItemTagRow">
									<span className="draftsCenter__listItemTag">
										{translate('drafts.center.messageTag')}
									</span>
								</div>
								<div className="draftsCenter__listItemHeader">
									<span className="draftsCenter__listItemTitle">
										{entry.title ||
											translate(
												'drafts.center.untitledChat'
											)}
									</span>
									<span className="draftsCenter__listItemTime">
										{formatRelativeTime(entry.updatedAt)}
									</span>
								</div>
								<p className="draftsCenter__listItemText">
									{getDraftPreviewText(entry.text)}
								</p>
								{entry.threadRootId && (
									<span className="draftsCenter__threadTag">
										{translate('drafts.center.thread')}
									</span>
								)}
							</button>
						))
					)}
				</div>
				<div
					className={`draftsCenter__detail ${
						embeddedChatPath
							? 'draftsCenter__detail--embeddedChat'
							: ''
					}`}
				>
					{selectedDraft ? (
						<div className="draftsCenter__detailCard">
							<h3 className="draftsCenter__detailTitle">
								{selectedDraft.title ||
									translate('drafts.center.untitledChat')}
							</h3>
							<div className="draftsCenter__detailActions">
								<button
									type="button"
									className="draftsCenter__openButton"
									onClick={() =>
										handleOpenDraft(selectedDraft)
									}
								>
									{translate('drafts.center.open')}
								</button>
								<button
									type="button"
									className="draftsCenter__nextButton"
									onClick={handleNextDraft}
									disabled={!nextDraftKey}
								>
									{translate('drafts.center.next')}
								</button>
								<button
									type="button"
									className="draftsCenter__deleteButton"
									onClick={() =>
										handleDeleteDraft(selectedDraft)
									}
								>
									{translate('drafts.center.delete')}
								</button>
							</div>
							{embeddedChatPath && (
								<div
									className={`draftsCenter__embeddedSession ${
										embeddedFullscreen
											? 'draftsCenter__embeddedSession--fullscreen'
											: ''
									}`}
								>
									<iframe
										ref={setEmbeddedFrame}
										key={embeddedChatPath}
										title={translate(
											'drafts.center.embeddedTitle'
										)}
										src={embeddedChatPath}
										className="draftsCenter__embeddedSessionFrame"
									/>
								</div>
							)}
						</div>
					) : (
						<div className="draftsCenter__empty">
							{translate('drafts.center.emptyDetail')}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
