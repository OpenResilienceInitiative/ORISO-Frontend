import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Overlay, OverlayItem, OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import { BUTTON_TYPES } from '../button/Button';
import { apiPutSessionData } from '../../api/apiPutSessionData';
import { regeneratePseudonym } from '../../utils/pseudonymGenerator';
import type { Pseudonym } from '../../utils/pseudonymGenerator';
import { AskerDisplayNameField } from '../pseudonym/AskerDisplayNameField';

export interface ErstantwortDisplayNameOverlayProps {
	sessionId: number;
	currentName: string;
	editable?: boolean;
	locale: string;
	onClose: () => void;
	onSaved: () => void;
}

/**
 * Edit this session's alias, with generated alternatives always available.
 * Admin#602 controls free entry; the login User-ID is never patched.
 */
export const ErstantwortDisplayNameOverlay: React.FC<
	ErstantwortDisplayNameOverlayProps
> = ({
	sessionId,
	currentName,
	locale,
	editable = false,
	onClose,
	onSaved
}) => {
	const { t } = useTranslation();
	const active = useRef(true);
	useEffect(() => {
		active.current = true;
		return () => {
			active.current = false;
		};
	}, []);
	const [pseudonym, setPseudonym] = useState<Pseudonym | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [errorText, setErrorText] = useState<string | null>(null);

	const [customName, setCustomName] = useState<string | null>(null);
	const displayedName =
		editable && customName !== null
			? customName
			: (pseudonym?.displayName ?? currentName);

	const reroll = () => {
		if (isSaving) return;
		setErrorText(null);
		setCustomName(null);
		setPseudonym(
			regeneratePseudonym(
				pseudonym ?? ({ displayName: currentName } as Pseudonym),
				locale
			)
		);
	};

	const save = () => {
		if (isSaving) return;
		const nameToSave = displayedName.trim();
		if (!nameToSave || nameToSave.length > 255) return;
		setIsSaving(true);
		setErrorText(null);
		apiPutSessionData(sessionId, { displayName: nameToSave })
			.then(() => {
				if (!active.current) return;
				setIsSaving(false);
				onSaved();
				onClose();
			})
			.catch(() => {
				if (!active.current) return;
				setIsSaving(false);
				setErrorText(
					t(
						'erstantwort.displayName.overlay.saveFailed',
						'Saving failed. Please try again.'
					)
				);
			});
	};

	const formItem: OverlayItem = {
		buttonSet: [
			{
				disabled: isSaving || !displayedName.trim(),
				label: t('erstantwort.displayName.overlay.save', 'Übernehmen'),
				type: BUTTON_TYPES.PRIMARY
			},
			{
				label: t('furtherSteps.email.overlay.button2.label', 'Close'),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.SECONDARY
			}
		],
		headline: t(
			'erstantwort.displayName.overlay.headline',
			'Ihr angezeigter Name'
		),
		copy:
			errorText ??
			t(
				'erstantwort.displayName.overlay.copy',
				'Im Gespräch erscheinen Sie unter einem zufällig erzeugten Namen. Sie können ihn jederzeit neu würfeln.'
			),
		nestedComponent: (
			<div>
				<AskerDisplayNameField
					value={displayedName}
					onChange={setCustomName}
					editable={editable}
					disabled={isSaving}
				/>
				<button type="button" disabled={isSaving} onClick={reroll}>
					{t(
						'erstantwort.displayName.overlay.reroll',
						'Namen neu würfeln'
					)}
				</button>
			</div>
		)
	};

	return (
		<Overlay
			item={formItem}
			handleOverlay={(buttonFunction: string) => {
				if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
					onClose();
					return;
				}
				save();
			}}
		/>
	);
};
