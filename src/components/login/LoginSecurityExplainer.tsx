import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ReactComponent as LockIcon } from '../../resources/img/icons/lock.svg';
import { ReactComponent as PersonIcon } from '../../resources/img/icons/person.svg';
import { ReactComponent as AgencyIcon } from '../../resources/img/icons/agency.svg';
import { ReactComponent as HackerIcon } from '../../resources/img/icons/hacker.svg';
import { ReactComponent as ArrowLeftIcon } from '../../resources/img/icons/arrow-left.svg';
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
 * The argument is the key, not the lock: it is created on the user's device
 * and stays there, so the servers only ever carry noise.
 */
export const LoginSecurityExplainer = ({
	onBack
}: LoginSecurityExplainerProps) => {
	const { t: translate } = useTranslation();
	const cipher = useCipherNoise(5);

	return (
		<div className="loginSecurity" data-cy="login-security-explainer">
			<div className="loginSecurity__head">
				<span className="loginSecurity__badge">
					{translate('login.security.explainer.badge')}
				</span>
				<h2 className="loginSecurity__headline">
					{translate('login.security.explainer.headline')}
				</h2>
			</div>

			<div className="loginSecurity__transport">
				<div className="loginSecurity__party">
					<PersonIcon className="loginSecurity__partyIcon" />
					<p className="loginSecurity__bubble loginSecurity__bubble--you">
						{translate('login.security.explainer.message')}
					</p>
					<span className="loginSecurity__partyLabel">
						{translate('login.security.explainer.you')}
					</span>
				</div>

				<div className="loginSecurity__wire" aria-hidden="true">
					<span className="loginSecurity__wireLine" />
					<span className="loginSecurity__wireChip">
						<LockIcon className="loginSecurity__wireLock" />
						<span className="loginSecurity__wireLabel">
							{translate('login.security.explainer.encrypted')}
						</span>
					</span>
				</div>

				<div className="loginSecurity__party">
					<AgencyIcon className="loginSecurity__partyIcon" />
					<p className="loginSecurity__bubble loginSecurity__bubble--agency">
						{translate('login.security.explainer.message')}
					</p>
					<span className="loginSecurity__partyLabel">
						{translate('login.security.explainer.agency')}
					</span>
				</div>
			</div>

			<ArrowLeftIcon
				className="loginSecurity__tapArrow"
				aria-hidden="true"
			/>

			<div className="loginSecurity__attack">
				<HackerIcon className="loginSecurity__attackIcon" />
				<div>
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
				<ArrowLeftIcon className="loginSecurity__backIcon" />
				{translate('login.security.explainer.back')}
			</button>
		</div>
	);
};
