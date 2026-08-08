import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './SaveCredentialsCard.styles.scss';

/**
 * "Zugangsdaten sichern" — the post-dispatch Baustein that gives an advice
 * seeker a real chance to keep their access (ADR-018, ORISO-Frontend#825).
 *
 * <h3>Why this matters more than it looks</h3>
 *
 * Someone who used the dice at registration holds a generated 16-character
 * password they never memorised, and it is **never shown again** — registration
 * deliberately skips any confirmation screen and redirects straight into the
 * chat. If they also leave no e-mail address the account is unrecoverable: the
 * login page offers no reset affordance, the reset path silently drops accounts
 * on the synthetic dummy address, and Magic Link cannot even be enabled without
 * a real one. For a Träger that switches the e-mail invitation off — U25 does —
 * **this card is the only remaining safety net.**
 *
 * <h3>Three constraints that are decisions, not details</h3>
 *
 * 1. **No file download, ever.** A `zugangsdaten.txt` in the download folder is
 *    a lasting trace on a device somebody else may use. The shared-device
 *    warning exists for the same reason.
 * 2. **The app cannot show the password.** It is hashed in Keycloak and gone
 *    from the browser after the redirect. Offering to reveal it would be a
 *    promise the app cannot keep, so the browser-independent fallback is the
 *    existing "set a password now" flow: the person chooses one they actually
 *    know and Keycloak overwrites the generated one.
 * 3. **The browser prompt is the mechanism, not the Credential Management
 *    API** — that API is Chromium-only, and Safari and Firefox prompt off a
 *    real form submission instead. This card therefore exposes a properly
 *    named and autocompleted `username` field so a password manager can
 *    associate it when the person sets a password in the profile.
 */

export interface SaveCredentialsCardProps {
	/** The immutable Anmeldename (`userName`), never the display name. */
	userName: string;
}

const SECURITY_SETTINGS_PATH = '/profile/einstellungen/sicherheit';

export const SaveCredentialsCard: React.FC<SaveCredentialsCardProps> = ({
	userName
}) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [copied, setCopied] = useState(false);

	if (!userName) return null;

	const copy = () => {
		navigator.clipboard?.writeText(userName);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 3000);
	};

	return (
		<div className="saveCredentialsCard">
			<label
				className="saveCredentialsCard__label"
				htmlFor="erstantwortUserName"
			>
				{t('erstantwort.saveCredentials.userNameLabel', 'Anmeldename')}
			</label>

			<div className="saveCredentialsCard__row">
				<input
					id="erstantwortUserName"
					className="saveCredentialsCard__input"
					/* `name` and `autocomplete` are what let a password manager
					   recognise this as the account's username. Without them the
					   browser has nothing to associate a later password with. */
					name="username"
					autoComplete="username"
					type="text"
					readOnly
					value={userName}
				/>
				<button
					type="button"
					className="saveCredentialsCard__copy"
					onClick={copy}
				>
					{t('erstantwort.saveCredentials.copy', 'Kopieren')}
				</button>
			</div>

			<p className="saveCredentialsCard__status" aria-live="polite">
				{copied
					? t(
							'erstantwort.saveCredentials.copied',
							'Anmeldename kopiert.'
						)
					: ''}
			</p>

			<p className="saveCredentialsCard__warning">
				{t(
					'erstantwort.saveCredentials.sharedDevice',
					'Wenn andere dieses Gerät mitbenutzen, speichern Sie den Anmeldenamen besser nicht hier, sondern notieren Sie ihn an einem sicheren Ort.'
				)}
			</p>

			<button
				type="button"
				className="saveCredentialsCard__setPassword"
				onClick={() => navigate(SECURITY_SETTINGS_PATH)}
			>
				{t(
					'erstantwort.saveCredentials.setPassword',
					'Passwort jetzt setzen'
				)}
			</button>
		</div>
	);
};
