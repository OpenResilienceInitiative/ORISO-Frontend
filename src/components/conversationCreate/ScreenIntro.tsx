import * as React from 'react';
import { ReactComponent as CategorySearchIcon } from '../../resources/img/icons/category-search.svg';

/**
 * Screen heading of the create flow (Figma 8482-30551, annotation "Dieser
 * Bereich fehlt, das Icon sowie die Formatierung"): the `category_search`
 * glyph next to the screen title, with the explanatory paragraph below both.
 */

interface ScreenIntroProps {
	title: string;
	subtitle: string;
}

export const ScreenIntro = ({ title, subtitle }: ScreenIntroProps) => (
	<div className="conversationCreate__intro">
		<div className="conversationCreate__introHeading">
			<span className="conversationCreate__introGlyph" aria-hidden>
				<CategorySearchIcon />
			</span>
			<h3 className="conversationCreate__title">{title}</h3>
		</div>
		<p className="conversationCreate__subtitle">{subtitle}</p>
	</div>
);
