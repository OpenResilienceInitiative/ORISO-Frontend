import * as React from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Interval400Icon,
	IntervalFilledIcon
} from '../../icons/conversationCreateIcons';
import { GroupChatInterval } from '../../groupChat/createChatHelpers';
import {
	getGroupChatIntervalLabel,
	getGroupChatRepeatCountLabel
} from '../../groupChat/groupChatRepeatLabel';
import { SplitButton } from '../../splitButton/SplitButton';
import { RowMenu } from '../RowMenu';
import './repeatCountField.styles.scss';

/**
 * The repetition row of the Gesprächskreis settings (#1499): a `SplitButton`
 * stepper specialised for "how often". The count is the value, the interval
 * its unit below it ("10 Termine" / "Wöchentlich"); a single date reads
 * "einmalig". The base stepper stays generic for its other rows.
 *
 * - "einmalig" is the first menu entry; picking it sets the count to one.
 * - A real interval picked at one date starts the smallest series (two).
 * - ▲ from one to two opens the menu without "einmalig", so the interval is
 *   chosen right away. Closing it without a pick keeps `interval` — the last
 *   one chosen, or the form default (Wöchentlich).
 */

export const INTERVALS: GroupChatInterval[] = [
	'DAILY',
	'WEEKLY',
	'BIWEEKLY',
	'MONTHLY',
	'QUARTERLY',
	'YEARLY'
];

const ONCE = 'ONCE';
// Seven 48px entries plus the menu padding: "einmalig" must not push
// "Jährlich" below the fold of the default 320px menu.
const FULL_MENU_HEIGHT = 7 * 48 + 16;
const MIN_REPEAT = 1;
const MAX_REPEAT = 365;

export interface RepeatCountValue {
	repeatCount: number;
	interval: GroupChatInterval;
}

interface RepeatCountFieldProps extends RepeatCountValue {
	onChange: (value: RepeatCountValue) => void;
	/** False while the author has not settled the row: outline placeholder. */
	chosen?: boolean;
	/** Any interaction settles the row. */
	onTouched?: () => void;
	/** Controlled, so the settings screen keeps one menu open at a time. */
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const RepeatCountField = ({
	repeatCount,
	interval,
	onChange,
	chosen = true,
	onTouched,
	open,
	onOpenChange
}: RepeatCountFieldProps) => {
	const { t: translate } = useTranslation();
	const anchorRef = useRef<HTMLDivElement | null>(null);
	// The menu the ▲ press opened asks for an interval only.
	const [seriesOnly, setSeriesOnly] = useState(false);
	const fieldLabel = translate('groupChat.circle.rows.repeatLabel');
	const isSeries = repeatCount > 1;

	const setCount = (next: number) =>
		onChange({
			repeatCount: Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, next)),
			interval
		});

	const openMenu = (onlySeries: boolean) => {
		setSeriesOnly(onlySeries);
		onOpenChange(true);
	};

	const options = [
		...(seriesOnly
			? []
			: [
					{
						value: ONCE,
						label: getGroupChatRepeatCountLabel(1, translate)
					}
				]),
		...INTERVALS.map((option) => ({
			value: option,
			label: getGroupChatIntervalLabel(option, translate)
		}))
	];

	const label = chosen ? (
		<span className="repeatCountField__value">
			<span className="repeatCountField__count">
				{getGroupChatRepeatCountLabel(repeatCount, translate)}
			</span>
			{isSeries && (
				<>
					{/* Keeps the accessible name "10 Termine Wöchentlich". */}{' '}
					<span className="repeatCountField__interval">
						{getGroupChatIntervalLabel(interval, translate)}
					</span>
				</>
			)}
		</span>
	) : (
		fieldLabel
	);

	return (
		<>
			<SplitButton
				ref={anchorRef}
				className="repeatCountField"
				fullWidth
				icon={chosen ? <IntervalFilledIcon /> : <Interval400Icon />}
				label={label}
				variant={open ? 'elevated' : chosen ? 'tonal' : 'outlined'}
				open={open}
				onClick={() => {
					onTouched?.();
					if (open) {
						onOpenChange(false);
					} else {
						openMenu(false);
					}
				}}
				onDecrement={() => {
					onTouched?.();
					setCount(repeatCount - 1);
				}}
				onIncrement={() => {
					onTouched?.();
					setCount(repeatCount + 1);
					if (!isSeries) {
						openMenu(true);
					}
				}}
				decrementLabel={translate('groupChat.circle.rows.decrease', {
					field: fieldLabel
				})}
				incrementLabel={translate('groupChat.circle.rows.increase', {
					field: fieldLabel
				})}
			/>
			{open && (
				<RowMenu
					options={options}
					value={isSeries || seriesOnly ? interval : ONCE}
					onSelect={(next) => {
						if (next === ONCE) {
							onChange({ repeatCount: 1, interval });
						} else {
							onChange({
								repeatCount: Math.max(2, repeatCount),
								interval: next as GroupChatInterval
							});
						}
						onOpenChange(false);
					}}
					anchorRef={anchorRef}
					onClose={() => onOpenChange(false)}
					preferredHeight={seriesOnly ? undefined : FULL_MENU_HEIGHT}
				/>
			)}
		</>
	);
};
