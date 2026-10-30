import React from 'react';
import { Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Headline } from '../headline/Headline';
import { RadioButton } from '../radioButton/RadioButton';
import { useTimelineSettings } from '../../hooks/useTimelineSettings';
import {
	TIMELINE_SETTING_OPTIONS,
	type TimelineSettings as TimelineSettingsValue
} from '../../utils/timelineSettings/model';
import './timelineSettings.scss';

type SettingKey = keyof typeof TIMELINE_SETTING_OPTIONS;

/** Order on the page (ADR-021 §6); the "Jetzt" variant only while it is tested. */
const GROUPS: SettingKey[] = [
	'scrollModel',
	'reveal',
	'pastDate',
	'nowVariant'
];

/**
 * "Anzeige" → appointments in the conversation list (ADR-021). Clients and
 * counsellors alike; stored in Matrix account data, so it follows the
 * person to every device.
 */
export const TimelineSettings = () => {
	const { t } = useTranslation();
	const { settings, canWrite, writeFailed, update } = useTimelineSettings();
	return (
		<Stack spacing={1} data-cy="timeline-settings">
			<div className="profile__content__title">
				<Headline
					text={t('timelineSettings.title')}
					semanticLevel="5"
				/>
			</div>
			<Typography variant="body2" color="text.secondary">
				{t('timelineSettings.description')}
			</Typography>
			{GROUPS.map((key) => (
				<fieldset
					key={key}
					className="timelineSettings__group"
					disabled={!canWrite}
				>
					<legend className="timelineSettings__legend">
						{t(`timelineSettings.${key}.legend`)}
					</legend>
					{TIMELINE_SETTING_OPTIONS[key].map((value) => (
						<RadioButton
							key={value}
							type="smaller"
							name={`timelineSettings-${key}`}
							inputId={`timelineSettings-${key}-${value}`}
							value={value}
							checked={settings[key] === value}
							handleRadioButton={() =>
								update({
									[key]: value
								} as Partial<TimelineSettingsValue>)
							}
						>
							{t(`timelineSettings.${key}.${value}`)}
						</RadioButton>
					))}
				</fieldset>
			))}
			{writeFailed && (
				<Typography variant="body2" color="error" role="alert">
					{t('timelineSettings.writeFailed')}
				</Typography>
			)}
		</Stack>
	);
};
