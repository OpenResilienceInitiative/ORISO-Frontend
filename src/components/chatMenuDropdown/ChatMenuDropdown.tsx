import * as React from 'react';
import clsx from 'clsx';
import './chatMenuDropdown.styles';

export const ChatMenuDropdown = React.forwardRef<
	HTMLDivElement,
	{
		'id'?: string;
		'density'?: 'default' | 'compact';
		'children': React.ReactNode;
		'className'?: string;
		'style'?: React.CSSProperties;
		'ariaLabel'?: string;
		'onKeyDown'?: React.KeyboardEventHandler<HTMLDivElement>;
		/** Focus leaving the card (a host that owns focus watches this). */
		'onBlur'?: React.FocusEventHandler<HTMLDivElement>;
		'role'?: string;
		'data-cy'?: string;
	}
>(
	(
		{
			id,
			density = 'default',
			children,
			className,
			style,
			ariaLabel,
			onKeyDown,
			onBlur,
			role = 'dialog',
			'data-cy': dataCy
		},
		ref
	) => (
		<div
			id={id}
			ref={ref}
			className={clsx(
				'chatMenuDropdown',
				density === 'compact' && 'chatMenuDropdown--compact',
				className
			)}
			style={style}
			role={role}
			aria-label={ariaLabel}
			onKeyDown={onKeyDown}
			onBlur={onBlur}
			data-cy={dataCy}
		>
			{children}
		</div>
	)
);

ChatMenuDropdown.displayName = 'ChatMenuDropdown';

export const ChatMenuDropdownHeader = ({
	subtitle,
	title,
	titleAs: Title = 'h2'
}: {
	subtitle: string;
	title: string;
	/**
	 * `p` inside `role="menu"`: a menu may only own items, separators and
	 * groups, so a heading there fails `aria-required-children`. The menu's
	 * `aria-label` names it instead.
	 */
	titleAs?: 'h2' | 'p';
}) => (
	<div className="chatMenuDropdown__header">
		<p className="chatMenuDropdown__subtitle">{subtitle}</p>
		<Title className="chatMenuDropdown__title">{title}</Title>
	</div>
);

export const ChatMenuDropdownDivider = ({
	className,
	as: Component = 'div',
	role
}: {
	className?: string;
	/** `li` inside a list-based menu (MUI `Menu`), `div` elsewhere. */
	as?: React.ElementType;
	role?: string;
}) => (
	<Component
		className={clsx('chatMenuDropdown__divider', className)}
		role={role}
	/>
);

/** A small grey label above a group of items, e.g. "Termin". */
export const ChatMenuDropdownGroupLabel = ({
	children
}: {
	children: React.ReactNode;
}) => (
	<p className="chatMenuDropdown__groupLabel" role="presentation">
		{children}
	</p>
);

/**
 * A short explanatory line inside a menu, e.g. what a colleague can see.
 * `tone="warning"` paints it in the primary colour for a hint that needs
 * attention ("Außerhalb Ihrer Arbeitszeit").
 */
export const ChatMenuDropdownNote = ({
	children,
	tone = 'neutral'
}: {
	children: React.ReactNode;
	tone?: 'neutral' | 'warning';
}) => (
	<p
		className={clsx(
			'chatMenuDropdown__note',
			tone === 'warning' && 'chatMenuDropdown__note--warning'
		)}
	>
		{children}
	</p>
);

const MENU_ITEM_SELECTOR =
	'[role="menuitem"]:not(:disabled):not([aria-disabled="true"]),' +
	'[role="menuitemradio"]:not(:disabled):not([aria-disabled="true"]),' +
	'[role="menuitemcheckbox"]:not(:disabled):not([aria-disabled="true"])';

/**
 * Keyboard for a `role="menu"` card: ArrowDown/ArrowUp wrap through the
 * items, Home/End jump. Hand it to `ChatMenuDropdown`'s `onKeyDown`.
 */
export const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
	if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
	const items = Array.from(
		event.currentTarget.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)
	);
	if (items.length === 0) return;
	event.preventDefault();
	const current = items.indexOf(
		event.currentTarget.ownerDocument.activeElement as HTMLElement
	);
	const none = current < 0;
	const next =
		event.key === 'Home'
			? 0
			: event.key === 'End'
				? items.length - 1
				: event.key === 'ArrowDown'
					? none
						? 0
						: (current + 1) % items.length
					: none
						? items.length - 1
						: (current - 1 + items.length) % items.length;
	items[next].focus();
};

export const ChatMenuDropdownSection = ({
	children
}: {
	children: React.ReactNode;
}) => <div className="chatMenuDropdown__section">{children}</div>;

export const ChatMenuDropdownItem = ({
	as,
	icon,
	title,
	description,
	shortcut,
	disabled = false,
	active = false,
	className,
	children,
	...rest
}: {
	as?: React.ElementType;
	icon?: React.ReactNode;
	title?: React.ReactNode;
	description?: React.ReactNode;
	shortcut?: React.ReactNode;
	disabled?: boolean;
	active?: boolean;
	className?: string;
	children?: React.ReactNode;
	[key: string]: any;
}) => {
	const Component = as || (rest.href ? 'a' : 'button');
	const componentProps = {
		...rest,
		className: clsx(
			'chatMenuDropdown__item',
			disabled && 'chatMenuDropdown__item--disabled',
			active && 'chatMenuDropdown__item--active',
			className
		),
		...(Component === 'button'
			? { type: rest.type || 'button', disabled }
			: { 'aria-disabled': disabled || undefined })
	};

	return (
		<Component {...componentProps}>
			{children || (
				<>
					{icon && (
						<span
							className={clsx(
								'chatMenuDropdown__itemIcon',
								disabled &&
									'chatMenuDropdown__itemIcon--disabled'
							)}
						>
							{icon}
						</span>
					)}
					<span className="chatMenuDropdown__itemCenter">
						<span className="chatMenuDropdown__itemTitleRow">
							<span
								className={clsx(
									'chatMenuDropdown__itemTitle',
									disabled &&
										'chatMenuDropdown__itemTitle--disabled'
								)}
							>
								{title}
							</span>
							{shortcut && (
								<kbd className="chatMenuDropdown__itemShortcut">
									{shortcut}
								</kbd>
							)}
						</span>
						{description && (
							<span
								className={clsx(
									'chatMenuDropdown__itemDescription',
									disabled &&
										'chatMenuDropdown__itemDescription--disabled'
								)}
							>
								{description}
							</span>
						)}
					</span>
				</>
			)}
		</Component>
	);
};

export const ChatMenuDropdownItemContent = ({
	icon,
	title,
	description,
	shortcut,
	disabled = false
}: {
	icon?: React.ReactNode;
	title: React.ReactNode;
	description?: React.ReactNode;
	shortcut?: React.ReactNode;
	disabled?: boolean;
}) => (
	<>
		{icon && (
			<span
				className={clsx(
					'chatMenuDropdown__itemIcon',
					disabled && 'chatMenuDropdown__itemIcon--disabled'
				)}
			>
				{icon}
			</span>
		)}
		<span className="chatMenuDropdown__itemCenter">
			<span className="chatMenuDropdown__itemTitleRow">
				<span
					className={clsx(
						'chatMenuDropdown__itemTitle',
						disabled && 'chatMenuDropdown__itemTitle--disabled'
					)}
				>
					{title}
				</span>
				{shortcut && (
					<kbd className="chatMenuDropdown__itemShortcut">
						{shortcut}
					</kbd>
				)}
			</span>
			{description && (
				<span
					className={clsx(
						'chatMenuDropdown__itemDescription',
						disabled &&
							'chatMenuDropdown__itemDescription--disabled'
					)}
				>
					{description}
				</span>
			)}
		</span>
	</>
);
