import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Overlay, OverlayItem, OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import { BUTTON_TYPES } from '../button/Button';
import {
	InputField,
	InputFieldItem,
	InputFieldLabelState
} from '../inputField/InputField';
import { isStringValidEmail } from '../registration/registrationHelpers';
import { apiPutEmail, FETCH_ERRORS, X_REASON } from '../../api';
import { ReactComponent as EnvelopeIcon } from '../../resources/img/icons/envelope.svg';
import { ReactComponent as EnvelopeIllustration } from '../../resources/img/illustrations/envelope-check.svg';
import { ReactComponent as SuccessIllustration } from '../../resources/img/illustrations/check.svg';

/**
 * The "leave an e-mail address" dialog behind the Erstantwort's ADD_EMAIL
 * action. Lifted out of `FurtherSteps.tsx`, which ADR-018 retires, so the
 * working part of that component survives its transport.
 *
 * One behaviour is deliberately **not** carried over: the original set
 * `isRequestInProgress` before the request and only cleared it again on success
 * or on `EMAIL_NOT_AVAILABLE`. Any other failure — offline, 500, a timeout —
 * left the flag stuck, so the save button silently stopped working for the rest
 * of the session with nothing on screen to explain it. Every failure now
 * reaches the person and the form stays usable.
 */

export interface ErstantwortEmailOverlayProps {
	onClose: () => void;
	/** Called after the address was accepted, so the caller can reload userData. */
	onSaved: () => void;
}

export const ErstantwortEmailOverlay: React.FC<
	ErstantwortEmailOverlayProps
> = ({ onClose, onSaved }) => {
	const { t } = useTranslation();
	const [email, setEmail] = useState('');
	const [labelState, setLabelState] = useState<InputFieldLabelState>(null);
	const [errorText, setErrorText] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isSaved, setIsSaved] = useState(false);

	const isValid = email.length > 0 && isStringValidEmail(email);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value;
		setEmail(value);
		setErrorText(null);
		if (!value.length) {
			setLabelState(null);
			return;
		}
		setLabelState(isStringValidEmail(value) ? 'valid' : 'invalid');
	};

	const inputItem: InputFieldItem = {
		content: email,
		icon: <EnvelopeIcon />,
		id: 'erstantwortEmail',
		label:
			errorText ?? t('furtherSteps.email.overlay.input.label', 'E-mail'),
		name: 'email',
		type: 'text',
		labelState: errorText ? 'invalid' : labelState
	};

	const save = () => {
		if (isSaving || !isValid) return;
		setIsSaving(true);
		setErrorText(null);
		apiPutEmail(email)
			.then(() => {
				setIsSaving(false);
				setIsSaved(true);
				onSaved();
			})
			.catch((error: Response) => {
				setIsSaving(false);
				const reason = error?.headers?.get(FETCH_ERRORS.X_REASON);
				setLabelState('invalid');
				setErrorText(
					reason === X_REASON.EMAIL_NOT_AVAILABLE
						? t(
								'furtherSteps.email.overlay.input.unavailable',
								'This e-mail address is already registered.'
							)
						: t(
								'erstantwort.emailNotification.saveFailed',
								'Saving failed. Please try again.'
							)
				);
			});
	};

	const successItem: OverlayItem = {
		buttonSet: [
			{
				label: t('furtherSteps.email.overlay.button2.label', 'Close'),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.PRIMARY
			}
		],
		headline: t(
			'furtherSteps.email.success.overlay.headline',
			'Your e-mail address has been saved.'
		),
		svg: SuccessIllustration
	};

	const formItem: OverlayItem = {
		buttonSet: [
			{
				disabled: !isValid || isSaving,
				label: t('furtherSteps.email.overlay.button1.label', 'Save'),
				type: BUTTON_TYPES.PRIMARY
			},
			{
				label: t('furtherSteps.email.overlay.button2.label', 'Close'),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.SECONDARY
			}
		],
		headline: t(
			'furtherSteps.email.overlay.headline',
			'Add an e-mail address'
		),
		/* The failure text belongs on the field label, next to the input that
		   caused it — not duplicated into the overlay copy above it.
		   The live region is separate and visually hidden: after pressing Save
		   focus stays on the button, so a label change alone announces nothing
		   and the person can reasonably assume the save worked. */
		nestedComponent: (
			<>
				<InputField item={inputItem} inputHandle={handleChange} />
				<p role="alert" aria-live="polite" className="sr-only">
					{errorText ?? ''}
				</p>
			</>
		),
		svg: EnvelopeIllustration
	};

	return (
		<Overlay
			item={isSaved ? successItem : formItem}
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
