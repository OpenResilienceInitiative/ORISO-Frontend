import * as React from 'react';
import {
	useState,
	useEffect,
	useContext,
	useCallback,
	useMemo,
	Suspense
} from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { lazyWithReload } from '../../utils/chunkLoadRecovery';

import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { Button, BUTTON_TYPES } from '../button/Button';
import { endpoints } from '../../resources/scripts/endpoints';
import { buildExtendedSession, ActiveSessionProvider } from '../../globalState';
import {
	STATUS_EMPTY,
	type ListItemInterface
} from '../../globalState/interfaces';

import {
	desktopView,
	mobileDetailView,
	mobileListView
} from '../app/navigationHandler';
import { EmailSentAnimation } from '../animatedIllustration/AnimatedIllustration';
import { ReactComponent as WelcomeIcon } from '../../resources/img/illustrations/welcome.svg';
import './enquiry.styles';
import { focusSessionChromeOnPointerDown } from '../session/focusSessionChrome';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { EnquiryLanguageSelection } from './EnquiryLanguageSelection';
import { LanguagesContext } from '../../globalState/provider/LanguagesProvider';
import { useResponsive } from '../../hooks/useResponsive';

import { Loading } from '../app/Loading';
import { useSession } from '../../hooks/useSession';
import { apiGetAskerSessionList } from '../../api';
import { useTranslation } from 'react-i18next';
import { MessageSubmitInterfaceSkeleton } from '../messageSubmitInterface/messageSubmitInterfaceSkeleton';
import { isMatrixRoomIdHeuristic } from '../../utils/matrixRoomUtils';
import { loadMessageComposer } from '../app/appChunks';

const MessageSubmitInterfaceComponent = lazyWithReload(loadMessageComposer);

/**
 * ADR-018 §10: the send confirmation closes when the first Erstantwort bubble
 * is up, with this as the upper bound. The shared `OVERLAY_RESET_TIME` of 10 s
 * held the modal over the chat long after the answer had arrived behind it.
 */
const ENQUIRY_CONFIRMATION_CLOSE_MS = 3000;

type EnquiryListResult = { requestedId: number | null } & (
	| { status: 'found'; session: ListItemInterface; isFirstEnquiry: boolean }
	| { status: 'missing' | 'failed' }
);

export const WriteEnquiry: React.FC = () => {
	const { t: translate } = useTranslation();
	const { sessionId } = useParams<{ sessionId: string }>();
	const parsedId = Number(sessionId);
	const invalidSessionId =
		sessionId !== undefined &&
		(!/^\d+$/.test(sessionId) ||
			!Number.isSafeInteger(parsedId) ||
			parsedId < 1);
	const requestedId =
		sessionId !== undefined && !invalidSessionId ? parsedId : null;
	const navigate = useNavigate();

	const { fixed: fixedLanguages } = useContext(LanguagesContext);

	const [overlayActive, setOverlayActive] = useState(false);
	const [redirectSessionId, setRedirectSessionId] = useState<number | null>(
		null
	);
	const [redirectGroupId, setRedirectGroupId] = useState<string | null>(null);
	const [selectedLanguage, setSelectedLanguage] = useState(fixedLanguages[0]);
	const [listResult, setListResult] = useState<EnquiryListResult | null>(
		null
	);
	const [loadAttempt, setLoadAttempt] = useState(0);
	const { session, ready: sessionReady } = useSession(null, requestedId);
	// Ignore a previous session retained by the hook while this ID loads.
	const exactSession =
		requestedId !== null &&
		!session?.isGroup &&
		session?.item?.id === requestedId
			? session
			: null;
	const currentListResult =
		listResult?.requestedId === requestedId ? listResult : null;
	const fallback =
		currentListResult?.status === 'found' ? currentListResult : null;
	const activeSession = useMemo(
		() =>
			exactSession ??
			(fallback && buildExtendedSession(fallback.session)),
		[exactSession, fallback]
	);
	const isFirstEnquiry = !exactSession && Boolean(fallback?.isFirstEnquiry);

	useEffect(() => {
		if (
			invalidSessionId ||
			exactSession ||
			(requestedId !== null && !sessionReady)
		) {
			return;
		}
		let cancelled = false;
		apiGetAskerSessionList({ strict: true })
			.then(({ sessions }: { sessions: ListItemInterface[] }) => {
				if (cancelled) return;
				const candidate = sessions.find(
					({ chat, session }) =>
						!chat &&
						session?.status === STATUS_EMPTY &&
						(requestedId === null
							? sessions.length === 1
							: session.id === requestedId)
				);
				if (candidate) {
					setListResult({
						requestedId,
						status: 'found',
						session: candidate,
						isFirstEnquiry: sessions.length === 1
					});
				} else {
					setListResult({ requestedId, status: 'missing' });
				}
			})
			.catch(() => {
				if (!cancelled)
					setListResult({ requestedId, status: 'failed' });
			});
		return () => {
			cancelled = true;
		};
	}, [
		exactSession,
		invalidSessionId,
		loadAttempt,
		requestedId,
		sessionReady
	]);

	const { fromL } = useResponsive();
	useEffect(() => {
		if (!isFirstEnquiry) {
			if (!fromL) {
				mobileDetailView();
				return () => {
					mobileListView();
				};
			}
			desktopView();
		} else {
			deactivateListView();
		}
	}, [fromL, isFirstEnquiry]);

	const handleOverlayAction = (buttonFunction: string): void => {
		if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT) {
			activateListView();
			const pathname = isMatrixRoomIdHeuristic(redirectGroupId)
				? `${endpoints.userSessionsListView}/session/${redirectSessionId}`
				: `${endpoints.userSessionsListView}/${redirectGroupId}/${redirectSessionId}`;
			navigate({
				pathname
			});
		}
	};

	const activateListView = () => {
		document
			.querySelector('.contentWrapper__list')
			?.classList.remove('contentWrapper__list--hidden');
		document
			.querySelector('.navigation__wrapper')
			?.classList.remove('navigation__wrapper--mobileHidden');
		document.querySelector('.header')?.classList.remove('header--mobile');

		if (window.innerWidth <= 900) {
			const contentWrapper = document.querySelector(
				'.contentWrapper__detail'
			);
			contentWrapper?.classList.add(
				'contentWrapper__detail--smallInactive'
			);
		}
	};

	const deactivateListView = () => {
		document
			.querySelector('.contentWrapper__list')
			?.classList.add('contentWrapper__list--hidden');
		document
			.querySelector('.navigation__wrapper')
			?.classList.add('navigation__wrapper--mobileHidden');
		document.querySelector('.header')?.classList.add('header--mobile');

		const contentWrapper = document.querySelector(
			'.contentWrapper__detail'
		);
		contentWrapper?.setAttribute('style', 'width: 100%');

		if (window.innerWidth <= 900) {
			contentWrapper?.classList.remove(
				'contentWrapper__detail--smallInactive'
			);
		}
	};

	/* ADR-018 §10 hollows this out. It acknowledges dispatch and nothing else:
	   the Antwortfrist now has exactly one owner, the `responseDeadline`
	   Baustein of the Erstantwort, so restating it here could only ever produce
	   a second version to disagree with. And it closes after ~3 s rather than
	   the shared 10 s, because the Erstantwort is already arriving behind it —
	   `deadlineOwnership.test.ts` guards the wording. */
	const overlayItem: OverlayItem = {
		svg: EmailSentAnimation,
		headline: translate('enquiry.write.overlay.headline'),
		copy: translate('enquiry.write.overlay.copy'),
		buttonSet: [
			{
				label: translate('enquiry.write.overlay.button'),
				function: OVERLAY_FUNCTIONS.REDIRECT,
				type: BUTTON_TYPES.AUTO_CLOSE,
				autoCloseMs: ENQUIRY_CONFIRMATION_CLOSE_MS
			}
		]
	};

	const handleSendButton = useCallback(async (response) => {
		setRedirectSessionId(response.sessionId);
		setRedirectGroupId(response.matrixRoomId);
		setOverlayActive(true);
	}, []);

	if (!activeSession) {
		if (invalidSessionId || currentListResult?.status === 'missing') {
			return <Navigate to={endpoints.userSessionsListView} replace />;
		}
		if (currentListResult?.status === 'failed') {
			return (
				<div className="enquiry__contentWrapper">
					<Text
						text={translate('error.statusCodes.500.description')}
						type="standard"
					/>
					<Button
						item={{
							label: translate('sessionList.reloadButton.label'),
							type: BUTTON_TYPES.SECONDARY
						}}
						buttonHandle={() => {
							setListResult(null);
							setLoadAttempt((attempt) => attempt + 1);
						}}
					/>
				</div>
			);
		}
		return <Loading />;
	}

	const isUnassignedSession = activeSession && !activeSession?.consultant;

	return (
		<div
			className="enquiry__wrapper"
			tabIndex={-1}
			onMouseDown={focusSessionChromeOnPointerDown}
		>
			<div className="enquiry__contentWrapper">
				<div className="enquiry__infoWrapper">
					<div className="enquiry__text">
						<Headline
							semanticLevel="3"
							text={translate('enquiry.write.infotext.headline')}
							className="enquiry__infotextHeadline"
						/>
						<Headline
							semanticLevel="4"
							styleLevel="5"
							text={translate(
								'enquiry.write.infotext.copy.title'
							)}
						/>
						<Text
							text={translate(
								'enquiry.write.infotext.copy.facts'
							)}
							type="standard"
							className="enquiry__facts"
						/>
					</div>
					<WelcomeIcon
						className="enquiry__image"
						title={translate('enquiry.write.infotext.iconTitle')}
						aria-label={translate(
							'enquiry.write.infotext.iconTitle'
						)}
					/>
				</div>
				{isUnassignedSession && (
					<EnquiryLanguageSelection
						className="enquiry__languageSelection"
						onSelect={setSelectedLanguage}
						value={selectedLanguage}
					/>
				)}
			</div>
			<Text
				text={translate('enquiry.write.infotext.deletionNotice')}
				type="infoLargeAlternative"
				className="enquiry__deletionNotice"
			/>
			<ActiveSessionProvider activeSession={activeSession}>
				<Suspense
					fallback={
						<MessageSubmitInterfaceSkeleton
							placeholder={translate(
								'enquiry.write.input.placeholder.asker'
							)}
						/>
					}
				>
					<MessageSubmitInterfaceComponent
						onSendButton={handleSendButton}
						placeholder={translate(
							'enquiry.write.input.placeholder.asker'
						)}
						language={selectedLanguage}
					/>
				</Suspense>
			</ActiveSessionProvider>
			{overlayActive && (
				<Overlay
					item={overlayItem}
					handleOverlay={handleOverlayAction}
				/>
			)}
		</div>
	);
};
