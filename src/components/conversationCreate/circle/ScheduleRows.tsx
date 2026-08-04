import * as React from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { ReactComponent as CalendarIcon } from '../../../resources/img/icons/calendar.svg';
import { ReactComponent as ClockIcon } from '../../../resources/img/icons/clock.svg';
import { ReactComponent as RepeatIcon } from '../../../resources/img/icons/reload.svg';
import { ReactComponent as MediumIcon } from '../../../resources/img/icons/diversity-2.svg';
import { ReactComponent as LanguageIcon } from '../../../resources/img/icons/language_outline.svg';
import { OrisoCalendar } from '../../form/OrisoCalendar';
import { OrisoTimePicker } from '../../form/OrisoTimePicker';
import {
	durationSelectOptionsSet,
	GroupChatInterval,
	GroupChatModality
} from '../../groupChat/createChatHelpers';
import { GroupChatSeriesFieldsValue } from '../../groupChat/GroupChatSeriesFields';
import { SplitButton } from '../../splitButton/SplitButton';
import { RowMenu, RowMenuOption } from '../RowMenu';

/**
 * Schedule rows of the Gesprächskreis settings screen (Figma 8482-30552,
 * "Interval konfigurieren"). Every field is a split-button row: the action
 * segment opens the field's picker or option list, chosen values switch the
 * row to the tonal state, and the row that currently owns an open menu is
 * elevated. Time, duration and repetitions additionally carry the down/up
 * stepper pair from the design.
 *
 * The value shape is `GroupChatSeriesFieldsValue`, unchanged, so
 * `buildGroupChatSeriesRequest` and its tests remain the submit seam.
 */

const INTERVALS: GroupChatInterval[] = [
	'DAILY',
	'WEEKLY',
	'BIWEEKLY',
	'MONTHLY',
	'QUARTERLY',
	'YEARLY'
];

const MODALITIES: GroupChatModality[] = ['TEXT', 'AUDIO', 'VIDEO'];

const TIME_STEP_MINUTES = 15;
const MIN_REPEAT = 1;
const MAX_REPEAT = 365;

type OpenRow = 'date' | 'duration' | 'repeat' | 'medium' | 'language' | null;

interface ScheduleRowsProps {
	value: GroupChatSeriesFieldsValue;
	onChange: (value: GroupChatSeriesFieldsValue) => void;
	/** Primary language of the circle — the last row in the design. */
	language: string;
	onLanguageChange: (language: string) => void;
	languageOptions: RowMenuOption[];
}

export const ScheduleRows = ({
	value,
	onChange,
	language,
	onLanguageChange,
	languageOptions
}: ScheduleRowsProps) => {
	const { t: translate } = useTranslation();
	const [openRow, setOpenRow] = useState<OpenRow>(null);
	const dateRef = useRef<HTMLDivElement | null>(null);
	const durationRef = useRef<HTMLDivElement | null>(null);
	const repeatRef = useRef<HTMLDivElement | null>(null);
	const mediumRef = useRef<HTMLDivElement | null>(null);
	const languageRef = useRef<HTMLDivElement | null>(null);

	const update = <Key extends keyof GroupChatSeriesFieldsValue>(
		key: Key,
		next: GroupChatSeriesFieldsValue[Key]
	) => onChange({ ...value, [key]: next });

	const toggle = (row: Exclude<OpenRow, null>) =>
		setOpenRow((current) => (current === row ? null : row));

	const variantFor = (row: Exclude<OpenRow, null>, chosen: boolean) => {
		if (openRow === row) {
			return 'elevated' as const;
		}
		return chosen ? ('tonal' as const) : ('outlined' as const);
	};

	const durationOptions: RowMenuOption[] = durationSelectOptionsSet.map(
		(option) => ({
			value: option.value,
			label: translate(option.label)
		})
	);

	const shiftTime = (minutes: number) => {
		const [hours, mins] = value.startTime.split(':').map(Number);
		const base = dayjs()
			.hour(Number.isFinite(hours) ? hours : 12)
			.minute(Number.isFinite(mins) ? mins : 0)
			.add(minutes, 'minute');
		update('startTime', base.format('HH:mm'));
	};

	const shiftDuration = (step: number) => {
		const values = durationSelectOptionsSet.map((option) =>
			Number(option.value)
		);
		const index = values.indexOf(value.duration);
		const nextIndex = Math.min(
			values.length - 1,
			Math.max(0, (index === -1 ? 0 : index) + step)
		);
		update('duration', values[nextIndex]);
	};

	const shiftRepeat = (step: number) =>
		update(
			'repeatCount',
			Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, value.repeatCount + step))
		);

	const durationLabel = translate('groupChat.circle.rows.durationLabel');
	const repeatLabel = translate('groupChat.circle.rows.repeatLabel');
	const timeLabel = translate('groupChat.circle.rows.timeLabel');

	return (
		<div className="scheduleRows">
			<SplitButton
				ref={dateRef}
				fullWidth
				icon={<CalendarIcon />}
				label={
					value.startDate
						? dayjs(value.startDate).format('D. MMMM YYYY')
						: translate('groupChat.circle.rows.dateLabel')
				}
				variant={variantFor('date', Boolean(value.startDate))}
				open={openRow === 'date'}
				onClick={() => toggle('date')}
				onToggleMenu={() => toggle('date')}
				menuLabel={translate('groupChat.circle.rows.openList', {
					field: translate('groupChat.circle.rows.dateLabel')
				})}
			/>
			{openRow === 'date' && (
				<RowMenu
					options={[]}
					value={value.startDate}
					onSelect={() => undefined}
					anchorRef={dateRef}
					onClose={() => setOpenRow(null)}
					preferredHeight={420}
				>
					<OrisoCalendar
						disableContainer
						value={value.startDate ? dayjs(value.startDate) : null}
						minDate={dayjs().startOf('day')}
						onChange={(next) => {
							update('startDate', next.format('YYYY-MM-DD'));
							setOpenRow(null);
						}}
					/>
				</RowMenu>
			)}

			<OrisoTimePicker
				label={timeLabel}
				ampm={false}
				value={dayjs(`2000-01-01T${value.startTime || '12:00'}`)}
				onChange={(next) =>
					next && update('startTime', next.format('HH:mm'))
				}
				renderTrigger={(openDialog) => (
					<SplitButton
						fullWidth
						icon={<ClockIcon />}
						label={value.startTime || timeLabel}
						variant={value.startTime ? 'tonal' : 'outlined'}
						onClick={openDialog}
						mainOpensMenu={false}
						onDecrement={() => shiftTime(-TIME_STEP_MINUTES)}
						onIncrement={() => shiftTime(TIME_STEP_MINUTES)}
						decrementLabel={translate(
							'groupChat.circle.rows.decrease',
							{ field: timeLabel }
						)}
						incrementLabel={translate(
							'groupChat.circle.rows.increase',
							{ field: timeLabel }
						)}
					/>
				)}
			/>

			<SplitButton
				ref={durationRef}
				fullWidth
				icon={<ClockIcon />}
				label={
					value.duration
						? translate('groupChat.circle.rows.durationValue', {
								count: value.duration / 60
							})
						: durationLabel
				}
				variant={variantFor('duration', Boolean(value.duration))}
				open={openRow === 'duration'}
				onClick={() => toggle('duration')}
				onDecrement={() => shiftDuration(-1)}
				onIncrement={() => shiftDuration(1)}
				decrementLabel={translate('groupChat.circle.rows.decrease', {
					field: durationLabel
				})}
				incrementLabel={translate('groupChat.circle.rows.increase', {
					field: durationLabel
				})}
			/>
			{openRow === 'duration' && (
				<RowMenu
					options={durationOptions}
					value={String(value.duration)}
					onSelect={(next) => {
						update('duration', Number(next));
						setOpenRow(null);
					}}
					anchorRef={durationRef}
					onClose={() => setOpenRow(null)}
				/>
			)}

			<SplitButton
				ref={repeatRef}
				fullWidth
				icon={<RepeatIcon />}
				label={translate('groupChat.circle.rows.repeatValue', {
					count: value.repeatCount
				})}
				variant={variantFor('repeat', value.repeatCount > 1)}
				open={openRow === 'repeat'}
				onClick={() => toggle('repeat')}
				onDecrement={() => shiftRepeat(-1)}
				onIncrement={() => shiftRepeat(1)}
				decrementLabel={translate('groupChat.circle.rows.decrease', {
					field: repeatLabel
				})}
				incrementLabel={translate('groupChat.circle.rows.increase', {
					field: repeatLabel
				})}
			/>
			{openRow === 'repeat' && (
				<RowMenu
					options={INTERVALS.map((interval) => ({
						value: interval,
						label: translate(
							`groupChat.create.intervalSelect.${interval.toLowerCase()}`,
							interval
						)
					}))}
					value={value.interval}
					onSelect={(next) => {
						update('interval', next as GroupChatInterval);
						setOpenRow(null);
					}}
					anchorRef={repeatRef}
					onClose={() => setOpenRow(null)}
				/>
			)}

			<SplitButton
				ref={mediumRef}
				fullWidth
				icon={<MediumIcon />}
				label={translate(
					`groupChat.create.modalitySelect.${value.modality.toLowerCase()}`,
					translate('groupChat.circle.rows.mediumLabel')
				)}
				variant={variantFor('medium', Boolean(value.modality))}
				open={openRow === 'medium'}
				onClick={() => toggle('medium')}
				onToggleMenu={() => toggle('medium')}
				menuLabel={translate('groupChat.circle.rows.openList', {
					field: translate('groupChat.circle.rows.mediumLabel')
				})}
			/>
			{openRow === 'medium' && (
				<RowMenu
					options={MODALITIES.map((modality) => ({
						value: modality,
						label: translate(
							`groupChat.create.modalitySelect.${modality.toLowerCase()}`,
							modality
						)
					}))}
					value={value.modality}
					onSelect={(next) => {
						update('modality', next as GroupChatModality);
						setOpenRow(null);
					}}
					anchorRef={mediumRef}
					onClose={() => setOpenRow(null)}
				/>
			)}

			<SplitButton
				ref={languageRef}
				fullWidth
				icon={<LanguageIcon />}
				label={
					languageOptions.find((option) => option.value === language)
						?.label ??
					translate('groupChat.circle.rows.languageLabel')
				}
				variant={variantFor('language', Boolean(language))}
				open={openRow === 'language'}
				onClick={() => toggle('language')}
				onToggleMenu={() => toggle('language')}
				menuLabel={translate('groupChat.circle.rows.openList', {
					field: translate('groupChat.circle.rows.languageLabel')
				})}
			/>
			{openRow === 'language' && (
				<RowMenu
					options={languageOptions}
					value={language}
					onSelect={(next) => {
						onLanguageChange(next);
						setOpenRow(null);
					}}
					anchorRef={languageRef}
					onClose={() => setOpenRow(null)}
				/>
			)}
		</div>
	);
};
