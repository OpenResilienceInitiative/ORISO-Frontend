import React from 'react';
import { useTranslation } from 'react-i18next';
import { OrisoSelect } from '../form/OrisoSelect';
import {
	durationSelectOptionsSet,
	getValidDateFormatForSelectedDate,
	GroupChatInterval,
	GroupChatModality
} from './createChatHelpers';

export interface GroupChatSeriesFieldsValue {
	startDate: string;
	startTime: string;
	duration: number;
	repeatCount: number;
	interval: GroupChatInterval;
	modality: GroupChatModality;
}

interface GroupChatSeriesFieldsProps {
	value: GroupChatSeriesFieldsValue;
	onChange: (value: GroupChatSeriesFieldsValue) => void;
}

const INTERVALS: GroupChatInterval[] = [
	'DAILY',
	'WEEKLY',
	'BIWEEKLY',
	'MONTHLY',
	'QUARTERLY',
	'YEARLY'
];

const MODALITIES: GroupChatModality[] = ['TEXT', 'AUDIO', 'VIDEO'];

export const GroupChatSeriesFields = ({
	value,
	onChange
}: GroupChatSeriesFieldsProps) => {
	const { t: translate } = useTranslation();
	const [repeatCountInput, setRepeatCountInput] = React.useState(
		String(value.repeatCount)
	);
	React.useEffect(() => {
		setRepeatCountInput(String(value.repeatCount));
	}, [value.repeatCount]);
	const update = <Key extends keyof GroupChatSeriesFieldsValue>(
		key: Key,
		fieldValue: GroupChatSeriesFieldsValue[Key]
	) => onChange({ ...value, [key]: fieldValue });
	const commitRepeatCount = () => {
		const parsed = Number(repeatCountInput);
		const next = Math.min(
			365,
			Math.max(1, Number.isFinite(parsed) ? Math.round(parsed) : 1)
		);
		setRepeatCountInput(String(next));
		update('repeatCount', next);
	};

	return (
		<fieldset className="createChat__seriesFields">
			<legend>{translate('groupChat.create.schedule')}</legend>
			<label>
				{translate('groupChat.create.startDate')}
				<input
					type="date"
					min={getValidDateFormatForSelectedDate(new Date())}
					value={value.startDate}
					onChange={(event) =>
						update('startDate', event.target.value)
					}
					required
				/>
			</label>
			<label>
				{translate('groupChat.create.startTime')}
				<input
					type="time"
					value={value.startTime}
					onChange={(event) =>
						update('startTime', event.target.value)
					}
					required
				/>
			</label>
			<OrisoSelect
				id="group-chat-duration"
				label={translate('groupChat.create.duration')}
				value={String(value.duration)}
				options={durationSelectOptionsSet.map((option) => ({
					value: option.value,
					label: translate(option.label)
				}))}
				onChange={(event) =>
					update('duration', Number(event.target.value))
				}
			/>
			<label>
				{translate('groupChat.create.repeatCount')}
				<input
					type="number"
					min="1"
					max="365"
					value={repeatCountInput}
					onChange={(event) =>
						setRepeatCountInput(event.target.value)
					}
					onBlur={commitRepeatCount}
				/>
			</label>
			<OrisoSelect
				id="group-chat-interval"
				label={translate('groupChat.create.interval.label')}
				value={value.interval}
				disabled={value.repeatCount === 1}
				options={INTERVALS.map((interval) => ({
					value: interval,
					label: translate(
						`groupChat.create.interval.options.${interval.toLowerCase()}`
					)
				}))}
				onChange={(event) =>
					update('interval', event.target.value as GroupChatInterval)
				}
			/>
			<OrisoSelect
				id="group-chat-modality"
				label={translate('groupChat.create.modality.label')}
				value={value.modality}
				options={MODALITIES.map((modality) => ({
					value: modality,
					label: translate(
						`groupChat.create.modality.options.${modality.toLowerCase()}`
					)
				}))}
				onChange={(event) =>
					update('modality', event.target.value as GroupChatModality)
				}
			/>
		</fieldset>
	);
};
