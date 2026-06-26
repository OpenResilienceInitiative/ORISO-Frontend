import { Box, Typography, useMediaQuery } from '@mui/material';
import * as React from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { passwordCriteria } from './passwordRules';
import { registrationMd3 } from '../registrationDesign/registrationDesign';
import pwLengthIcon from '../../../resources/img/registration-md3/icons/pw-length.svg';
import pwNumberIcon from '../../../resources/img/registration-md3/icons/pw-number.svg';
import pwUpperIcon from '../../../resources/img/registration-md3/icons/pw-upper.svg';
import pwLowerIcon from '../../../resources/img/registration-md3/icons/pw-lower.svg';
import pwSpecialIcon from '../../../resources/img/registration-md3/icons/pw-special.svg';

const ruleIcons = [
	pwLengthIcon,
	pwNumberIcon,
	pwUpperIcon,
	pwLowerIcon,
	pwSpecialIcon
] as const;

const metBackground = '#e2eff9';
const metForeground = '#1f6ca6';
const spring = 'transform 440ms cubic-bezier(0.34, 1.3, 0.5, 1)';
const colorTransition =
	'background-color 240ms ease, color 240ms ease, border-color 240ms ease';

export const PasswordRuleChips = ({ password }: { password: string }) => {
	const { t } = useTranslation();
	const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
	const containerRef = useRef<HTMLDivElement>(null);
	const lastX = useRef<Map<string, number>>(new Map());
	const rafs = useRef<Set<number>>(new Set());
	const rules = passwordCriteria.map((rule, index) => ({
		...rule,
		icon: ruleIcons[index],
		met: rule.validation(password)
	}));
	const orderedRules = [...rules].sort(
		(a, b) => Number(b.met) - Number(a.met)
	);
	const signature = orderedRules
		.map((rule) => `${rule.info}:${rule.met ? 1 : 0}`)
		.join('|');

	useLayoutEffect(() => {
		const container = containerRef.current;

		if (!container) {
			return;
		}

		let movedToFront: HTMLElement | null = null;

		container
			.querySelectorAll<HTMLElement>('[data-password-rule-chip]')
			.forEach((chip) => {
				const key = chip.dataset.passwordRuleChip as string;
				const x = chip.offsetLeft;
				const previousX = lastX.current.get(key);

				lastX.current.set(key, x);

				if (previousX === undefined || previousX === x) {
					return;
				}

				if (
					previousX > x &&
					(!movedToFront || x < movedToFront.offsetLeft)
				) {
					movedToFront = chip;
				}

				if (reduceMotion) {
					return;
				}

				chip.style.transition = 'none';
				chip.style.transform = `translateX(${previousX - x}px)`;

				const id = requestAnimationFrame(() => {
					rafs.current.delete(id);
					chip.style.transition = `${spring}, ${colorTransition}`;
					chip.style.transform = 'translateX(0)';

					const clearInlineAnimation = (event: TransitionEvent) => {
						if (event.propertyName !== 'transform') {
							return;
						}

						chip.style.transition = '';
						chip.style.transform = '';
						chip.removeEventListener(
							'transitionend',
							clearInlineAnimation
						);
					};

					chip.addEventListener(
						'transitionend',
						clearInlineAnimation
					);
				});

				rafs.current.add(id);
			});

		if (movedToFront) {
			const chip = movedToFront as HTMLElement;
			const left = chip.offsetLeft;
			const right = left + chip.offsetWidth;

			if (
				left < container.scrollLeft ||
				right > container.scrollLeft + container.clientWidth
			) {
				container.scrollTo({
					left: Math.max(0, left - 8),
					behavior: reduceMotion ? 'auto' : 'smooth'
				});
			}
		}
	}, [signature, reduceMotion]);

	useEffect(() => {
		const currentRafs = rafs.current;

		return () => {
			currentRafs.forEach((id) => cancelAnimationFrame(id));
			currentRafs.clear();
		};
	}, []);

	return (
		<Box
			ref={containerRef}
			role="list"
			tabIndex={0}
			aria-label={t(
				'registration.account.password.criteriaLabel',
				'Passwort-Anforderungen'
			)}
			sx={{
				'position': 'relative',
				'display': 'flex',
				'gap': 1,
				'mt': 1.5,
				'pb': 1,
				'px': '14px',
				'overflowX': 'auto',
				'overflowY': 'hidden',
				'WebkitOverflowScrolling': 'touch',
				'overscrollBehaviorX': 'contain',
				'scrollbarWidth': 'thin',
				'&:focus-visible': {
					outline: `2px solid ${registrationMd3.focus}`,
					outlineOffset: 2,
					borderRadius: 999
				},
				'&::-webkit-scrollbar': {
					height: 6
				},
				'&::-webkit-scrollbar-thumb': {
					backgroundColor: registrationMd3.outlineVariant,
					borderRadius: 3
				}
			}}
		>
			{orderedRules.map((rule) => (
				<Box
					key={rule.info}
					data-password-rule-chip={rule.info}
					role="listitem"
					aria-label={`${t(rule.info)}: ${
						rule.met
							? t(
									'registration.password.criteria.fulfilled',
									'erfüllt'
								)
							: t('registration.password.criteria.open', 'offen')
					}`}
					sx={{
						flex: '0 0 auto',
						display: 'inline-flex',
						alignItems: 'center',
						gap: rule.met ? 0 : 0.75,
						...(rule.met
							? { px: '9px', py: '7px' }
							: { pl: 1.25, pr: 1.5, py: 0.75 }),
						borderRadius: 999,
						whiteSpace: 'nowrap',
						border: '1px solid',
						borderColor: rule.met
							? 'transparent'
							: registrationMd3.outlineVariant,
						backgroundColor: rule.met
							? metBackground
							: registrationMd3.surface,
						color: rule.met
							? metForeground
							: registrationMd3.onSurfaceVariant,
						transition: colorTransition
					}}
				>
					<Box
						aria-hidden
						sx={{
							width: 18,
							height: 18,
							flexShrink: 0,
							backgroundColor: rule.met
								? metForeground
								: registrationMd3.onSurfaceVariant,
							transition: 'background-color 240ms ease',
							maskImage: `url(${rule.icon})`,
							WebkitMaskImage: `url(${rule.icon})`,
							maskSize: 'contain',
							WebkitMaskSize: 'contain',
							maskRepeat: 'no-repeat',
							WebkitMaskRepeat: 'no-repeat',
							maskPosition: 'center',
							WebkitMaskPosition: 'center'
						}}
					/>
					{!rule.met && (
						<Typography
							variant="body2"
							sx={{ fontWeight: 500, color: 'inherit' }}
						>
							{t(rule.info)}
						</Typography>
					)}
				</Box>
			))}
		</Box>
	);
};
