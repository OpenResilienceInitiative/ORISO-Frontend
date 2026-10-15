import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { OrisoTextField } from '../form/OrisoTextField';
import { isStringValidEmail } from '../registration/registrationHelpers';
import { apiPutEmail, FETCH_ERRORS, X_REASON } from '../../api';
import { ReactComponent as EnvelopeIcon } from '../../resources/img/icons/envelope.svg';

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
	const active = useRef(true);
	useEffect(() => {
		active.current = true;
		return () => {
			active.current = false;
		};
	}, []);
	const [email, setEmail] = useState('');
	const [isInvalid, setIsInvalid] = useState(false);
	const [errorText, setErrorText] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const isValid = email.length > 0 && isStringValidEmail(email);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value;
		setEmail(value);
		setErrorText(null);
		setIsInvalid(value.length > 0 && !isStringValidEmail(value));
	};

	const save = () => {
		if (isSaving || !isValid) return;
		setIsSaving(true);
		setErrorText(null);
		apiPutEmail(email)
			.then(() => {
				if (!active.current) return;
				setIsSaving(false);
				onSaved();
			})
			.catch((error: unknown) => {
				if (!active.current) return;
				setIsSaving(false);
				setIsInvalid(true);

				if (error instanceof Error) {
					if (error.message === FETCH_ERRORS.FORBIDDEN) {
						setErrorText(
							t('erstantwort.emailNotification.notAllowed')
						);
						return;
					}
					if (
						error.message === FETCH_ERRORS.ABORTED ||
						error.message === FETCH_ERRORS.GATEWAY_TIMEOUT ||
						error.message === FETCH_ERRORS.TIMEOUT ||
						error instanceof TypeError
					) {
						setErrorText(
							t(
								'profile.notifications.noEmail.modal.errorMessage'
							)
						);
						return;
					}
					setErrorText(t('erstantwort.emailNotification.saveFailed'));
					return;
				}

				const reason = (error as Response)?.headers?.get(
					FETCH_ERRORS.X_REASON
				);
				setErrorText(
					reason === X_REASON.EMAIL_NOT_AVAILABLE
						? t('furtherSteps.email.overlay.input.unavailable')
						: t('erstantwort.emailNotification.saveFailed')
				);
			});
	};

	const close = () => {
		active.current = false;
		onClose();
	};

	/* The failure text belongs on the field, next to the input that caused it.
	   The live region is separate and visually hidden: after pressing Save
	   focus stays on the button, so a helper-text change alone announces
	   nothing and the person can reasonably assume the save worked. */
	return (
		<M3Dialog
			open
			onClose={close}
			icon={<EnvelopeIcon />}
			closeLabel={t('app.close')}
			title={t('furtherSteps.email.overlay.headline')}
			actions={[
				{
					label: t('furtherSteps.email.overlay.button2.label'),
					onClick: close
				},
				{
					label: t('furtherSteps.email.overlay.button1.label'),
					onClick: save,
					disabled: !isValid || isSaving,
					primary: true
				}
			]}
		>
			<OrisoTextField
				id="erstantwortEmail"
				name="email"
				type="email"
				autoComplete="email"
				autoFocus
				fullWidth
				label={t('furtherSteps.email.overlay.input.label')}
				value={email}
				onChange={handleChange}
				error={Boolean(errorText) || isInvalid}
				helperText={
					errorText ??
					(isInvalid
						? t('furtherSteps.email.overlay.input.invalid')
						: '')
				}
			/>
			<p role="alert" aria-live="polite" className="sr-only">
				{errorText ?? ''}
			</p>
		</M3Dialog>
	);
};
