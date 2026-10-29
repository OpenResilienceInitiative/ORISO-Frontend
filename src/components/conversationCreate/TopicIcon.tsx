import * as React from 'react';
import { ReactComponent as CategorySearchIcon } from '../../resources/img/icons/category-search.svg';
import { ReactComponent as CategorySearchFilledIcon } from '../../resources/img/icons/category-search-filled.svg';

/** Topic glyph of the create cards: outlined until a topic is chosen, then filled. */
export const TopicIcon = ({ filled }: { filled: boolean }) =>
	filled ? <CategorySearchFilledIcon /> : <CategorySearchIcon />;
