import * as React from 'react';
import { useRef } from 'react';
import clsx from 'clsx';
import { ReactComponent as ProfileArrow } from '../../resources/img/icons/arrow-right-m3.svg';
import { ReactComponent as WizardArrow } from '../../resources/img/icons/side-scroller-arrow.svg';
import './sideScrollerFooter.styles';

export interface SideScrollerFooterAction {
	label: string;
	onClick?: () => void;
	disabled?: boolean;
	/** An inert, focusable action; the caller owns the availability rule. */
	ariaDisabled?: boolean;
	dataCy?: string;
	className?: string;
}

export interface SideScrollerFooterProps {
	back: SideScrollerFooterAction;
	next: SideScrollerFooterAction;
	/** The profile keeps its existing sizing; the wizard uses the Figma 32px arrow. */
	variant?: 'profile' | 'wizard';
	className?: string;
}

/** Shared Side Scroller Footer; availability and navigation belong to its caller. */
export const SideScrollerFooter = ({
	back,
	next,
	variant = 'profile',
	className
}: SideScrollerFooterProps) => {
	const Arrow = variant === 'wizard' ? WizardArrow : ProfileArrow;
	const backRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	const renderAction = (
		action: SideScrollerFooterAction,
		direction: 'back' | 'next'
	) => {
		const inert = action.disabled || action.ariaDisabled;
		return (
			<button
				type="button"
				className={clsx(
					'sideScrollerFooter__button',
					`sideScrollerFooter__button--${direction}`,
					direction === 'next' &&
						!inert &&
						'sideScrollerFooter__button--primary',
					action.className
				)}
				ref={direction === 'back' ? backRef : nextRef}
				onClick={
					inert
						? undefined
						: (event) => {
								const focusedControl = event.currentTarget;
								const wasFocused =
									document.activeElement === focusedControl;
								action.onClick?.();
								if (variant === 'wizard' && wasFocused) {
									queueMicrotask(() => {
										const fallback =
											direction === 'back'
												? nextRef.current
												: backRef.current;
										if (
											focusedControl.disabled &&
											fallback &&
											!fallback.disabled &&
											(document.activeElement ===
												document.body ||
												document.activeElement ===
													focusedControl)
										) {
											fallback.focus();
										}
									});
								}
							}
				}
				disabled={action.disabled}
				aria-disabled={action.ariaDisabled}
				aria-label={action.label}
				title={action.label}
				data-cy={action.dataCy}
			>
				<Arrow aria-hidden />
			</button>
		);
	};
	return (
		<div
			className={clsx(
				'sideScrollerFooter',
				`sideScrollerFooter--${variant}`,
				className
			)}
		>
			{renderAction(back, 'back')}
			{renderAction(next, 'next')}
		</div>
	);
};
