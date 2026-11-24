import * as React from 'react';
import { ReactComponent as Count1 } from '../../resources/img/icons/stack-count-1.svg';
import { ReactComponent as Count1Filled } from '../../resources/img/icons/stack-count-1-filled.svg';
import { ReactComponent as Count2 } from '../../resources/img/icons/stack-count-2.svg';
import { ReactComponent as Count2Filled } from '../../resources/img/icons/stack-count-2-filled.svg';
import { ReactComponent as Count3 } from '../../resources/img/icons/stack-count-3.svg';
import { ReactComponent as Count3Filled } from '../../resources/img/icons/stack-count-3-filled.svg';
import { ReactComponent as Count4 } from '../../resources/img/icons/stack-count-4.svg';
import { ReactComponent as Count4Filled } from '../../resources/img/icons/stack-count-4-filled.svg';
import { ReactComponent as Count5 } from '../../resources/img/icons/stack-count-5.svg';
import { ReactComponent as Count5Filled } from '../../resources/img/icons/stack-count-5-filled.svg';
import { ReactComponent as Count6 } from '../../resources/img/icons/stack-count-6.svg';
import { ReactComponent as Count6Filled } from '../../resources/img/icons/stack-count-6-filled.svg';
import { ReactComponent as Count7 } from '../../resources/img/icons/stack-count-7.svg';
import { ReactComponent as Count7Filled } from '../../resources/img/icons/stack-count-7-filled.svg';
import { ReactComponent as Count8 } from '../../resources/img/icons/stack-count-8.svg';
import { ReactComponent as Count8Filled } from '../../resources/img/icons/stack-count-8-filled.svg';
import { ReactComponent as Count9 } from '../../resources/img/icons/stack-count-9.svg';
import { ReactComponent as Count9Filled } from '../../resources/img/icons/stack-count-9-filled.svg';
import { ReactComponent as Count9plus } from '../../resources/img/icons/stack-count-9-plus.svg';
import { ReactComponent as Count9plusFilled } from '../../resources/img/icons/stack-count-9-plus-filled.svg';

type Svg = React.FC<React.SVGProps<SVGSVGElement>>;

const OUTLINE: Svg[] = [
	Count1,
	Count2,
	Count3,
	Count4,
	Count5,
	Count6,
	Count7,
	Count8,
	Count9,
	Count9plus
];
const FILLED: Svg[] = [
	Count1Filled,
	Count2Filled,
	Count3Filled,
	Count4Filled,
	Count5Filled,
	Count6Filled,
	Count7Filled,
	Count8Filled,
	Count9Filled,
	Count9plusFilled
];

/**
 * FE#2494 *8 (Frank, 24 Nov): the stack button shows which answer this
 * becomes — stacked cards with 1 … 9, then 9+ (Material Symbols
 * `filter_1` … `filter_9_plus`, weight 400). Unlike "reply all" it cannot
 * be mistaken for the e-mail action. Outline at rest, filled on hover and
 * focus (CSS swaps the two).
 */
export const StackCountIcon = ({
	next,
	className
}: {
	/** The number the next stacked answer gets (1 = the first). */
	next: number;
	className?: string;
}) => {
	const index = Math.min(Math.max(next, 1), 10) - 1;
	const Outline = OUTLINE[index];
	const Filled = FILLED[index];
	return (
		<span
			className={['stackCountIcon', className].filter(Boolean).join(' ')}
			aria-hidden
			data-cy="selection-reply-stack-count"
			data-next={index === 9 ? '9+' : String(index + 1)}
		>
			<Outline className="stackCountIcon__outline" />
			<Filled className="stackCountIcon__filled" />
		</span>
	);
};
