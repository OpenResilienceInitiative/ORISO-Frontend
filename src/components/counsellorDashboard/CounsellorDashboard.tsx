import * as React from 'react';
import { useTranslation } from 'react-i18next';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { DirectLink } from '../conversationCreate/directLink/directLink';
import { DirectLinkMediumIcon } from '../conversationCreate/directLink/DirectLinkMediumIcon';
import { MyDirectLinks } from '../conversationCreate/directLink/MyDirectLinks';
import { EmptyState } from '../emptyState/EmptyState';
import './counsellorDashboard.styles.scss';

export interface DashboardCircle {
	id: string;
	topic: string;
	/** Already formatted for display, e.g. "Do., 30. Okt · 19:00". */
	when: string;
	medium: DirectLink['medium'];
	participants: number;
}

/** The counsellor's own figures from `apiGetConsultantStatistics` for the period. */
export interface DashboardStats {
	assignedSessions: number;
	activeSessions: number;
	sentMessages: number;
	/** Not in the statistics service yet; the bar shows once it is. */
	archivedSessions?: number;
}

export interface CounsellorDashboardProps {
	stats: DashboardStats;
	links: DirectLink[];
	/** At most three, soonest first. */
	upcomingCircles: DashboardCircle[];
	onCreateLink: () => void;
	onToggleLink: (id: string, active: boolean) => void;
	onShowQr: (link: DirectLink) => void;
	onCopy?: (url: string) => void | Promise<void>;
}

/**
 * #1795: what "Gespräche" shows while no conversation is selected — tiles on
 * the grey app background, no empty white conversation room. With no direct
 * link and no upcoming circle it stays the turning-cup empty state.
 */
export const CounsellorDashboard = ({
	stats,
	links,
	upcomingCircles,
	onCreateLink,
	onToggleLink,
	onShowQr,
	onCopy
}: CounsellorDashboardProps) => {
	const { t } = useTranslation();

	if (links.length === 0 && upcomingCircles.length === 0) {
		return (
			<EmptyState
				className="session__emptyState"
				headline={t('session.emptyAllCaughtUp')}
				variant="conversation-nothing-to-do"
			/>
		);
	}

	const { archivedSessions } = stats;
	const sessionFigures = [
		{ key: 'assigned', value: stats.assignedSessions },
		{ key: 'active', value: stats.activeSessions },
		...(archivedSessions === undefined
			? []
			: [{ key: 'archived', value: archivedSessions }])
	];
	const total = stats.activeSessions + (archivedSessions ?? 0);

	return (
		<div className="counsellorDashboard" data-testid="counsellor-dashboard">
			<h2 className="counsellorDashboard__title">
				{t('dashboard.title')}
			</h2>
			<div className="counsellorDashboard__top">
				<section
					className="counsellorDashboard__tile counsellorDashboard__tile--sessions"
					aria-labelledby="dashboardSessionsTitle"
				>
					<header className="counsellorDashboard__tileHeader">
						<span className="counsellorDashboard__tileIcon">
							<ForumOutlinedIcon aria-hidden />
						</span>
						<h3
							id="dashboardSessionsTitle"
							className="counsellorDashboard__tileTitle"
						>
							{t('dashboard.stats.title')}
						</h3>
						<span className="counsellorDashboard__period">
							{t('dashboard.stats.period')}
						</span>
					</header>
					<dl className="counsellorDashboard__figures">
						{sessionFigures.map(({ key, value }) => (
							<div
								key={key}
								className={`counsellorDashboard__figure counsellorDashboard__figure--${key}`}
							>
								<dt>{t(`dashboard.stats.${key}`)}</dt>
								<dd>{value}</dd>
							</div>
						))}
					</dl>
					{archivedSessions !== undefined && total > 0 && (
						<div className="counsellorDashboard__bar" aria-hidden>
							<span
								className="counsellorDashboard__barActive"
								style={{
									width: `${(stats.activeSessions / total) * 100}%`
								}}
							/>
						</div>
					)}
				</section>
				<section
					className="counsellorDashboard__tile counsellorDashboard__tile--messages"
					aria-labelledby="dashboardMessagesTitle"
				>
					<header className="counsellorDashboard__tileHeader">
						<span className="counsellorDashboard__tileIcon">
							<SendOutlinedIcon aria-hidden />
						</span>
						<h3
							id="dashboardMessagesTitle"
							className="counsellorDashboard__tileTitle"
						>
							{t('dashboard.stats.sentMessages')}
						</h3>
					</header>
					<p className="counsellorDashboard__bigNumber">
						{stats.sentMessages}
					</p>
					<span className="counsellorDashboard__period">
						{t('dashboard.stats.period')}
					</span>
				</section>
				{upcomingCircles.length > 0 && (
					<section
						className="counsellorDashboard__tile counsellorDashboard__tile--circles"
						aria-labelledby="dashboardCirclesTitle"
					>
						<h3
							id="dashboardCirclesTitle"
							className="counsellorDashboard__tileTitle"
						>
							{t('dashboard.circles.title')}
						</h3>
						<ul className="counsellorDashboard__circles">
							{upcomingCircles.slice(0, 3).map((circle) => (
								<li
									key={circle.id}
									className="counsellorDashboard__circle"
								>
									<span className="counsellorDashboard__circleIcon">
										<DirectLinkMediumIcon
											medium={circle.medium}
										/>
									</span>
									<span className="counsellorDashboard__circleText">
										<span className="counsellorDashboard__circleTopic">
											{circle.topic}
										</span>
										<span className="counsellorDashboard__circleMeta">
											{circle.when} ·{' '}
											{t(
												'dashboard.circles.participants',
												{
													count: circle.participants
												}
											)}
										</span>
									</span>
								</li>
							))}
						</ul>
					</section>
				)}
			</div>
			<MyDirectLinks
				links={links}
				onCreate={onCreateLink}
				onToggle={onToggleLink}
				onShowQr={onShowQr}
				onCopy={onCopy}
			/>
		</div>
	);
};
