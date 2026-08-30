import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { ReactComponent as AgencyIcon } from '../../resources/img/icons/agency.svg';
import { ReactComponent as HackerIcon } from '../../resources/img/icons/hacker.svg';
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

/** A thin curved arrow, drawn once and mirrored for the right side by CSS. */
const TapArrow = ({ className }: { className: string }) => (
	<svg
		className={className}
		viewBox="0 0 44 72"
		fill="none"
		aria-hidden="true"
		focusable="false"
	>
		<path
			d="M44 68C22 68 10 56 10 10"
			stroke="currentColor"
			strokeWidth="1.25"
			strokeLinecap="round"
		/>
		<path
			d="M4 16L10 8L16 16"
			stroke="currentColor"
			strokeWidth="1.25"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

export interface LoginSecurityExplainerProps {
	onBack: () => void;
}

/**
 * "Why is this extra safe?" — the card that slides in when the encryption
 * teaser below the login form is clicked (design 2d desktop / 2e mobile).
 *
 * Layout and copy follow Frank's Figma frame `div.loginForm` (App.Oriso,
 * node 9579:55787): headline; the two parties, each filling its half of the
 * row, bubble inward and mark in the outer corner; the "encrypted" chip on a
 * dashed wire between them; the intercepted-noise box with the two thin
 * arrows that point back up at where the traffic was tapped; footnote; the
 * way back. Person, lock and back-arrow are Material Symbols (outlined) via
 * `@mui/icons-material`; the agency mark and the hacker are the project's
 * own icons.
 *
 * The argument is the key, not the lock: it is created on the user's device
 * and stays there, so what the wire gives away stays noise.
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
					<div className="loginSecurity__partyBlock">
						<p className="loginSecurity__bubble loginSecurity__bubble--you">
							{translate('login.security.explainer.message')}
						</p>
						<PersonOutlinedIcon
							className="loginSecurity__partyIcon"
							aria-hidden="true"
							focusable="false"
						/>
					</div>
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
					<div className="loginSecurity__partyBlock">
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
			</div>

			<div className="loginSecurity__attack">
				{/* thin arrows from the tapped noise back up to the wire it came off */}
				<TapArrow className="loginSecurity__tapArrow loginSecurity__tapArrow--left" />
				<TapArrow className="loginSecurity__tapArrow loginSecurity__tapArrow--right" />
				<HackerIcon
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
