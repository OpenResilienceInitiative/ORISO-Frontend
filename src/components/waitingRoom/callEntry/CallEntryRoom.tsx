import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import HeadphonesRoundedIcon from '@mui/icons-material/HeadphonesRounded';
import { EntryRoomShell } from '../../anonymousChat/entryRoom/EntryRoomShell';
import { WaitingRoomBar } from '../WaitingRoomBar';
import { HandoverGateButton } from '../../app/registrationLoader/HandoverGateButton';
import { allPasswordCriteriaPass } from '../../registration/accountData/passwordRules';
import { REGISTRATION_DATA_VALIDATION } from '../../registration/registrationDataValidation';
import {
	registrationMd3,
	registrationScreenIntroSx,
	registrationScreenTitleSx
} from '../../registration/registrationDesign/registrationDesign';
import { CallEntryIdentity } from './CallEntryIdentity';
import {
	useWaitingRoomConsent,
	WaitingRoomConsentPanel
} from '../WaitingRoomConsent';
import { useConsentSentences } from '../useConsentSentences';
import { toRegistrationUsername } from '../../registration/accountData/registrationUsername';
import {
	generatePseudonym,
	type Pseudonym
} from '../../../utils/pseudonymGenerator';
import { CallNotice } from './CallNotice';
import { DevicePicker } from './DevicePicker';
import { SpeakerTest, SpeakerTestState } from './SpeakerTest';
import { VideoCheck } from './VideoCheck';
import { VoiceCheck } from './VoiceCheck';
import { callEntryCopy as copy } from './callEntryCopy';
import {
	CallDeviceControls,
	CallDeviceKind,
	CallDevices,
	CallDeviceSelection,
	CallEntryBlocker,
	CallModality
} from './callEntryTypes';

/** A level above this once means the microphone demonstrably hears. */
const HEARD_LEVEL = 0.15;

export interface CallEntryRoomProps {
	modality: CallModality;
	devices: CallDevices;
	/** 0–1, from the microphone's analyser (fixture in stories). */
	micLevel: number;
	stream?: MediaStream | null;
	blocker?: CallEntryBlocker;
	/** Who the call is with, shown in the kicker, e.g. "Schuldnerberatung". */
	topic?: string;
	/** Animal and name to start from; a fresh one is rolled otherwise. */
	initialIdentity?: Pseudonym;
	/** Default: derived from the identity, like the registration. */
	initialUsername?: string;
	initialPassword?: string;
	initialMicOn?: boolean;
	initialCameraOn?: boolean;
	initialSpeakerTest?: SpeakerTestState;
	initialMicHeard?: boolean;
	initialSelection?: CallDeviceSelection;
	/** `false` when there is no webcam: the camera stays off. */
	cameraAvailable?: boolean;
	/** Switches and picker choices, for whoever owns the real stream. */
	onDeviceStateChange?: (controls: CallDeviceControls) => void;
	joining?: boolean;
	/**
	 * The consent asked on "Beitreten", with the live chat's sheet (Frank,
	 * 2026-10-16: "per Default ja"). Omitted: the platform sentence. Once the
	 * room is wired, the caller resolves the sentence exactly as the live chat
	 * does (`resolveEntryRoomConsent`: the department's own wording, else the
	 * fixed warning, else the platform's) and passes the department, so the
	 * legal links open its documents. `false` switches the question off.
	 */
	consent?:
		| false
		| {
				html: string;
				department?: { agencyId: number; topicId: number } | null;
		  };
	/** Starts with the consent sheet open, as after a click on "Beitreten". */
	initialConsentOpen?: boolean;
	onJoin?: () => void;
	onBlockerAction?: () => void;
	playTone?: (sinkId?: string) => Promise<void>;
}

/**
 * The call entry (ORISO-Frontend#1386), built from the shared waiting-room
 * parts: `EntryRoomShell` → `WaitingRoomFrame`, `WaitingRoomBar`,
 * `HandoverGateButton`. Prototype in Storybook only; nothing calls Element
 * Call yet.
 *
 * The gate fills with what is really done — User-ID, password, a microphone
 * that has been heard (or is muted on purpose) — and opens when all three
 * are. Nothing else blocks: the camera may stay off, and the speaker test is
 * offered, not required.
 */
export const CallEntryRoom = ({
	modality,
	devices,
	micLevel,
	stream,
	blocker,
	topic,
	initialIdentity,
	initialUsername,
	initialPassword = '',
	initialMicOn = true,
	initialCameraOn = true,
	initialSpeakerTest = 'idle',
	initialMicHeard = false,
	initialSelection = {},
	cameraAvailable = true,
	onDeviceStateChange,
	joining = false,
	consent: consentOption,
	initialConsentOpen = false,
	onJoin,
	onBlockerAction,
	playTone
}: CallEntryRoomProps) => {
	const { i18n } = useTranslation();
	const [identity, setIdentity] = useState<Pseudonym>(
		() =>
			initialIdentity ?? generatePseudonym(i18n.resolvedLanguage ?? 'de')
	);
	const [username, setUsername] = useState(
		() => initialUsername ?? toRegistrationUsername(identity)
	);
	const [password, setPassword] = useState(initialPassword);
	const [micOn, setMicOn] = useState(initialMicOn);
	const [cameraOn, setCameraOn] = useState(initialCameraOn);
	const [speakerTest, setSpeakerTest] = useState(initialSpeakerTest);
	const [micHeard, setMicHeard] = useState(initialMicHeard);
	const [selection, setSelection] = useState(initialSelection);
	const { platformHtml } = useConsentSentences();
	const askConsent = consentOption !== false;
	const consent = useWaitingRoomConsent({
		consentHtml: (consentOption && consentOption.html) || platformHtml,
		department: (consentOption && consentOption.department) || null
	});
	const [consentOpen, setConsentOpen] = useState(
		askConsent && initialConsentOpen
	);

	useEffect(() => {
		if (micOn && micLevel > HEARD_LEVEL) setMicHeard(true);
	}, [micLevel, micOn]);

	useEffect(() => {
		onDeviceStateChange?.({ micOn, cameraOn, selection });
	}, [onDeviceStateChange, micOn, cameraOn, selection]);

	const select = (kind: CallDeviceKind, id: string) => {
		setSelection((current) => ({ ...current, [kind]: id }));
		// A different microphone has not been heard yet.
		if (kind === 'microphone') setMicHeard(false);
		if (kind === 'speaker') setSpeakerTest('idle');
	};

	const conditions = [
		{
			// The registration's own rule, so the gate never opens on a
			// User-ID the account creation would reject.
			done: REGISTRATION_DATA_VALIDATION.username.validation(username),
			missing: copy.missingName
		},
		{
			done: allPasswordCriteriaPass(password),
			missing: copy.missingPassword
		},
		{ done: micHeard || !micOn, missing: copy.missingMicrophone }
	];
	const doneCount = conditions.filter((condition) => condition.done).length;
	const ready = doneCount === conditions.length;
	const missing = conditions
		.filter((condition) => !condition.done)
		.map((condition) => condition.missing)
		.join(', ');

	/* "Beitreten" first opens the consent; with the sheet open it joins once
	   the box is ticked (the live chat's flow). */
	const handleJoin = () => {
		if (!askConsent) {
			onJoin?.();
		} else if (!consentOpen) {
			setConsentOpen(true);
		} else {
			consent.guard(() => onJoin?.());
		}
	};

	const kicker = topic
		? `${copy.kicker[modality]} · ${topic}`
		: copy.kicker[modality];

	if (blocker) {
		const text = copy.blocker[blocker];
		const waiting = blocker === 'notOpenYet';
		return (
			<EntryRoomShell kicker={kicker} statusLine={text.title}>
				<CallNotice blocker={blocker} />
				<WaitingRoomBar>
					<Box sx={{ width: '100%' }}>
						<HandoverGateButton
							state={waiting ? 'queued' : 'ready'}
							indeterminate={waiting}
							// A retry is not progress: the check has not run.
							progress={waiting ? undefined : 0}
							onEnter={onBlockerAction}
							label={text.action}
							status=""
							testingAttribute="call-entry-gate"
						/>
					</Box>
				</WaitingRoomBar>
			</EntryRoomShell>
		);
	}

	const pickerKinds: CallDeviceKind[] =
		modality === 'video'
			? ['camera', 'microphone', 'speaker']
			: ['microphone', 'speaker'];

	return (
		<EntryRoomShell kicker={kicker} statusLine={copy.statusLine[modality]}>
			<Box data-testid="call-entry-room" data-modality={modality}>
				<Typography component="h1" sx={registrationScreenTitleSx}>
					{copy.title[modality]}
				</Typography>
				<Typography sx={{ ...registrationScreenIntroSx, mt: 1 }}>
					{copy.intro[modality]}
				</Typography>
				<Box
					sx={{
						mt: 3,
						display: 'grid',
						gap: { xs: 3, lg: 4 },
						alignItems: 'start',
						gridTemplateColumns: {
							xs: 'minmax(0, 1fr)',
							lg: 'minmax(0, 1.3fr) minmax(0, 1fr)'
						}
					}}
				>
					{/* Identity first: a guest confirms who they are before
					    anything else (Frank, 2026-10-16). First on the phone and
					    for screen readers; the right column on a desktop. */}
					<Box
						data-testid="call-entry-identity-column"
						sx={{ gridColumn: { lg: 2 }, gridRow: { lg: 1 } }}
					>
						<CallEntryIdentity
							modality={modality}
							identity={identity}
							onIdentityChange={setIdentity}
							username={username}
							onUsernameChange={setUsername}
							password={password}
							onPasswordChange={setPassword}
						/>
					</Box>
					{/* Picture or voice, then the devices right under it. */}
					<Box
						data-testid="call-entry-media-column"
						sx={{ gridColumn: { lg: 1 }, gridRow: { lg: 1 } }}
					>
						{modality === 'video' ? (
							<VideoCheck
								name={username}
								avatar={identity.avatar}
								stream={stream}
								cameraOn={cameraOn && cameraAvailable}
								cameraAvailable={cameraAvailable}
								micOn={micOn}
								micLevel={micLevel}
								onToggleCamera={() => setCameraOn(!cameraOn)}
								onToggleMic={() => setMicOn(!micOn)}
							/>
						) : (
							<VoiceCheck
								name={username}
								avatar={identity.avatar}
								micOn={micOn}
								micLevel={micLevel}
								micHeard={micHeard}
								onToggleMic={() => setMicOn(!micOn)}
								speakerTest={speakerTest}
								onSpeakerTest={setSpeakerTest}
								sinkId={selection.speaker}
								playTone={playTone}
							/>
						)}
						<Box sx={{ mt: 2, display: 'grid', gap: 1 }}>
							{pickerKinds.map((kind) => (
								<DevicePicker
									key={kind}
									kind={kind}
									kindLabel={copy.devices[kind]}
									devices={devices[kind]}
									selectedId={selection[kind]}
									onSelect={(id) => select(kind, id)}
								/>
							))}
						</Box>
						{modality === 'video' && (
							<SpeakerTest
								compact
								state={speakerTest}
								onChange={setSpeakerTest}
								sinkId={selection.speaker}
								playTone={playTone}
							/>
						)}
						{modality === 'audio' && (
							<Box
								sx={{
									mt: 2,
									display: 'flex',
									gap: 1.5,
									alignItems: 'flex-start',
									color: registrationMd3.onSurfaceVariant
								}}
							>
								<HeadphonesRoundedIcon
									sx={{ fontSize: 20, mt: '2px' }}
								/>
								<Typography
									sx={{ fontSize: 14, lineHeight: '20px' }}
								>
									{copy.headsetTip}
								</Typography>
							</Box>
						)}
					</Box>
				</Box>
			</Box>
			<WaitingRoomBar
				consent={
					consentOpen ? (
						<WaitingRoomConsentPanel
							consent={consent}
							heading={copy.consent.heading}
							subtitle={copy.consent.subtitle}
							declineLabel={copy.consent.decline}
							onDecline={() => setConsentOpen(false)}
							missingText={copy.consent.missing}
							errorId="callEntryConsentError"
							disabled={joining}
						/>
					) : undefined
				}
			>
				<Box
					sx={{ width: '100%' }}
					data-cy-progress={Math.round(
						(doneCount / conditions.length) * 100
					)}
				>
					<HandoverGateButton
						state={
							joining ? 'entering' : ready ? 'ready' : 'preparing'
						}
						indeterminate={joining}
						progress={
							joining
								? undefined
								: (doneCount / conditions.length) * 100
						}
						onEnter={handleJoin}
						label={copy.join[modality]}
						status={
							joining
								? copy.joining
								: ready
									? copy.allSet
									: `${copy.missing}${missing}`
						}
						testingAttribute="call-entry-gate"
					/>
				</Box>
			</WaitingRoomBar>
		</EntryRoomShell>
	);
};
