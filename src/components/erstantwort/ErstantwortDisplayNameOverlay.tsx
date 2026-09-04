import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Overlay, OverlayItem, OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import { BUTTON_TYPES } from '../button/Button';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { regeneratePseudonym } from '../../utils/pseudonymGenerator';
import type { Pseudonym } from '../../utils/pseudonymGenerator';

export interface ErstantwortDisplayNameOverlayProps {
	currentName: string;
	locale: string;
	onClose: () => void;
	onSaved: () => void;
}

/**
 * In-chat re-roll for the advice-seeker display name (#1194 Job 3).
 * Catalogue copy is "neu würfeln" — not free-text (ORISO-Admin#602).
 */
export const ErstantwortDisplayNameOverlay: React.FC<
	ErstantwortDisplayNameOverlayProps
> = ({ currentName, locale, onClose, onSaved }) => {
	const { t } = useTranslation();
	const [pseudonym, setPseudonym] = useState<Pseudonym | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [errorText, setErrorText] = useState<string | null>(null);

	const displayedName = pseudonym?.displayName ?? currentName;

	const reroll = () => {
		if (isSaving) return;
		setErrorText(null);
		setPseudonym(
			regeneratePseudonym(
				pseudonym ?? ({ displayName: currentName } as Pseudonym),
				locale
			)
		);
	};

	const save = () => {
		if (isSaving) return;
		const nameToSave = displayedName;
		setIsSaving(true);
		setErrorText(null);
		apiPatchUserData({ displayName: nameToSave })
			.then(() => {
				setIsSaving(false);
				onSaved();
				onClose();
			})
			.catch(() => {
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
				disabled: isSaving,
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
				<p>
					<strong>{displayedName}</strong>
				</p>
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
