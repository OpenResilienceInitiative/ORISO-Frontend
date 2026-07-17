import * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import './sessionsListItem.styles';

/**
 * Case-handover split button on a session card. Figma: "CARX — Teamberatung
 * Case Handover", Section 05 states board (node 4028-7250).
 *
 * Two modes:
 * - Default: primary segment triggers the access request ("Request access" /
 *   status pills for awaiting, granted, denied), chevron opens a menu with
 *   "Select multiple conversations".
 * - Batch: primary segment is a "Select case" checkbox toggle, chevron menu
 *   offers "Confirm selection" and "Deselect and close".
 */

export type CaseHandoverActionState =
	| 'requestAccess'
	| 'awaitingApproval'
	| 'accessGranted'
	| 'accessDenied';

export interface CaseHandoverActionLabels {
	requestAccess: string;
	awaitingApproval: string;
	accessGranted: string;
	accessDenied: string;
	selectCase: string;
	menuLabel: string;
	selectMultipleTitle: string;
	selectMultipleDescription: string;
	confirmSelectionTitle: string;
	confirmSelectionDescription: string;
	deselectTitle: string;
	deselectDescription: string;
}

interface CaseHandoverActionButtonProps {
	labels: CaseHandoverActionLabels;
	state: CaseHandoverActionState;
	/** Card is the active/selected conversation (red emphasis per design). */
	active?: boolean;
	batchMode?: boolean;
	/** Batch mode: this card is part of the current selection. */
	selected?: boolean;
	/** Batch mode: card cannot be selected (already granted/pending). */
	disabled?: boolean;
	onRequestAccess?: () => void;
	onToggleSelect?: () => void;
	onSelectMultiple?: () => void;
	onConfirmSelection?: () => void;
	onDeselectAndClose?: () => void;
}

const IconChevronDown = () => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M12 15.4L6 9.4L7.4 8L12 12.6L16.6 8L18 9.4L12 15.4Z"
			fill="currentColor"
		/>
	</svg>
);

const IconCheckSmall = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M9.55 18L3.85 12.3L5.275 10.875L9.55 15.15L18.725 5.975L20.15 7.4L9.55 18Z"
			fill="currentColor"
		/>
	</svg>
);

const IconClockSmall = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M15.3 16.7L16.7 15.3L13 11.6V7H11V12.4L15.3 16.7ZM12 22C10.6167 22 9.31667 21.7375 8.1 21.2125C6.88333 20.6875 5.825 19.975 4.925 19.075C4.025 18.175 3.3125 17.1167 2.7875 15.9C2.2625 14.6833 2 13.3833 2 12C2 10.6167 2.2625 9.31667 2.7875 8.1C3.3125 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.3125 8.1 2.7875C9.31667 2.2625 10.6167 2 12 2C13.3833 2 14.6833 2.2625 15.9 2.7875C17.1167 3.3125 18.175 4.025 19.075 4.925C19.975 5.825 20.6875 6.88333 21.2125 8.1C21.7375 9.31667 22 10.6167 22 12C22 13.3833 21.7375 14.6833 21.2125 15.9C20.6875 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6875 15.9 21.2125C14.6833 21.7375 13.3833 22 12 22ZM12 20C14.2167 20 16.1042 19.2208 17.6625 17.6625C19.2208 16.1042 20 14.2167 20 12C20 9.78333 19.2208 7.89583 17.6625 6.3375C16.1042 4.77917 14.2167 4 12 4C9.78333 4 7.89583 4.77917 6.3375 6.3375C4.77917 7.89583 4 9.78333 4 12C4 14.2167 4.77917 16.1042 6.3375 17.6625C7.89583 19.2208 9.78333 20 12 20Z"
			fill="currentColor"
		/>
	</svg>
);

const IconLockedSmall = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M6 22C5.45 22 4.97917 21.8042 4.5875 21.4125C4.19583 21.0208 4 20.55 4 20V10C4 9.45 4.19583 8.97917 4.5875 8.5875C4.97917 8.19583 5.45 8 6 8H7V6C7 4.61667 7.4875 3.4375 8.4625 2.4625C9.4375 1.4875 10.6167 1 12 1C13.3833 1 14.5625 1.4875 15.5375 2.4625C16.5125 3.4375 17 4.61667 17 6V8H18C18.55 8 19.0208 8.19583 19.4125 8.5875C19.8042 8.97917 20 9.45 20 10V20C20 20.55 19.8042 21.0208 19.4125 21.4125C19.0208 21.8042 18.55 22 18 22H6ZM6 20H18V10H6V20ZM12 17C12.55 17 13.0208 16.8042 13.4125 16.4125C13.8042 16.0208 14 15.55 14 15C14 14.45 13.8042 13.9792 13.4125 13.5875C13.0208 13.1958 12.55 13 12 13C11.45 13 10.9792 13.1958 10.5875 13.5875C10.1958 13.9792 10 14.45 10 15C10 15.55 10.1958 16.0208 10.5875 16.4125C10.9792 16.8042 11.45 17 12 17ZM9 8H15V6C15 5.16667 14.7083 4.45833 14.125 3.875C13.5417 3.29167 12.8333 3 12 3C11.1667 3 10.4583 3.29167 9.875 3.875C9.29167 4.45833 9 5.16667 9 6V8Z"
			fill="currentColor"
		/>
	</svg>
);

const CheckboxGlyph = ({ selected }: { selected: boolean }) => (
	<span
		className={clsx(
			'sessionsListItem__handoverActionCheckbox',
			selected && 'sessionsListItem__handoverActionCheckbox--selected'
		)}
		aria-hidden
	/>
);

const STATE_ICON: Record<CaseHandoverActionState, React.ComponentType | null> =
	{
		requestAccess: IconLockedSmall,
		awaitingApproval: IconClockSmall,
		accessGranted: IconCheckSmall,
		accessDenied: null
	};

export const CaseHandoverActionButton = ({
	labels,
	state,
	active = false,
	batchMode = false,
	selected = false,
	disabled = false,
	onRequestAccess,
	onToggleSelect,
	onSelectMultiple,
	onConfirmSelection,
	onDeselectAndClose
}: CaseHandoverActionButtonProps) => {
	const [menuOpen, setMenuOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const menuId = useId();

	useEffect(() => {
		if (!menuOpen) {
			return;
		}
		const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
			const target = event.target as Node | null;
			if (
				rootRef.current &&
				target &&
				!rootRef.current.contains(target)
			) {
				setMenuOpen(false);
			}
		};
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', handleOutsidePointer);
		document.addEventListener('touchstart', handleOutsidePointer);
		document.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('mousedown', handleOutsidePointer);
			document.removeEventListener('touchstart', handleOutsidePointer);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [menuOpen]);

	const isStatusPill = !batchMode && state !== 'requestAccess';
	const label = batchMode
		? labels.selectCase
		: state === 'requestAccess'
			? labels.requestAccess
			: state === 'awaitingApproval'
				? labels.awaitingApproval
				: state === 'accessGranted'
					? labels.accessGranted
					: labels.accessDenied;
	const StateIcon = batchMode ? null : STATE_ICON[state];

	const menuItems = batchMode
		? [
				{
					key: 'confirm',
					title: labels.confirmSelectionTitle,
					description: labels.confirmSelectionDescription,
					onSelect: onConfirmSelection
				},
				{
					key: 'deselect',
					title: labels.deselectTitle,
					description: labels.deselectDescription,
					onSelect: onDeselectAndClose
				}
			]
		: [
				{
					key: 'selectMultiple',
					title: labels.selectMultipleTitle,
					description: labels.selectMultipleDescription,
					onSelect: onSelectMultiple
				}
			];

	const handlePrimaryClick = (event: React.MouseEvent) => {
		event.stopPropagation();
		if (batchMode) {
			onToggleSelect?.();
			return;
		}
		if (state === 'requestAccess') {
			onRequestAccess?.();
		}
	};

	return (
		<div
			className={clsx(
				'sessionsListItem__handoverAction',
				active && 'sessionsListItem__handoverAction--active',
				batchMode &&
					selected &&
					'sessionsListItem__handoverAction--selected',
				isStatusPill && 'sessionsListItem__handoverAction--status',
				state === 'accessDenied' &&
					'sessionsListItem__handoverAction--denied',
				disabled && 'sessionsListItem__handoverAction--disabled'
			)}
			ref={rootRef}
			data-cy="case-handover-action"
		>
			<button
				type="button"
				className="sessionsListItem__handoverActionPrimary"
				onClick={handlePrimaryClick}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.stopPropagation();
					}
				}}
				disabled={disabled || (isStatusPill && !batchMode)}
				aria-pressed={batchMode ? selected : undefined}
				role={batchMode ? 'checkbox' : undefined}
				aria-checked={batchMode ? selected : undefined}
				data-cy="case-handover-action-primary"
			>
				{batchMode ? (
					<CheckboxGlyph selected={selected} />
				) : (
					StateIcon && <StateIcon />
				)}
				<span className="sessionsListItem__handoverActionLabel">
					{label}
				</span>
			</button>
			<button
				type="button"
				className="sessionsListItem__handoverActionToggle"
				onClick={(event) => {
					event.stopPropagation();
					setMenuOpen((prev) => !prev);
				}}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.stopPropagation();
					}
				}}
				disabled={disabled}
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				aria-controls={menuOpen ? menuId : undefined}
				aria-label={labels.menuLabel}
				data-cy="case-handover-action-menu-toggle"
			>
				<IconChevronDown />
			</button>
			{menuOpen && (
				<div
					className="sessionsListItem__handoverActionMenu"
					role="menu"
					id={menuId}
					aria-label={labels.menuLabel}
				>
					{menuItems.map((item) => (
						<button
							type="button"
							key={item.key}
							role="menuitem"
							className="sessionsListItem__handoverActionMenuItem"
							onClick={(event) => {
								event.stopPropagation();
								setMenuOpen(false);
								item.onSelect?.();
							}}
							data-cy={`case-handover-menu-${item.key}`}
						>
							<span className="sessionsListItem__handoverActionMenuItemTitle">
								{item.title}
							</span>
							<span className="sessionsListItem__handoverActionMenuItemDescription">
								{item.description}
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
};
