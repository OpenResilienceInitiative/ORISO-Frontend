import * as React from 'react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LocaleSwitchPill } from '../localeSwitch/LocaleSwitchPill';

export interface StageMobileHeroProps {
	/** Optional trailing action, e.g. the "to login" icon button. */
	action?: ReactNode;
	/**
	 * `hero` (default) is the 230px head of the login screens (design 2e):
	 * brand row, headline, claim. `bar` is the same brand row alone on the
	 * same red surface (design 8a) — the registration steps carry their own
	 * headline per step, so the big head would only push the form down.
	 */
	variant?: 'hero' | 'bar';
}

/**
 * Mobile head of the stage screens (design 2e / 8a).
 *
 * Below `$fromXLarge` the desktop stage is not rendered at all, so mobile used
 * to get a bare app bar and no brand surface whatsoever. This is the mobile
 * dramaturgy instead of a shrunken desktop: a calm red head with the claim,
 * and the content below it as a white sheet that overlaps it by 28px. The
 * `bar` variant keeps only the brand row — one molecule for both screens
 * instead of two competing headers.
 *
 * Deliberately CSS only — no canvas, no image, no effect script. Whatever the
 * desktop stage does must never reach a phone's data plan.
 */
export const StageMobileHero = ({
	action,
	variant = 'hero'
}: StageMobileHeroProps) => {
	const { t: translate } = useTranslation();
	const isBar = variant === 'bar';

	return (
		<div
			className={
				isBar
					? 'stageMobileHero stageMobileHero--bar'
					: 'stageMobileHero'
			}
			data-cy="stage-mobile-hero"
			data-cy-variant={variant}
		>
			{!isBar && (
				<>
					<span
						className="stageMobileHero__ring stageMobileHero__ring--large"
						aria-hidden="true"
					/>
					<span
						className="stageMobileHero__ring stageMobileHero__ring--small"
						aria-hidden="true"
					/>
				</>
			)}

			<div className="stageMobileHero__bar">
				<span className="stageMobileHero__brand">
					{translate('app.stage.title')}
				</span>
				<span className="stageMobileHero__actions">
					<LocaleSwitchPill variant="circle" />
					{action}
				</span>
			</div>

			{!isBar && (
				<div className="stageMobileHero__copy">
					<h1 className="stageMobileHero__headline">
						{translate('app.stage.mobileHeadline')}
					</h1>
					<p className="stageMobileHero__claim">
						{translate('app.claim')}
					</p>
				</div>
			)}
		</div>
	);
};
