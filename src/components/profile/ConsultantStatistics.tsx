import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	apiGetConsultantStatistics,
	ApiGetConsultantStatisticsInterface,
	ConsultantStatisticsDTO,
	FETCH_ERRORS
} from '../../api';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import MarkChatReadOutlinedIcon from '@mui/icons-material/MarkChatReadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { CSVLink } from 'react-csv';
import { formatToDDMMYYYY } from '../../utils/dateHelpers';
import { Headline } from '../headline/Headline';
import dayjs from 'dayjs';
import './statistics.styles';
import './profile.styles';
import { useTranslation } from 'react-i18next';
import {
	breakdownForPeriod,
	csvColumns,
	csvRows,
	datesForPeriod,
	figureLabelKey,
	StatisticsPeriod
} from './consultantStatisticsData';

type LoadStatistics = (
	request: ApiGetConsultantStatisticsInterface
) => Promise<ConsultantStatisticsDTO>;

interface ConsultantStatisticsProps {
	/** Where the figures come from; Storybook passes sample figures. */
	loadStatistics?: LoadStatistics;
}

/**
 * The real endpoint, with errors caught here: a failed request shows the
 * retry notice in the card instead of leaving for the error page.
 */
const loadOwnStatistics: LoadStatistics = (request) =>
	apiGetConsultantStatistics({
		...request,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});

type Unit = 'Week' | 'Month' | 'Year';
type Offset = 'current' | 'last';
type LoadState = 'loading' | 'ready' | 'error';

const UNITS: Unit[] = ['Week', 'Month', 'Year'];
const OFFSETS: Offset[] = ['current', 'last'];

const appointmentKinds = [
	'numberOfVideoAppointments',
	'numberOfPhoneAppointments',
	'numberOfOnsiteAppointments',
	'numberOfChatAppointments'
] as const;

const figureKeys = [
	'numberOfAppointments',
	'numberOfAssignedSessions',
	'numberOfActiveSessions',
	'numberOfSentMessages'
] as const;

/** M3 segmented button, same look as the display-filter dialog. */
const segmentedSx = {
	'borderRadius': '999px',
	'border': '1px solid var(--m3-outline, #747878)',
	'overflow': 'hidden',
	'& .MuiToggleButton-root': {
		'flex': 1,
		'minHeight': 40,
		'minWidth': 0,
		'px': '12px',
		'py': 0,
		'whiteSpace': 'nowrap',
		'border': 0,
		'borderRadius': 0,
		'textTransform': 'none',
		'fontSize': 14,
		'fontWeight': 500,
		'lineHeight': '20px',
		'letterSpacing': '0.1px',
		'color': 'var(--m3-on-surface, #1b1b1c)',
		'& + .MuiToggleButton-root': {
			borderLeft: '1px solid var(--m3-outline, #747878)'
		},
		'&.Mui-selected, &.Mui-selected:hover': {
			backgroundColor: 'var(--m3-secondary-container, #656e79)',
			color: 'var(--m3-on-secondary-container, #e6effb)'
		},
		'&.Mui-focusVisible': {
			outline: '2px solid var(--m3-primary, #a5000a)',
			outlineOffset: '-2px'
		}
	}
} as const;

const SegmentedChoice = <T extends string>({
	label,
	value,
	options,
	onChange,
	cy
}: {
	label: string;
	value: T;
	options: { value: T; label: string }[];
	onChange: (next: T) => void;
	cy: string;
}) => (
	<ToggleButtonGroup
		exclusive
		size="small"
		aria-label={label}
		value={value}
		onChange={(_, next: T | null) => {
			if (next) onChange(next);
		}}
		sx={segmentedSx}
		className="statistics__segmented"
		data-cy={cy}
	>
		{options.map((option) => (
			<ToggleButton
				key={option.value}
				value={option.value}
				disableRipple
				data-cy={`${cy}-${option.value}`}
			>
				{option.label}
			</ToggleButton>
		))}
	</ToggleButtonGroup>
);

/**
 * The counsellor's own figures in the profile (ORISO-Frontend#2299, redesign
 * #2558): realised appointments by kind and cancelled ones, consultations and
 * messages for a week, month or year, and a CSV with one row per day, week
 * or month plus a total row. Only aggregated own numbers, never content.
 */
export const ConsultantStatistics = ({
	loadStatistics = loadOwnStatistics
}: ConsultantStatisticsProps) => {
	const { t: translate } = useTranslation();
	const [unit, setUnit] = useState<Unit>('Month');
	const [offset, setOffset] = useState<Offset>('current');
	const [statistics, setStatistics] =
		useState<ConsultantStatisticsDTO | null>(null);
	const [loadState, setLoadState] = useState<LoadState>('loading');
	const [attempt, setAttempt] = useState(0);
	const statisticsPeriod = `${offset}${unit}` as StatisticsPeriod;

	useEffect(() => {
		let current = true;
		setLoadState('loading');
		loadStatistics({
			...datesForPeriod(statisticsPeriod),
			breakdown: breakdownForPeriod(statisticsPeriod)
		})
			.then((response) => {
				if (!current) return;
				setStatistics(response);
				setLoadState('ready');
			})
			.catch(() => {
				if (!current) return;
				setStatistics(null);
				setLoadState('error');
			});
		return () => {
			current = false;
		};
	}, [statisticsPeriod, loadStatistics, attempt]);

	const retry = useCallback(() => setAttempt((n) => n + 1), []);

	const currentYear = dayjs().get('year');
	const offsetLabel = (value: Offset) => {
		// The year picker shows the concrete year; week and month say
		// "diese/letzte" in the chosen unit.
		if (unit === 'Year') {
			return String(value === 'current' ? currentYear : currentYear - 1);
		}
		return translate(`profile.statistics.period.button.${value}${unit}`);
	};

	const requested = datesForPeriod(statisticsPeriod);
	const range = statistics ?? requested;
	const periodDisplay = `${formatToDDMMYYYY(dayjs(range.startDate).valueOf())} – ${formatToDDMMYYYY(dayjs(range.endDate).valueOf())}`;

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

	const ready = loadState === 'ready';
	const figure = (key: keyof ConsultantStatisticsDTO) =>
		Number(statistics?.[key] ?? 0);
	const shown = (key: keyof ConsultantStatisticsDTO) =>
		ready ? figure(key) : '–';
	const empty = ready && figureKeys.every((key) => figure(key) === 0);

	const tile = (
		icon: React.ReactNode,
		key: (typeof figureKeys)[number],
		children?: React.ReactNode
	) => (
		<div
			className={`statistics__tile${children ? ' statistics__tile--wide' : ''}`}
			data-figure={key}
		>
			<span className="statistics__tileIcon" aria-hidden="true">
				{icon}
			</span>
			<span className="statistics__tileValue">{shown(key)}</span>
			<span className="statistics__tileLabel">
				{translate(figureLabelKey(key))}
			</span>
			{children}
		</div>
	);

	return (
		<div className="statistics" data-state={loadState}>
			<div className="profile__content__title">
				<Headline
					text={translate('profile.statistics.title')}
					semanticLevel="5"
				/>
			</div>
			<div className="statistics__period">
				<SegmentedChoice
					label={translate('profile.statistics.period.unitLabel')}
					value={unit}
					options={UNITS.map((value) => ({
						value,
						label: translate(
							`profile.statistics.period.unit${value}`
						)
					}))}
					onChange={setUnit}
					cy="statistics-unit"
				/>
				<SegmentedChoice
					label={translate('profile.statistics.period.offsetLabel')}
					value={offset}
					options={OFFSETS.map((value) => ({
						value,
						label: offsetLabel(value)
					}))}
					onChange={setOffset}
					cy="statistics-offset"
				/>
				<p className="statistics__range" aria-live="polite">
					{periodDisplay}
				</p>
			</div>

			{loadState === 'error' ? (
				<div className="statistics__notice" role="status">
					<span>{translate('profile.statistics.state.error')}</span>
					<button
						type="button"
						className="statistics__textButton"
						onClick={retry}
					>
						{translate('profile.statistics.state.retry')}
					</button>
				</div>
			) : (
				<div
					className="statistics__tiles"
					aria-busy={loadState === 'loading'}
				>
					{tile(
						<EventOutlinedIcon />,
						'numberOfAppointments',
						<ul className="statistics__kinds">
							{appointmentKinds.map((key) => (
								<li key={key}>
									<span>
										{translate(
											`profile.statistics.kind.${key}`
										)}
									</span>
									<strong>{shown(key)}</strong>
								</li>
							))}
							<li className="statistics__kinds--cancelled">
								<span>
									{translate(
										'profile.statistics.kind.numberOfCancelledAppointments'
									)}
								</span>
								<strong>
									{shown('numberOfCancelledAppointments')}
								</strong>
							</li>
						</ul>
					)}
					{tile(<PeopleOutlineIcon />, 'numberOfAssignedSessions')}
					{tile(<ForumOutlinedIcon />, 'numberOfActiveSessions')}
					{tile(<MarkChatReadOutlinedIcon />, 'numberOfSentMessages')}
				</div>
			)}

			{empty && (
				<p className="statistics__notice" role="status">
					{translate('profile.statistics.state.empty')}
				</p>
			)}

			{ready && statistics && (
				<div className="statistics__download">
					<CSVLink
						separator={';'}
						headers={csvHeaders}
						data={csvData}
						filename={`${translate(
							'profile.statistics.complete.filename'
						)} - ${periodDisplay}.csv`}
						className="statistics__downloadButton"
						data-cy="statistics-download"
					>
						<FileDownloadOutlinedIcon aria-hidden="true" />
						{translate('profile.statistics.complete.download.csv')}
					</CSVLink>
					<p className="statistics__hint">
						{translate(`profile.statistics.complete.hint${unit}`)}
					</p>
				</div>
			)}
		</div>
	);
};
