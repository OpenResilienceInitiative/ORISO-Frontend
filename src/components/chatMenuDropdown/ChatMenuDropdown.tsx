import * as React from 'react';
import clsx from 'clsx';
import './chatMenuDropdown.styles';

export const ChatMenuDropdown = React.forwardRef<
	HTMLDivElement,
	{
		id?: string;
		children: React.ReactNode;
		className?: string;
		style?: React.CSSProperties;
		ariaLabel?: string;
		onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
		role?: string;
	}
>(
	(
		{
			id,
			children,
			className,
			style,
			ariaLabel,
			onKeyDown,
			role = 'dialog'
		},
		ref
	) => (
		<div
			id={id}
			ref={ref}
			className={clsx('chatMenuDropdown', className)}
			style={style}
			role={role}
			aria-label={ariaLabel}
			onKeyDown={onKeyDown}
		>
			{children}
		</div>
	)
);

ChatMenuDropdown.displayName = 'ChatMenuDropdown';

export const ChatMenuDropdownHeader = ({
	subtitle,
	title
}: {
	subtitle: string;
	title: string;
}) => (
	<div className="chatMenuDropdown__header">
		<p className="chatMenuDropdown__subtitle">{subtitle}</p>
		<h2 className="chatMenuDropdown__title">{title}</h2>
	</div>
);

export const ChatMenuDropdownDivider = ({
	className
}: {
	className?: string;
}) => <div className={clsx('chatMenuDropdown__divider', className)} />;

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
