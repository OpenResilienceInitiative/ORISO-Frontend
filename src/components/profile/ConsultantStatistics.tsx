import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
	apiGetConsultantStatistics,
	ApiGetConsultantStatisticsInterface,
	ConsultantStatisticsDTO
} from '../../api';
import { OrisoSelect } from '../form/OrisoSelect';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { ReactComponent as PersonsIcon } from '../../resources/img/icons/persons.svg';
import { ReactComponent as SpeechBubbleIcon } from '../../resources/img/icons/speech-bubble.svg';
import { ReactComponent as SpeechBubblePlusIcon } from '../../resources/img/icons/speech-bubble-plus.svg';
import { ReactComponent as DownloadIcon } from '../../resources/img/icons/download.svg';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { CSVLink } from 'react-csv';
import { formatToDDMMYYYY } from '../../utils/dateHelpers';
import dayjs from 'dayjs';
import './statistics.styles';
import './profile.styles';
import { useTranslation } from 'react-i18next';
import { SelectChangeEvent } from '@mui/material/Select';
import {
	breakdownForPeriod,
	csvColumns,
	csvRows,
	datesForPeriod,
	figureLabelKey,
	StatisticsPeriod,
	statisticsPeriods
} from './consultantStatisticsData';

type LoadStatistics = (
	request: ApiGetConsultantStatisticsInterface
) => Promise<ConsultantStatisticsDTO>;

interface ConsultantStatisticsProps {
	/** Where the figures come from; Storybook passes sample figures. */
	loadStatistics?: LoadStatistics;
}

const appointmentKinds = [
	'numberOfVideoAppointments',
	'numberOfPhoneAppointments',
	'numberOfOnsiteAppointments',
	'numberOfChatAppointments'
] as const;

/**
 * The counsellor's own figures in the profile (ORISO-Frontend#2299):
 * realised appointments by kind and cancelled ones, consultations and
 * messages for a week, month or year, and a CSV with one row per day, week
 * or month plus a total row. Only aggregated own numbers, never content.
 */
export const ConsultantStatistics = ({
	loadStatistics = apiGetConsultantStatistics
}: ConsultantStatisticsProps) => {
	const { t: translate } = useTranslation();
	const [statisticsPeriod, setStatisticsPeriod] =
		useState<StatisticsPeriod>('currentMonth');
	const [statistics, setStatistics] =
		useState<ConsultantStatisticsDTO | null>(null);

	const currentYear = dayjs().get('year');
	const periodOptions = statisticsPeriods.map((value) => {
		const label = translate(`profile.statistics.period.${value}`);
		// The year picker shows the concrete year, without a new key per language.
		if (value === 'currentYear') {
			return { value, label: `${label} (${currentYear})` };
		}
		if (value === 'lastYear') {
			return { value, label: `${label} (${currentYear - 1})` };
		}
		return { value, label };
	});

	useEffect(() => {
		let current = true;
		loadStatistics({
			...datesForPeriod(statisticsPeriod),
			breakdown: breakdownForPeriod(statisticsPeriod)
		})
			.then((response) => {
				if (current) setStatistics(response);
			})
			.catch(() => {
				if (current) setStatistics(null);
			});
		return () => {
			current = false;
		};
	}, [statisticsPeriod, loadStatistics]);

	const periodDisplay = statistics
		? `${formatToDDMMYYYY(dayjs(statistics.startDate).valueOf())} - ${formatToDDMMYYYY(dayjs(statistics.endDate).valueOf())}`
		: translate('profile.statistics.period.display.default');

	const csvHeaders = csvColumns.map((key) => ({
		key,
		label: translate(figureLabelKey(key))
	}));
	const csvData = useMemo(
		() =>
			statistics
				? csvRows(
						statistics,
						translate('profile.statistics.complete.total')
					)
				: [],
		[statistics, translate]
	);

	const figure = (key: keyof ConsultantStatisticsDTO) =>
		Number(statistics?.[key] ?? 0);

	const tile = (
		icon: React.ReactNode,
		key: keyof ConsultantStatisticsDTO,
		children?: React.ReactNode
	) => (
		<div className="statistics__visualization" data-figure={key}>
			<span>
				{icon}
				<p>{figure(key)}</p>
			</span>
			<Text text={translate(figureLabelKey(key))} type="standard" />
			{children}
		</div>
	);

	return (
		<div className="statistics">
			<div className="profile__content__title">
				<Headline
					text={translate('profile.statistics.title')}
					semanticLevel="5"
				/>
			</div>
			<div className="statistics__periodSelect">
				<Text
					text={translate('profile.statistics.period.prefix')}
					type="infoLargeAlternative"
				/>
				<OrisoSelect
					id="statisticsSelect"
					label={translate('profile.statistics.period.prefix')}
					options={periodOptions}
					value={statisticsPeriod}
					onChange={(event: SelectChangeEvent<string>) =>
						setStatisticsPeriod(
							event.target.value as StatisticsPeriod
						)
					}
				/>
			</div>
			<div className="b--1 p--3 mb--4">
				<Text
					text={`${translate(
						'profile.statistics.period.display.prefix'
					)}${periodDisplay}${translate(
						'profile.statistics.period.display.suffix'
					)}`}
					className="text--center text--bold"
					type="standard"
				/>
				<div className="statistics__visuals__wrapper">
					{tile(
						<EventOutlinedIcon aria-hidden="true" />,
						'numberOfAppointments',
						<ul className="statistics__breakdown">
							{appointmentKinds.map((key) => (
								<li key={key}>
									{translate(figureLabelKey(key))}:{' '}
									<strong>{figure(key)}</strong>
								</li>
							))}
							<li>
								{translate(
									'profile.statistics.csvHeader.numberOfCancelledAppointments'
								)}
								:{' '}
								<strong>
									{figure('numberOfCancelledAppointments')}
								</strong>
							</li>
						</ul>
					)}
					{tile(
						<PersonsIcon aria-hidden="true" focusable="false" />,
						'numberOfAssignedSessions'
					)}
					{tile(
						<SpeechBubbleIcon
							aria-hidden="true"
							focusable="false"
						/>,
						'numberOfActiveSessions'
					)}
					{tile(
						<SpeechBubblePlusIcon
							aria-hidden="true"
							focusable="false"
						/>,
						'numberOfSentMessages'
					)}
				</div>
			</div>
			{statistics && (
				<div className="statistics__download">
					<Text
						text={translate('profile.statistics.complete.title')}
						type="infoLargeAlternative"
					/>
					<CSVLink
						separator={';'}
						headers={csvHeaders}
						data={csvData}
						filename={`${translate(
							'profile.statistics.complete.filename'
						)} - ${periodDisplay}.csv`}
						className="button-as-link"
					>
						<DownloadIcon
							title={translate(
								'profile.statistics.complete.download.label'
							)}
							aria-label={translate(
								'profile.statistics.complete.download.label'
							)}
						/>
						{translate(
							'profile.statistics.complete.download.label'
						)}
					</CSVLink>
				</div>
			)}
		</div>
	);
};
