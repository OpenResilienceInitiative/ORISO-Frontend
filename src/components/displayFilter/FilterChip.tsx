import * as React from 'react';
import clsx from 'clsx';

export interface FilterChipProps {
	/** Already translated; used as visible label (when active), tooltip and accessible name. */
	'label': string;
	'icon': React.ComponentType<React.SVGProps<SVGSVGElement>>;
	'active'?: boolean;
	/** Unread/new items behind this chip; rendered as a badge when > 0. */
	'count'?: number;
	'disabled'?: boolean;
	'onClick'?: () => void;
	/** Mark the icon as a repo SVG asset (paths get `fill: currentcolor`). */
	'assetIcon'?: boolean;
	/**
	 * `icons` (default): icon pill, expands with its label when active.
	 * `labels`: icon + label on every pill. `text`: compact text pill
	 * without icon (Figma 9947:31377).
	 */
	'view'?: 'icons' | 'labels' | 'text';
	/**
	 * The Träger switched this format off while rows still exist (Frank
	 * 2026-09-16): the chip stays, looks locked (`aria-disabled`) and a click
	 * goes to `onDeactivatedClick` instead of toggling the filter.
	 */
	'deactivated'?: boolean;
	/** Accessible-name suffix for a deactivated chip, already translated. */
	'deactivatedLabel'?: string;
	'onDeactivatedClick'?: () => void;
	'data-cy'?: string;
}

/**
 * One filter pill of the list toolbars (#1377 slice 1). Extracted from the
 * inline chip JSX in `SessionsListToolbar` and `NotificationsCenter`: the
 * Figma contract is an icon-only pill at rest that expands with its label
 * when active (`aria-pressed`). Styling stays in the shared
 * `sessionsListToolbar__chip*` rules of `sessionsList.styles.scss`, so this
 * component and the two toolbars render pixel-identical pills.
 */
export const FilterChip = ({
	label,
	'icon': Icon,
	active = false,
	count,
	disabled = false,
	onClick,
	assetIcon = false,
	view = 'icons',
	deactivated = false,
	deactivatedLabel,
	onDeactivatedClick,
	'data-cy': dataCy
}: FilterChipProps) => {
	const hasCount = count !== undefined && count > 0;
	const badge = hasCount ? (count > 99 ? '99+' : String(count)) : null;
	// The badge carries what the chip stands for right now; fold it into the
	// accessible name so a screen reader hears "Nachrichten (5)" rather than
	// a bare "Nachrichten". A deactivated chip says so in its name too.
	const named = badge ? `${label} (${badge})` : label;
	const accessibleName =
		deactivated && deactivatedLabel ? deactivatedLabel : named;
	const isText = view === 'text';
	const isLabelled = view === 'labels';
	const labelVisible = active || isText || isLabelled;
	return (
		<button
			type="button"
			aria-pressed={active}
			aria-disabled={deactivated || undefined}
			title={accessibleName}
			aria-label={accessibleName}
			disabled={disabled}
			onClick={deactivated ? onDeactivatedClick : onClick}
			data-cy={dataCy}
			className={clsx('sessionsListToolbar__chip', {
				'sessionsListToolbar__chip--active': active,
				'sessionsListToolbar__chip--iconOnly':
					!active && !isText && !isLabelled,
				'sessionsListToolbar__chip--text': isText,
				'sessionsListToolbar__chip--labelled': isLabelled,
				'sessionsListToolbar__chip--deactivated': deactivated
			})}
		>
			{!isText && (
				<Icon
					className={clsx(
						'sessionsListToolbar__chipIconSvg',
						assetIcon && 'sessionsListToolbar__chipIconSvg--asset'
					)}
				/>
			)}
			<span
				className="sessionsListToolbar__chipLabel"
				aria-hidden={!labelVisible}
			>
				{label}
			</span>
			{badge && (
				<span
					className="sessionsListToolbar__chipBadge"
					aria-hidden="true"
				>
					{badge}
				</span>
			)}
		</button>
	);
};
