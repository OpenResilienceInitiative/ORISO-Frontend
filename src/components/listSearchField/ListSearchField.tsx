import * as React from 'react';
import { useRef } from 'react';
import {
	IconClose,
	IconMenuDots,
	IconSearch
} from '../sessionsList/SessionsListToolbar';
import '../sessionsList/sessionsList.styles';

export interface ListSearchFieldProps {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	/** Accessible label for the clear button. */
	clearLabel: string;
	/**
	 * Accessible label for the leading kebab button. Defaults to the placeholder
	 * for backwards compatibility, but callers should pass a distinct label so
	 * the button and the input don't announce the same thing to screen readers.
	 */
	menuLabel?: string;
	/**
	 * Optional handler for the leading kebab button. When omitted the button
	 * simply focuses the input (same affordance as the conversation list).
	 */
	onMenuClick?: () => void;
	className?: string;
}

/**
 * Shared list search field (molecule) — the pill-shaped search input used on
 * top of master lists (Activity Timeline, conversation list). Extracted from
 * `NotificationsCenter`/`SessionsListToolbar` so both surfaces render the
 * exact same primitive (AGENTS.md: shared primitive, no one-off CSS — it
 * reuses the `sessionsListToolbar__search*` token-driven styles).
 *
 * Purely controlled: filtering/search semantics live with the caller.
 */
export const ListSearchField = ({
	value,
	onChange,
	placeholder,
	clearLabel,
	menuLabel,
	onMenuClick,
	className
}: ListSearchFieldProps) => {
	const inputRef = useRef<HTMLInputElement | null>(null);

	return (
		<div className={`sessionsListToolbar__search ${className || ''}`}>
			<div className="sessionsListToolbar__searchInner">
				<button
					type="button"
					className="sessionsListToolbar__iconButton"
					aria-label={menuLabel || placeholder}
					onClick={onMenuClick || (() => inputRef.current?.focus())}
				>
					<IconMenuDots />
				</button>
				<div className="sessionsListToolbar__searchFieldWrap">
					<input
						type="search"
						className="sessionsListToolbar__searchInput"
						placeholder={placeholder}
						value={value}
						onChange={(event) => onChange(event.target.value)}
						aria-label={placeholder}
						autoComplete="off"
						ref={inputRef}
					/>
				</div>
				{value ? (
					<button
						type="button"
						className="sessionsListToolbar__searchActionButton"
						onClick={() => onChange('')}
						aria-label={clearLabel}
					>
						<IconClose />
					</button>
				) : (
					<div
						className="sessionsListToolbar__searchIconWrap"
						aria-hidden
					>
						<IconSearch />
					</div>
				)}
			</div>
		</div>
	);
};
