import * as React from 'react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { LocaleSwitchPill } from '../localeSwitch/LocaleSwitchPill';

export interface StageMobileHeroProps {
	/** Optional trailing action, e.g. the "to login" icon button. */
	action?: ReactNode;
	leadingAction?: ReactNode;
	/**
	 * `hero` (default) is the 230px head of the login screens (design 2e):
	 * language and other actions, the stage title, and the tenant claim. `bar` is the same brand row alone on the
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
	leadingAction,
	variant = 'hero'
}: StageMobileHeroProps) => {
	const { t: translate } = useTranslation();
	const isBar = variant === 'bar';
	const tenant = useTenant();
	const title = translate('app.stage.title');
	const claim = tenant?.content?.claim || translate('app.claim');

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
				{isBar && (
					<span className="stageMobileHero__brand">{title}</span>
				)}
				<span className="stageMobileHero__actions">
					{leadingAction}
					<LocaleSwitchPill variant="circle" />
					{action}
				</span>
			</div>

			{!isBar && (
				<div className="stageMobileHero__copy">
					<h1 className="stageMobileHero__headline">{title}</h1>
					<p className="stageMobileHero__claim">{claim}</p>
				</div>
			)}
		</div>
	);
};
