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
	'data-cy': dataCy
}: FilterChipProps) => (
	<button
		type="button"
		aria-pressed={active}
		title={label}
		aria-label={label}
		disabled={disabled}
		onClick={onClick}
		data-cy={dataCy}
		className={clsx('sessionsListToolbar__chip', {
			'sessionsListToolbar__chip--active': active,
			'sessionsListToolbar__chip--iconOnly': !active
		})}
	>
		<Icon
			className={clsx(
				'sessionsListToolbar__chipIconSvg',
				assetIcon && 'sessionsListToolbar__chipIconSvg--asset'
			)}
		/>
		<span className="sessionsListToolbar__chipLabel" aria-hidden={!active}>
			{label}
		</span>
		{count !== undefined && count > 0 && (
			<span className="sessionsListToolbar__chipBadge">
				{count > 99 ? '99+' : count}
			</span>
		)}
	</button>
);
