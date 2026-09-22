import * as React from 'react';
import { SingleComponentType } from '../../utils/tabsHelper';

interface ProfileCardListProps {
	/** Already filtered by condition; sorted here by `order`. */
	elements: SingleComponentType[];
}

/**
 * The `cards` layout of a profile tab (#878): every section sits in its own
 * card with a leading icon, and the cards flow in columns so a short section
 * never leaves a gap under a tall one.
 */
export const ProfileCardList = ({ elements }: ProfileCardListProps) => (
	<div className="profile__cards">
		{[...elements]
			.sort((a, b) => (a?.order || 99) - (b?.order || 99))
			.map((element, i) => {
				const Icon = element.icon;
				return (
					<section
						key={i}
						className="profile__item profile__card"
						data-testid="profile-card"
					>
						{Icon && (
							<Icon
								className="profile__card__icon"
								aria-hidden="true"
							/>
						)}
						<div className="profile__card__body">
							<element.component />
						</div>
					</section>
				);
			})}
	</div>
);
