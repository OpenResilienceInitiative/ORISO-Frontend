import * as React from 'react';
import type { ElementType } from 'react';

export interface ProfileCardProps {
	children: React.ReactNode;
	icon?: ElementType;
	boxed?: boolean;
	fullWidth?: boolean;
}

/** Shared profile card shell; children retain their identity across renders. */
export const ProfileCard = ({
	children,
	icon: Icon,
	boxed,
	fullWidth
}: ProfileCardProps) => {
	const widthClass = fullWidth ? ' profile__card--fullWidth' : '';
	if (boxed === false && !Icon) {
		return (
			<div className={`profile__item profile__card--bare${widthClass}`}>
				{children}
			</div>
		);
	}
	return (
		<section
			className={`profile__item profile__card${widthClass}`}
			data-testid="profile-card"
		>
			{Icon && (
				<Icon className="profile__card__icon" aria-hidden="true" />
			)}
			<div className="profile__card__body">{children}</div>
		</section>
	);
};
