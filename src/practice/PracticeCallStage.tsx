import * as React from 'react';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import ButtonBase from '@mui/material/ButtonBase';
import { CallSurfaceLayer } from '../components/call/states/CallSurfaceLayer';
import { DockedCall } from '../components/call/states/DockedCall';
import { formatCallDuration } from '../components/call/states/MinimizedCallDock';
import { UserAvatar } from '../components/message/UserAvatar';
import { ICON_INFO, SystemMessage } from '../components/message/SystemMessage';
import { UserDataContext } from '../globalState/context/UserDataContext';
import { ReactComponent as MicOffIcon } from '../resources/img/icons/audio-off.svg';
import { ReactComponent as MicOnIcon } from '../resources/img/icons/audio-on.svg';
import { ReactComponent as CameraOnIcon } from '../resources/img/icons/camera-on.svg';
import { ReactComponent as CameraOffIcon } from '../resources/img/icons/camera-off.svg';
import { ReactComponent as MinimizeIcon } from '../resources/img/icons/minimize-content.svg';
import { ReactComponent as HangUpIcon } from '../resources/img/icons/call.svg';
import {
	expandPracticeCall,
	getPracticeCallLevel,
	getPracticeCallState,
	getPracticeCallStream,
	leavePracticeCall,
	minimisePracticeCall,
	requestPracticeCallMedia,
	setPracticeCallLines,
	subscribePracticeCall,
	togglePracticeCallCamera,
	togglePracticeCallMute,
	type PracticeCallState
} from './practiceCallStore';
import { PRACTICE_CALL_TARGETS } from './practiceCallTargets';
import '../components/call/states/callStates.scss';
import '../components/message/message.styles.scss';
import './practiceCallStage.styles.scss';

const MIA_ID = 'practice-mia';
const LINE_KEYS = [
	'practice.callStage.line1',
	'practice.callStage.line2',
	'practice.callStage.line3'
];

export interface PracticeCallPerson {
	username: string;
	userId: string;
	displayName?: string;
	firstName?: string;
	lastName?: string;
}

export interface PracticeCallStageViewProps
	extends Omit<PracticeCallState, 'status'> {
	status: Exclude<PracticeCallState['status'], 'closed'>;
	/** The counsellor; the initials stand in for the camera. */
	self: PracticeCallPerson;
	/** The local preview while permission is granted. */
	stream?: MediaStream | null;
	/** Mia's lines in the page language; `captionIndex` picks one. */
	lines: string[];
	/** Mia's output level, 0..1, read every frame for the ring. */
	getLevel?: () => number;
	onToggleMute: () => void;
	onToggleCamera: () => void;
	onMinimise: () => void;
	onExpand: () => void;
	onLeave: () => void;
	/** Called once the stage is on screen (asks for camera and microphone). */
	onShown?: () => void;
}

/**
 * The ring around Mia's tile follows the generated level, frame by frame,
 * through a CSS variable: no React render per frame.
 */
const useSpeakingLevel = (
	ref: React.RefObject<HTMLElement | null>,
	getLevel: (() => number) | undefined,
	speaking: boolean
) => {
	useEffect(() => {
		const node = ref.current;
		if (!node) return undefined;
		if (!getLevel || !speaking) {
			node.style.setProperty('--practice-call-level', '0');
			return undefined;
		}
		const frame =
			window.requestAnimationFrame?.bind(window) ??
			((run: FrameRequestCallback) =>
				window.setTimeout(() => run(Date.now()), 50));
		const cancel =
			window.cancelAnimationFrame?.bind(window) ??
			((id: number) => window.clearTimeout(id));
		let smoothed = 0;
		let id = 0;
		const tick = () => {
			const level = getLevel();
			smoothed = Math.max(level, smoothed * 0.85);
			node.style.setProperty(
				'--practice-call-level',
				smoothed.toFixed(3)
			);
			id = frame(tick);
		};
		id = frame(tick);
		return () => {
			cancel(id);
			node.style.setProperty('--practice-call-level', '0');
		};
	}, [ref, getLevel, speaking]);
};

const StageClock = ({ startedAt }: { startedAt: number }) => {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);
	return (
		<span className="practice-call-stage__clock">
			{formatCallDuration((now - startedAt) / 1000)}
		</span>
	);
};

const OwnPreview = ({ stream }: { stream: MediaStream }) => {
	const video = useRef<HTMLVideoElement>(null);
	useEffect(() => {
		if (video.current) video.current.srcObject = stream;
	}, [stream]);
	return (
		<video
			ref={video}
			className="practice-call-tile__video"
			autoPlay
			muted
			playsInline
			data-testid="practice-call-own-video"
		/>
	);
};

/**
 * The practice call as the Element Call group stage shows it: two tiles,
 * captions, a control bar. Minimised, the app's real dock stands in.
 */
export const PracticeCallStageView = ({
	status,
	muted,
	cameraOff,
	media,
	startedAt,
	captionIndex,
	self,
	stream,
	lines,
	getLevel,
	onToggleMute,
	onToggleCamera,
	onMinimise,
	onExpand,
	onLeave,
	onShown
}: PracticeCallStageViewProps) => {
	const { t: translate } = useTranslation();
	const miaTile = useRef<HTMLElement>(null);
	const speaking = captionIndex !== null;
	const caption = captionIndex === null ? null : lines[captionIndex];
	const miaName = translate('practice.callStage.miaName');
	const youName = translate('practice.callStage.you');
	useSpeakingLevel(miaTile, getLevel, speaking && status === 'open');
	useEffect(() => {
		if (status === 'open') onShown?.();
	}, [status, onShown]);

	const mia = useMemo(
		() => ({
			userId: MIA_ID,
			username: miaName,
			displayName: miaName,
			// Her initials come from the name without "(Übung)".
			avatarDisplayName: miaName.replace(/\s*\([^)]*\)\s*$/, ''),
			choice: { kind: 'initials' as const }
		}),
		[miaName]
	);

	if (status === 'minimised') {
		return (
			<DockedCall
				party={{ name: miaName, avatar: mia }}
				isGroup
				startedAt={startedAt}
				isMuted={muted}
				isVideo
				isCameraOff={cameraOff}
				isSpeaking={speaking}
				onToggleMute={onToggleMute}
				onToggleCamera={onToggleCamera}
				onHangUp={onLeave}
				onExpand={onExpand}
				tourTarget={PRACTICE_CALL_TARGETS.dock}
				expandTourTarget={PRACTICE_CALL_TARGETS.expand}
				autoFocus
			/>
		);
	}

	const showVideo = media === 'granted' && !cameraOff && stream;
	return (
		<CallSurfaceLayer className="practice-call-layer">
			<section
				className="practice-call-stage"
				aria-label={translate('practice.callStage.label')}
				data-tour-target={PRACTICE_CALL_TARGETS.stage}
				data-testid="practice-call-stage"
			>
				<header className="practice-call-stage__header">
					<span className="practice-call-stage__title">
						{translate('practice.callStage.title')}
					</span>
					<StageClock startedAt={startedAt} />
				</header>

				<div className="practice-call-stage__notices">
					<div className="practice-call-stage__notice">
						<SystemMessage
							icon={ICON_INFO}
							subject={
								<>{translate('practice.callStage.notice')}</>
							}
						/>
					</div>
					{media === 'denied' && (
						<div
							className="practice-call-stage__notice"
							data-testid="practice-call-no-media"
						>
							<SystemMessage
								icon={ICON_INFO}
								subject={
									<>
										{translate(
											'practice.callStage.noMedia'
										)}
									</>
								}
							/>
						</div>
					)}
				</div>

				<div className="practice-call-stage__grid">
					<figure
						className="practice-call-tile"
						data-testid="practice-call-own-tile"
					>
						{showVideo ? (
							<OwnPreview stream={stream} />
						) : (
							<span className="practice-call-tile__avatar">
								<UserAvatar
									{...self}
									choice={{ kind: 'initials' }}
									size={96}
								/>
							</span>
						)}
						<figcaption className="practice-call-tile__name">
							{muted && (
								<MicOffIcon
									className="practice-call-tile__muted"
									aria-label={translate('calls.mute')}
								/>
							)}
							{youName}
						</figcaption>
					</figure>
					<figure
						ref={miaTile}
						className="practice-call-tile practice-call-tile--speaker"
						data-speaking={speaking ? 'true' : undefined}
						data-testid="practice-call-mia-tile"
					>
						<span className="practice-call-tile__avatar practice-call-tile__ring">
							<UserAvatar {...mia} size={96} />
						</span>
						<figcaption className="practice-call-tile__name">
							{miaName}
						</figcaption>
					</figure>
				</div>

				<p
					className="practice-call-stage__caption"
					aria-live="polite"
					data-testid="practice-call-caption"
				>
					{caption && (
						<>
							<strong>{miaName}:</strong> {caption}
						</>
					)}
				</p>
				<span className="call-visually-hidden" aria-live="polite">
					{speaking
						? translate('calls.states.speaking', { name: miaName })
						: ''}
				</span>

				<div className="practice-call-stage__controls">
					<ButtonBase
						className={`practice-call-stage__control${muted ? ' practice-call-stage__control--off' : ''}`}
						onClick={onToggleMute}
						aria-pressed={muted}
						aria-label={translate(
							muted ? 'calls.unmute' : 'calls.mute'
						)}
						data-tour-target={PRACTICE_CALL_TARGETS.mute}
					>
						{muted ? (
							<MicOffIcon aria-hidden="true" />
						) : (
							<MicOnIcon aria-hidden="true" />
						)}
					</ButtonBase>
					<ButtonBase
						className={`practice-call-stage__control${cameraOff ? ' practice-call-stage__control--off' : ''}`}
						onClick={onToggleCamera}
						aria-pressed={cameraOff}
						aria-label={translate(
							cameraOff
								? 'calls.turnOnVideo'
								: 'calls.turnOffVideo'
						)}
						data-tour-target={PRACTICE_CALL_TARGETS.camera}
					>
						{cameraOff ? (
							<CameraOffIcon aria-hidden="true" />
						) : (
							<CameraOnIcon aria-hidden="true" />
						)}
					</ButtonBase>
					<ButtonBase
						className="practice-call-stage__control"
						onClick={onMinimise}
						aria-label={translate('calls.states.minimize')}
						data-tour-target={PRACTICE_CALL_TARGETS.minimise}
					>
						<MinimizeIcon aria-hidden="true" />
					</ButtonBase>
					<ButtonBase
						className="call-fab call-fab--hangup"
						onClick={onLeave}
						aria-label={translate('calls.endCall')}
						data-tour-target={PRACTICE_CALL_TARGETS.leave}
					>
						<HangUpIcon aria-hidden="true" />
					</ButtonBase>
				</div>
			</section>
		</CallSurfaceLayer>
	);
};

const NO_USER: PracticeCallPerson = { username: '', userId: '' };

/**
 * Mounted once by the practice sandbox: the stage or the dock while the
 * practice call is open, nothing otherwise. Unmounting it (end of practice)
 * stops every track and closes the audio.
 */
export const PracticeCallLayer = () => {
	const { t: translate, i18n } = useTranslation();
	const state = useSyncExternalStore(
		subscribePracticeCall,
		getPracticeCallState,
		getPracticeCallState
	);
	const userData = useContext(UserDataContext)?.userData;
	const self: PracticeCallPerson = userData
		? {
				username: userData.userName,
				userId: userData.userId,
				displayName: userData.displayName,
				firstName: userData.firstName,
				lastName: userData.lastName
			}
		: NO_USER;
	const lines = useMemo(
		() => LINE_KEYS.map((key) => translate(key)),
		// The language decides the lines.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[translate, i18n?.language]
	);
	useEffect(() => setPracticeCallLines(lines), [lines]);
	useEffect(() => () => leavePracticeCall(), []);

	if (state.status === 'closed') return null;
	const { status, ...rest } = state;
	return (
		<PracticeCallStageView
			{...rest}
			status={status}
			self={self}
			stream={getPracticeCallStream()}
			lines={lines}
			getLevel={getPracticeCallLevel}
			onToggleMute={togglePracticeCallMute}
			onToggleCamera={togglePracticeCallCamera}
			onMinimise={minimisePracticeCall}
			onExpand={expandPracticeCall}
			onLeave={leavePracticeCall}
			onShown={requestPracticeCallMedia}
		/>
	);
};
