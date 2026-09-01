import * as React from 'react';
import { ReactNode, useId } from 'react';
import clsx from 'clsx';
import { Dialog } from '@mui/material';
import { CrossMarkIcon } from '../../resources/img/icons';
import './m3Dialog.styles.scss';

export type M3DialogSeverity = 'info' | 'error';

export interface M3DialogAction {
	/** Already-translated label. */
	label: string;
	onClick: () => void;
	/** Paints the label in the primary role. Exactly one action should set it. */
	primary?: boolean;
	disabled?: boolean;
	/** Overrides the generated `data-testid`. */
	testId?: string;
}

export interface M3DialogProps {
	'open'?: boolean;
	/** Centred headline. Already translated — this component never calls `t`. */
	'title': ReactNode;
	/**
	 * One sentence under the title saying what the dialog is FOR. Part of the
	 * house anatomy (icon → title → description), not decoration: a title names
	 * the thing, it does not say why the reader is here. Optional, because the
	 * short confirm dialogs' body IS that sentence.
	 */
	'description'?: ReactNode;
	/** 32px hero icon above the title. */
	'icon'?: ReactNode;
	'children'?: ReactNode;
	/** Up to two actions, rendered right-aligned as M3 text buttons. */
	'actions'?: M3DialogAction[];
	'onClose': () => void;
	/** Full-width divider between content and actions. Defaults to true. */
	'showDivider'?: boolean;
	/** Show the top-right close (✕) affordance. Defaults to true. */
	'closable'?: boolean;
	/**
	 * `'error'` paints hero icon and primary action in the M3 error role. The
	 * error role in this product is magenta, NOT the ORISO red — see
	 * `--m3-error` in the scheme; do not "fix" it towards `--form-error`.
	 */
	'severity'?: M3DialogSeverity;
	/** Dialog width in px. Defaults to the M3 basic-dialog 560px. */
	'width'?: number;
	'className'?: string;
	'data-testid'?: string;
}

/**
 * The product's standard M3 basic dialog — message box, error box and legal
 * sheet in one component.
 *
 * This is the Admin panel's `components/Modal` anatomy ported to the frontend
 * (Design-System M3_ORISO, node 60942-12062): a 28px surface-container-high
 * sheet, a 32px hero icon, a centred 24/32 headline, optional body-medium
 * supporting text, a full-width divider and right-aligned M3 text buttons —
 * neutral for the dismissing action, primary colour for the confirming one.
 * The Admin builds it on antd; the frontend has no antd, so the shell is MUI's
 * `Dialog` and the anatomy is carried by `m3Dialog.styles.scss`. Both sides
 * read the same `--m3-*` tokens, so the two dialogs stay one design.
 *
 * The body scrolls inside the sheet. That is the reason this exists as its own
 * component rather than as a variant of `OrisoDialog`: a published legal text
 * is far longer than a confirm sentence, and title, hero icon and actions have
 * to stay put while it is read. The scroll region carries `tabIndex={0}`
 * because WCAG 2.1.1 requires a keyboard-only user to be able to scroll it —
 * without the tab stop the rest of a legal text is unreachable without a mouse.
 */
export const M3Dialog = ({
	open = true,
	title,
	description,
	icon,
	children,
	actions = [],
	onClose,
	showDivider = true,
	closable = true,
	severity = 'info',
	width = 560,
	className,
	'data-testid': testId
}: M3DialogProps) => {
	const titleId = useId();
	const descriptionId = useId();

	return (
		<Dialog
			open={open}
			onClose={onClose}
			aria-labelledby={titleId}
			aria-describedby={description ? descriptionId : undefined}
			maxWidth={false}
			className={clsx(
				'm3Dialog',
				severity === 'error' && 'm3Dialog--error',
				className
			)}
			/* `PaperProps` / `BackdropProps`, not `slotProps`: this is MUI v5,
			   where `slotProps.paper` is not yet wired on `Dialog`. */
			BackdropProps={{ className: 'm3Dialog__backdrop' }}
			PaperProps={{
				'className': 'm3Dialog__surface',
				'style': { maxWidth: `${width}px` },
				'data-testid': testId
			}}
		>
			{closable && (
				<button
					type="button"
					className="m3Dialog__close"
					onClick={onClose}
					data-testid="m3-dialog-close"
					aria-label="Close"
				>
					<CrossMarkIcon />
				</button>
			)}

			<div className="m3Dialog__titleBlock">
				{icon && (
					<span className="m3Dialog__heroIcon" aria-hidden="true">
						{icon}
					</span>
				)}
				<h2 className="m3Dialog__title" id={titleId}>
					{title}
				</h2>
				{description && (
					<p className="m3Dialog__description" id={descriptionId}>
						{description}
					</p>
				)}
			</div>

			{children && (
				/* The lint rule cannot see that this region scrolls, so the
				   non-interactive tab stop is disabled here and nowhere else. */
				/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */
				<div className="m3Dialog__body" tabIndex={0}>
					{children}
				</div>
			)}

			{actions.length > 0 && (
				<div className="m3Dialog__footer">
					{showDivider && (
						<div className="m3Dialog__divider" aria-hidden="true" />
					)}
					<div className="m3Dialog__actions">
						{actions.map((action) => (
							<button
								key={action.label}
								type="button"
								className={clsx(
									'm3Dialog__action',
									action.primary &&
										'm3Dialog__action--primary'
								)}
								disabled={action.disabled}
								onClick={action.onClick}
								data-testid={action.testId}
							>
								{action.label}
							</button>
						))}
					</div>
				</div>
			)}
		</Dialog>
	);
};

export default M3Dialog;
