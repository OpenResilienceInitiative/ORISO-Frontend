import * as React from 'react';
import { SingleComponentType } from '../../utils/tabsHelper';
import { ProfileCard } from './ProfileCard';

interface ProfileCardListProps {
	/** Already filtered by condition; sorted here by `order`. */
	elements: SingleComponentType[];
}

/** Profile sections share the canonical card shell and desktop column flow. */
export const ProfileCardList = ({ elements }: ProfileCardListProps) => (
	<div className="profile__cards">
		{[...elements]
			.sort((a, b) => (a?.order || 99) - (b?.order || 99))
			.map((element, i) => (
				<ProfileCard
					key={i}
					icon={element.icon}
					boxed={element.boxed}
					fullWidth={element.fullWidth}
				>
					<element.component />
				</ProfileCard>
			))}
	</div>
);
