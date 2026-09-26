import * as React from 'react';
import { SingleComponentType } from '../../utils/tabsHelper';

interface ProfileCardListProps {
	/** Already filtered by condition; sorted here by `order`. */
	elements: SingleComponentType[];
}

/**
 * The `cards` layout of a profile tab (#878, #1540): every section sits in
 * its own card under a centred icon, and the cards flow in columns so a short
 * section never leaves a gap under a tall one.
 */
export const ProfileCardList = ({ elements }: ProfileCardListProps) => (
	<div className="profile__cards">
		{[...elements]
			.sort((a, b) => (a?.order || 99) - (b?.order || 99))
			.map((element, i) => {
				const Icon = element.icon;
				// Sections that bring their own cards (boxed: false) stay unwrapped.
				if (element.boxed === false && !Icon) {
					return (
						<div
							key={i}
							className="profile__item profile__card--bare"
						>
							<element.component />
						</div>
					);
				}
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
