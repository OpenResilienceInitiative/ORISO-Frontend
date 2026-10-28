import * as React from 'react';
import { useTranslation } from 'react-i18next';
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
	/** Not in the statistics service yet; figure and bar show once it is. */
	archivedSessions?: number;
}

export interface CounsellorDashboardProps {
	stats: DashboardStats;
	links: DirectLink[];
	/** At most three, soonest first. */
	upcomingCircles: DashboardCircle[];
	onToggleLink: (id: string, active: boolean) => void;
	onShowQr: (link: DirectLink) => void;
	onCopy?: (url: string) => void | Promise<void>;
}

/**
 * #1795: what "Gespräche" shows while no conversation is selected — tiles on
 * the grey app background, no empty white conversation room. The layout
 * follows the width of its own pane (container queries), not the viewport.
 * With no direct link and no upcoming circle it stays the turning cup.
 */
export const CounsellorDashboard = ({
	stats,
	links,
	upcomingCircles,
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
	const figures = [
		{ key: 'assigned', value: stats.assignedSessions },
		{ key: 'active', value: stats.activeSessions },
		...(archivedSessions === undefined
			? []
			: [{ key: 'archived', value: archivedSessions }]),
		{ key: 'sentMessages', value: stats.sentMessages }
	];
	const total = stats.activeSessions + (archivedSessions ?? 0);

	return (
		<div className="counsellorDashboard" data-testid="counsellor-dashboard">
			<div className="counsellorDashboard__inner">
				<h2 className="counsellorDashboard__title">
					{t('dashboard.title')}
				</h2>
				<section
					className="counsellorDashboard__tile counsellorDashboard__stats"
					aria-labelledby="dashboardStatsTitle"
				>
					<header className="counsellorDashboard__tileHeader">
						<h3
							id="dashboardStatsTitle"
							className="counsellorDashboard__tileTitle"
						>
							{t('dashboard.stats.title')}
						</h3>
						<span className="counsellorDashboard__period">
							{t('dashboard.stats.period')}
						</span>
					</header>
					<dl className="counsellorDashboard__figures">
						{figures.map(({ key, value }) => (
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
				<div
					className={`counsellorDashboard__content${
						links.length > 0 && upcomingCircles.length > 0
							? ' counsellorDashboard__content--split'
							: ''
					}`}
				>
					{links.length > 0 && (
						<MyDirectLinks
							links={links}
							onToggle={onToggleLink}
							onShowQr={onShowQr}
							onCopy={onCopy}
						/>
					)}
					{upcomingCircles.length > 0 && (
						<section
							className="counsellorDashboard__tile counsellorDashboard__circlesTile"
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
			</div>
		</div>
	);
};
