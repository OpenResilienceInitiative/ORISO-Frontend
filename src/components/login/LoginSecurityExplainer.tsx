import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import KeyOffOutlinedIcon from '@mui/icons-material/KeyOffOutlined';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { ReactComponent as AgencyIcon } from '../../resources/img/icons/agency.svg';
import './loginSecurity.styles';

const MATRIX_E2EE_URL =
	'https://matrix.org/docs/matrix-concepts/end-to-end-encryption/';

const HEX = '0123456789abcdef';
const SCRAMBLE_INTERVAL_MS = 90;

const randomCipher = (groups: number) =>
	Array.from({ length: groups }, () =>
		Array.from(
			{ length: 4 },
			() => HEX[Math.floor(Math.random() * HEX.length)]
		).join('')
	).join(' ');

/**
 * Hex noise that never resolves into anything.
 *
 * That is the whole point of the picture: what an attacker gets off the wire
 * stays noise. A scrambler that eventually settles on a readable string would
 * tell the opposite story.
 */
const useCipherNoise = (groups: number) => {
	const [cipher, setCipher] = useState(() => randomCipher(groups));
	const groupsRef = useRef(groups);
	groupsRef.current = groups;

	useEffect(() => {
		const prefersReducedMotion = window.matchMedia?.(
			'(prefers-reduced-motion: reduce)'
		)?.matches;
		if (prefersReducedMotion) {
			return;
		}

		const interval = window.setInterval(
			() => setCipher(randomCipher(groupsRef.current)),
			SCRAMBLE_INTERVAL_MS
		);
		return () => window.clearInterval(interval);
	}, []);

	return cipher;
};

export interface LoginSecurityExplainerProps {
	onBack: () => void;
}

/**
 * "Why is this extra safe?" — the card that slides in when the encryption
 * teaser below the login form is clicked (design 2d desktop / 2e mobile).
 *
 * Layout and copy follow the Figma frame `div.loginForm` (App.Oriso,
 * node 9579:55787): headline, the two parties with their bubbles and their
 * mark underneath, the "encrypted" chip on the wire between them, the
 * intercepted-noise box, the footnote, the way back. Icons are Material
 * Symbols (outlined) via `@mui/icons-material`; the agency mark is the
 * project's own M3-style `agency` icon.
 *
 * The argument is the key, not the lock: it is created on the user's device
 * and stays there, so whoever taps the wire is left without one — hence
 * `KeyOff` on the noise, and no skull.
 */
export const LoginSecurityExplainer = ({
	onBack
}: LoginSecurityExplainerProps) => {
	const { t: translate } = useTranslation();
	const cipher = useCipherNoise(5);

	return (
		<div className="loginSecurity" data-cy="login-security-explainer">
			<div className="loginSecurity__head">
				<h2 className="loginSecurity__headline">
					{translate('login.security.explainer.headline')}
				</h2>
			</div>

			{/*
			 * The diagram is one picture for assistive technology: two identical
			 * bubbles and a hidden wire say nothing on their own, so the group
			 * carries a localized description instead. Nothing inside is focusable.
			 */}
			<div
				className="loginSecurity__transport"
				role="img"
				aria-label={translate('login.security.explainer.diagram')}
			>
				<div className="loginSecurity__party loginSecurity__party--you">
					<p className="loginSecurity__bubble loginSecurity__bubble--you">
						{translate('login.security.explainer.message')}
					</p>
					<PersonOutlinedIcon
						className="loginSecurity__partyIcon"
						aria-hidden="true"
						focusable="false"
					/>
				</div>

				<div className="loginSecurity__wire" aria-hidden="true">
					<span className="loginSecurity__wireLine" />
					<span className="loginSecurity__wireChip">
						<LockOutlinedIcon
							className="loginSecurity__wireLock"
							focusable="false"
						/>
						<span className="loginSecurity__wireLabel">
							{translate('login.security.explainer.encrypted')}
						</span>
					</span>
				</div>

				<div className="loginSecurity__party loginSecurity__party--agency">
					<p className="loginSecurity__bubble loginSecurity__bubble--agency">
						{translate('login.security.explainer.message')}
					</p>
					<AgencyIcon
						className="loginSecurity__partyIcon"
						aria-hidden="true"
						focusable="false"
					/>
				</div>
			</div>

			<div className="loginSecurity__attack">
				<KeyOffOutlinedIcon
					className="loginSecurity__attackIcon"
					aria-hidden="true"
					focusable="false"
				/>
				<div className="loginSecurity__attackBody">
					<p
						className="loginSecurity__cipher"
						aria-label={translate(
							'login.security.explainer.cipherLabel'
						)}
					>
						{cipher}
					</p>
					<p className="loginSecurity__attackCaption">
						{translate('login.security.explainer.attack')}
					</p>
				</div>
			</div>

			<p className="loginSecurity__footnote">
				{translate('login.security.explainer.key')}
				<span className="loginSecurity__protocol">
					<Trans
						i18nKey="login.security.explainer.protocol"
						components={{ strong: <strong /> }}
					/>{' '}
					<a
						href={MATRIX_E2EE_URL}
						target="_blank"
						rel="noopener noreferrer"
					>
						{translate('login.security.explainer.protocolLink')}
					</a>
				</span>
			</p>

			<button
				type="button"
				className="loginSecurity__back"
				onClick={onBack}
				data-cy="login-security-back"
			>
				<ArrowBackIosNewIcon
					className="loginSecurity__backIcon"
					aria-hidden="true"
					focusable="false"
				/>
				{translate('login.security.explainer.back')}
			</button>
		</div>
	);
};
