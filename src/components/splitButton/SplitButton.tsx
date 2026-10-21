import * as React from 'react';
import { ReactComponent as ChevronDownIcon } from '../../resources/img/icons/keyboard_arrow_down.svg';
import { ReactComponent as ChevronUpIcon } from '../../resources/img/icons/keyboard_arrow_up.svg';
import { M3Checkbox } from '../M3Checkbox';
import './splitButton.styles.scss';

/**
 * Material-3 split button — the frontend port of the Admin panel atom
 * (`ORISO-Admin/src/components/GlobalSearch/SplitButton.tsx`, Figma 1165:16407
 * and 8460:23252). Same 56px geometry, same 28/4 pill silhouette, same
 * variants and disabled semantics; the antd `Dropdown` is replaced by the
 * caller-owned anchored menu this app uses, so the atom stays presentational.
 *
 * Two trailing shapes, both from the create-conversation design:
 * - **menu** — one chevron segment that opens the attached listbox.
 * - **stepper** — a down/up pair that decrements and increments the value
 *   (`19:00`, `4h`, `34 mal` on the "Interval konfigurieren" rows).
 */

export type SplitButtonVariant = 'outlined' | 'tonal' | 'primary' | 'elevated';

/** Main segment as a shared M3 checkbox (case selection, FE#1725). */
export interface SplitButtonSelection {
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** Visible label, also the checkbox's accessible name. */
	label: string;
	/** id of an element that says which item this checkbox selects. */
	describedBy?: string;
	dataCy?: string;
}

export interface SplitButtonProps {
	/** Main segment content — the action label or the chosen value. */
	label: React.ReactNode;
	/** Leading icon, 24px, inherits the segment colour. */
	icon?: React.ReactNode;
	/**
	 * `outlined` resting, `tonal` for a chosen value, `primary` once the action
	 * is ready to fire, `elevated` while this row owns an open menu.
	 */
	variant?: SplitButtonVariant;
	disabled?: boolean;
	/** Greys out only the action segment; the trailing segments stay live. */
	mainDisabled?: boolean;
	/** Stretch to the container width (the settings rows and the card footer). */
	fullWidth?: boolean;
	onClick?: () => void;
	/** Renders the chevron segment. Omit for a plain button. */
	onToggleMenu?: () => void;
	/** Whether the attached menu is open — flips the chevron, drives aria. */
	open?: boolean;
	menuLabel?: string;
	/**
	 * Whether the main segment opens the same menu. When it triggers something
	 * else it must not advertise a popup it does not control (WCAG 4.1.2).
	 */
	mainOpensMenu?: boolean;
	/** Stepper mode: providing both renders the down/up pair. */
	onDecrement?: () => void;
	onIncrement?: () => void;
	decrementLabel?: string;
	incrementLabel?: string;
	id?: string;
	className?: string;
	/**
	 * `small` = 32px control for dense rows (#1377 sound picker);
	 * `compact` = 40px, the M3 small split button (case-handover card).
	 */
	size?: 'medium' | 'small' | 'compact';
	/** Accessible name of the main segment when the visible label is not enough. */
	mainLabel?: string;
	/** Renders the main segment as a checkbox instead of a button. */
	selection?: SplitButtonSelection;
	/** Popup type the chevron advertises; `menu` for role="menu" popups. */
	menuPopup?: 'listbox' | 'menu';
	/** id of the open popup (`aria-controls` on the chevron). */
	menuId?: string;
	/** Ref to the chevron, e.g. to anchor a portalled menu. */
	trailingRef?: React.Ref<HTMLButtonElement>;
	mainDataCy?: string;
	trailingDataCy?: string;
	/** Id of text that describes the main segment (read after its name). */
	describedBy?: string;
}

export const SplitButton = React.forwardRef<HTMLDivElement, SplitButtonProps>(
	(
		{
			label,
			icon,
			variant = 'outlined',
			disabled = false,
			mainDisabled = false,
			fullWidth = false,
			onClick,
			onToggleMenu,
			open = false,
			menuLabel,
			mainOpensMenu = true,
			onDecrement,
			onIncrement,
			decrementLabel,
			incrementLabel,
			id,
			className,
			size = 'medium',
			mainLabel,
			selection,
			menuPopup = 'listbox',
			menuId,
			trailingRef,
			mainDataCy,
			trailingDataCy,
			describedBy
		},
		ref
	) => {
		const isStepper = Boolean(onDecrement && onIncrement);
		const hasMenu = Boolean(onToggleMenu);
		const classes = [
			'splitButton',
			`splitButton--${variant}`,
			size === 'small' && 'splitButton--small',
			size === 'compact' && 'splitButton--compact',
			fullWidth && 'splitButton--fullWidth',
			disabled && 'splitButton--disabled',
			open && !disabled && 'splitButton--open',
			className
		]
			.filter(Boolean)
			.join(' ');

		return (
			<div className={classes} ref={ref} id={id}>
				{selection ? (
					<div className="splitButton__segment splitButton__main splitButton__main--selection">
						<M3Checkbox
							checked={selection.checked}
							onChange={selection.onChange}
							label={selection.label}
							describedBy={selection.describedBy}
							disabled={disabled || mainDisabled}
							dataCy={selection.dataCy}
							tone={
								variant === 'primary' ? 'onPrimary' : 'inherit'
							}
							fill
						/>
					</div>
				) : (
					<button
						type="button"
						className="splitButton__segment splitButton__main"
						disabled={disabled || mainDisabled}
						onClick={onClick}
						aria-label={mainLabel}
						aria-describedby={describedBy}
						aria-expanded={
							hasMenu && mainOpensMenu ? open : undefined
						}
						aria-haspopup={
							hasMenu && mainOpensMenu ? menuPopup : undefined
						}
						data-cy={mainDataCy}
					>
						{icon && (
							<span className="splitButton__icon" aria-hidden>
								{icon}
							</span>
						)}
						<span className="splitButton__label">{label}</span>
					</button>
				)}
				{isStepper && (
					<>
						<button
							type="button"
							className="splitButton__segment splitButton__step splitButton__step--down"
							disabled={disabled}
							onClick={onDecrement}
							aria-label={decrementLabel}
						>
							<ChevronDownIcon
								className="splitButton__chevron"
								aria-hidden
							/>
						</button>
						<button
							type="button"
							className="splitButton__segment splitButton__step splitButton__step--up"
							disabled={disabled}
							onClick={onIncrement}
							aria-label={incrementLabel}
						>
							<ChevronUpIcon
								className="splitButton__chevron"
								aria-hidden
							/>
						</button>
					</>
				)}
				{!isStepper && hasMenu && (
					<button
						type="button"
						ref={trailingRef}
						className="splitButton__segment splitButton__trailing"
						disabled={disabled}
						onClick={onToggleMenu}
						aria-label={menuLabel}
						aria-expanded={open}
						aria-haspopup={menuPopup}
						aria-controls={open ? menuId : undefined}
						data-cy={trailingDataCy}
					>
						<ChevronDownIcon
							className="splitButton__chevron"
							aria-hidden
						/>
					</button>
				)}
			</div>
		);
	}
);

SplitButton.displayName = 'SplitButton';
