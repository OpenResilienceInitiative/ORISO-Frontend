import * as React from 'react';
import { ReactComponent as ChevronDownIcon } from '../../resources/img/icons/keyboard_arrow_down.svg';
import { ReactComponent as ChevronUpIcon } from '../../resources/img/icons/keyboard_arrow_up.svg';
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
			className
		},
		ref
	) => {
		const isStepper = Boolean(onDecrement && onIncrement);
		const hasMenu = Boolean(onToggleMenu);
		const classes = [
			'splitButton',
			`splitButton--${variant}`,
			fullWidth && 'splitButton--fullWidth',
			disabled && 'splitButton--disabled',
			open && !disabled && 'splitButton--open',
			className
		]
			.filter(Boolean)
			.join(' ');

		return (
			<div className={classes} ref={ref} id={id}>
				<button
					type="button"
					className="splitButton__segment splitButton__main"
					disabled={disabled || mainDisabled}
					onClick={onClick}
					aria-expanded={hasMenu && mainOpensMenu ? open : undefined}
					aria-haspopup={
						hasMenu && mainOpensMenu ? 'listbox' : undefined
					}
				>
					{icon && (
						<span className="splitButton__icon" aria-hidden>
							{icon}
						</span>
					)}
					<span className="splitButton__label">{label}</span>
				</button>
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
						className="splitButton__segment splitButton__trailing"
						disabled={disabled}
						onClick={onToggleMenu}
						aria-label={menuLabel}
						aria-expanded={open}
						aria-haspopup="listbox"
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
