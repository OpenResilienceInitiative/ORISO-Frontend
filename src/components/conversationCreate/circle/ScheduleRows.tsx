import * as React from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
	Audio400Icon,
	AudioFilledIcon,
	Chat400Icon,
	ChatFilledIcon,
	Date400Icon,
	Duration400Icon,
	Interval400Icon,
	IntervalFilledIcon,
	Language400Icon,
	Medium400Icon,
	Repeat400Icon,
	StartTime400Icon,
	Video400Icon,
	VideoFilledIcon
} from '../../icons/conversationCreateIcons';
import { resolvePrimaryMediumIcon } from './primaryMediumIcon';
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

type RowKey = 'date' | 'time' | 'duration' | 'repeat' | 'medium' | 'language';

const ROW_KEYS: RowKey[] = [
	'date',
	'time',
	'duration',
	'repeat',
	'medium',
	'language'
];

interface ScheduleRowsProps {
	value: GroupChatSeriesFieldsValue;
	onChange: (value: GroupChatSeriesFieldsValue) => void;
	/** Primary language of the circle — the last row in the design. */
	language: string;
	onLanguageChange: (language: string) => void;
	languageOptions: RowMenuOption[];
	/**
	 * Edit mode hands over values the author chose earlier, so every row starts
	 * in its chosen state. A fresh create starts pristine: the rows carry
	 * defaults, but the design asks for the outline placeholder until the
	 * author has actually settled each one (Figma 8470-29945).
	 */
	valuesAreChosen?: boolean;
}

export const ScheduleRows = ({
	value,
	onChange,
	language,
	onLanguageChange,
	languageOptions,
	valuesAreChosen = false
}: ScheduleRowsProps) => {
	const { t: translate } = useTranslation();
	const [openRow, setOpenRow] = useState<OpenRow>(null);
	/**
	 * The repetition row carries two independent controls: the stepper sets a
	 * number of dates, the menu sets a fixed frequency. The control the author
	 * touched last owns the label, so choosing "Wöchentlich" no longer leaves
	 * a stale "34 mal" on the button.
	 */
	const [repeatMode, setRepeatMode] = useState<'count' | 'interval'>(
		'count'
	);
	const dateRef = useRef<HTMLDivElement | null>(null);
	const durationRef = useRef<HTMLDivElement | null>(null);
	const repeatRef = useRef<HTMLDivElement | null>(null);
	const mediumRef = useRef<HTMLDivElement | null>(null);
	const languageRef = useRef<HTMLDivElement | null>(null);

	/**
	 * Rows the author has settled. Defaults alone never count — otherwise date,
	 * start time and duration would always read as chosen and no row would ever
	 * show the outline resting state the design calls for.
	 */
	const [touched, setTouched] = useState<Set<RowKey>>(() =>
		valuesAreChosen ? new Set(ROW_KEYS) : new Set()
	);
	const markTouched = (row: RowKey) =>
		setTouched((current) =>
			current.has(row) ? current : new Set(current).add(row)
		);
	const isChosen = (row: RowKey) => touched.has(row);

	const update = <Key extends keyof GroupChatSeriesFieldsValue>(
		key: Key,
		next: GroupChatSeriesFieldsValue[Key]
	) => onChange({ ...value, [key]: next });

	const toggle = (row: Exclude<OpenRow, null>) =>
		setOpenRow((current) => (current === row ? null : row));

	const MEDIUM_ICONS = {
		'generic-outline': Medium400Icon,
		'chat-outline': Chat400Icon,
		'chat-filled': ChatFilledIcon,
		'audio-outline': Audio400Icon,
		'audio-filled': AudioFilledIcon,
		'video-outline': Video400Icon,
		'video-filled': VideoFilledIcon
	} as const;
	/**
	 * Resting rows carry the 400 outline glyph; a chosen medium switches to its
	 * filled partner, so the row states what the author picked at a glance.
	 */
	const MediumRowIcon =
		MEDIUM_ICONS[
			resolvePrimaryMediumIcon(
			isChosen('medium') ? value.modality : undefined,
			isChosen('medium')
		)
		];

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
				icon={<Date400Icon />}
				label={
					isChosen('date') && value.startDate
						? dayjs(value.startDate).format('D. MMMM YYYY')
						: translate('groupChat.circle.rows.dateLabel')
				}
				variant={variantFor('date', isChosen('date'))}
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
							markTouched('date');
							setOpenRow(null);
						}}
					/>
				</RowMenu>
			)}

			<OrisoTimePicker
				label={timeLabel}
				ampm={false}
				value={dayjs(`2000-01-01T${value.startTime || '12:00'}`)}
				onChange={(next) => {
					if (!next) {
						return;
					}
					update('startTime', next.format('HH:mm'));
					markTouched('time');
				}}
				renderTrigger={(openDialog) => (
					<SplitButton
						fullWidth
						icon={<StartTime400Icon />}
						label={
							isChosen('time') && value.startTime
								? value.startTime
								: timeLabel
						}
						variant={isChosen('time') ? 'tonal' : 'outlined'}
						onClick={openDialog}
						mainOpensMenu={false}
						onDecrement={() => {
							markTouched('time');
							shiftTime(-TIME_STEP_MINUTES);
						}}
						onIncrement={() => {
							markTouched('time');
							shiftTime(TIME_STEP_MINUTES);
						}}
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
				icon={<Duration400Icon />}
				label={
					isChosen('duration') && value.duration
						? translate('groupChat.circle.rows.durationValue', {
								count: value.duration / 60
							})
						: durationLabel
				}
				variant={variantFor('duration', isChosen('duration'))}
				open={openRow === 'duration'}
				onClick={() => toggle('duration')}
				onDecrement={() => {
					markTouched('duration');
					shiftDuration(-1);
				}}
				onIncrement={() => {
					markTouched('duration');
					shiftDuration(1);
				}}
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
						markTouched('duration');
						setOpenRow(null);
					}}
					anchorRef={durationRef}
					onClose={() => setOpenRow(null)}
				/>
			)}

			<SplitButton
				ref={repeatRef}
				fullWidth
				icon={
					!isChosen('repeat') ? (
						<Interval400Icon />
					) : repeatMode === 'interval' ? (
						<IntervalFilledIcon />
					) : (
						<Repeat400Icon />
					)
				}
				label={
					!isChosen('repeat')
						? repeatLabel
						: repeatMode === 'interval'
						? translate(
								`groupChat.create.interval.options.${value.interval.toLowerCase()}`,
								value.interval
							)
						: translate('groupChat.circle.rows.repeatValue', {
								count: value.repeatCount
							})
				}
				variant={variantFor('repeat', isChosen('repeat'))}
				open={openRow === 'repeat'}
				onClick={() => toggle('repeat')}
				onDecrement={() => {
					setRepeatMode('count');
					markTouched('repeat');
					shiftRepeat(-1);
				}}
				onIncrement={() => {
					setRepeatMode('count');
					markTouched('repeat');
					shiftRepeat(1);
				}}
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
							`groupChat.create.interval.options.${interval.toLowerCase()}`,
							interval
						)
					}))}
					value={value.interval}
					onSelect={(next) => {
						update('interval', next as GroupChatInterval);
						setRepeatMode('interval');
						markTouched('repeat');
						setOpenRow(null);
					}}
					anchorRef={repeatRef}
					onClose={() => setOpenRow(null)}
				/>
			)}

			<SplitButton
				ref={mediumRef}
				fullWidth
				icon={<MediumRowIcon />}
				label={
					isChosen('medium') && value.modality
						? translate(
								`groupChat.create.modality.options.${value.modality.toLowerCase()}`,
								value.modality
							)
						: translate('groupChat.circle.rows.mediumLabel')
				}
				variant={variantFor('medium', isChosen('medium'))}
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
							`groupChat.create.modality.options.${modality.toLowerCase()}`,
							modality
						)
					}))}
					value={value.modality}
					onSelect={(next) => {
						update('modality', next as GroupChatModality);
						markTouched('medium');
						setOpenRow(null);
					}}
					anchorRef={mediumRef}
					onClose={() => setOpenRow(null)}
				/>
			)}

			<SplitButton
				ref={languageRef}
				fullWidth
				icon={<Language400Icon />}
				label={
					(isChosen('language') &&
						languageOptions.find(
							(option) => option.value === language
						)?.label) ||
					translate('groupChat.circle.rows.languageLabel')
				}
				variant={variantFor('language', isChosen('language'))}
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
						markTouched('language');
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
