import * as React from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserDataContext } from '../../globalState';
import { useOpenTwoFactorSettings } from '../../hooks/useOpenTwoFactorSettings';
import { ErstantwortSequence } from './ErstantwortSequence';
import { ErstantwortEmailOverlay } from './ErstantwortEmailOverlay';
import { SaveCredentialsCard } from './SaveCredentialsCard';
import { ErstantwortActionKind } from './erstantwortPayload';
import {
	ErstantwortLiveState,
	resolveErstantwortBausteine
} from './erstantwortResolve';
import { ErstantwortTrigger } from './erstantwortCatalogue';

/**
 * The chat-side container for the Erstantwort (ADR-018, ORISO-Frontend#772).
 *
 * It does exactly two things the pure renderer must not do: it reads the **live
 * completion state** (e-mail present, 2FA active) so an already-satisfied
 * action loses its button, and it wires the buttons to the routed endpoints
 * that already work. No new state, no new table, no new endpoint — ADR-018 §4.
 */

export interface ErstantwortMessageProps {
	/** The raw, already decrypted message body of the FIRST_RESPONSE event. */
	rawMessage?: string | null;
	/** Used only when no event exists — the client-side triggers of #825. */
	trigger?: ErstantwortTrigger;
	conversationType?: string | null;
	deadlineDays?: number;
	/**
	 * ORISO-Admin#602 switch 2. Left `undefined` until that card ships, which
	 * reads as "enabled" — the setting is opt-out and an unconfigured tenant
	 * must keep today's behaviour.
	 */
	isAskerEmailEnabled?: boolean;
	/** Re-renders of history skip the stagger; a fresh event plays it. */
	skipAnimation?: boolean;
	onFirstReveal?: () => void;
}

export const ErstantwortMessage: React.FC<ErstantwortMessageProps> = ({
	rawMessage,
	trigger,
	conversationType,
	deadlineDays,
	isAskerEmailEnabled,
	skipAnimation,
	onFirstReveal
}) => {
	const { t } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const openTwoFactorSettings = useOpenTwoFactorSettings();
	const navigate = useNavigate();
	const [isEmailOverlayOpen, setIsEmailOverlayOpen] = useState(false);

	const state: ErstantwortLiveState = useMemo(
		() => ({
			hasEmail: Boolean(userData?.email),
			isTwoFactorEnabled: Boolean(userData?.twoFactorAuth?.isEnabled),
			isTwoFactorActive: Boolean(userData?.twoFactorAuth?.isActive),
			isAskerEmailEnabled
		}),
		[
			userData?.email,
			userData?.twoFactorAuth?.isEnabled,
			userData?.twoFactorAuth?.isActive,
			isAskerEmailEnabled
		]
	);

	const { bausteine } = useMemo(
		() =>
			resolveErstantwortBausteine({
				rawMessage,
				trigger,
				context: { conversationType, deadlineDays },
				translate: (key, defaultValue) => t(key, defaultValue),
				state
			}),
		[rawMessage, trigger, conversationType, deadlineDays, t, state]
	);

	const handleAction = useCallback(
		(kind: ErstantwortActionKind) => {
			switch (kind) {
				case 'ADD_EMAIL':
					setIsEmailOverlayOpen(true);
					break;
				case 'ENABLE_2FA':
					openTwoFactorSettings();
					break;
				case 'SET_DISPLAY_NAME':
					/* The display-name setting takes effect at assignment time
					   and lives in the profile. Whether free entry is offered at
					   all is governed by ORISO-Admin#602 switch 1; until that
					   ships, the profile's own rules apply unchanged. */
					navigate('/profile');
					break;
				case 'SAVE_CREDENTIALS':
					/* Handled inline by SaveCredentialsCard — there is no dialog
					   to open. The button exists only for keyboard users who
					   reach it before the card. */
					break;
				default:
					break;
			}
		},
		[navigate, openTwoFactorSettings]
	);

	if (!bausteine.length) return null;

	return (
		<>
			<ErstantwortSequence
				bausteine={bausteine}
				skipAnimation={skipAnimation}
				onAction={handleAction}
				onFirstReveal={onFirstReveal}
				slots={{
					saveCredentials: (
						<SaveCredentialsCard
							userName={userData?.userName ?? ''}
						/>
					)
				}}
			/>
			{isEmailOverlayOpen && (
				<ErstantwortEmailOverlay
					onClose={() => setIsEmailOverlayOpen(false)}
					onSaved={reloadUserData}
				/>
			)}
		</>
	);
};
