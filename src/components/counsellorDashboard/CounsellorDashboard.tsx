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

export interface CounsellorDashboardProps {
	stats: { enquiries: number; sessions: number; circlesThisWeek: number };
	links: DirectLink[];
	/** At most three, soonest first. */
	upcomingCircles: DashboardCircle[];
	onCreateLink: () => void;
	onToggleLink: (id: string, active: boolean) => void;
	onShowQr: (link: DirectLink) => void;
	onCopy?: (url: string) => void | Promise<void>;
}

/**
 * #1795: what "Gespräche" shows while no conversation is selected. With no
 * direct link and no upcoming circle it stays the turning-cup empty state;
 * as soon as the counsellor has one, it becomes this overview.
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

	const tiles = [
		{ key: 'enquiries', value: stats.enquiries },
		{ key: 'sessions', value: stats.sessions },
		{ key: 'circlesThisWeek', value: stats.circlesThisWeek }
	] as const;

	return (
		<div className="counsellorDashboard" data-testid="counsellor-dashboard">
			<h2 className="counsellorDashboard__title">
				{t('dashboard.title')}
			</h2>
			<ul className="counsellorDashboard__stats">
				{tiles.map(({ key, value }) => (
					<li key={key} className="counsellorDashboard__stat">
						<span className="counsellorDashboard__statValue">
							{value}
						</span>
						<span className="counsellorDashboard__statLabel">
							{t(`dashboard.stats.${key}`)}
						</span>
					</li>
				))}
			</ul>
			<div className="counsellorDashboard__cards">
				<MyDirectLinks
					links={links}
					onCreate={onCreateLink}
					onToggle={onToggleLink}
					onShowQr={onShowQr}
					onCopy={onCopy}
				/>
				<section
					className="counsellorDashboard__card"
					aria-labelledby="dashboardCirclesTitle"
				>
					<h3
						id="dashboardCirclesTitle"
						className="counsellorDashboard__cardTitle"
					>
						{t('dashboard.circles.title')}
					</h3>
					{upcomingCircles.length === 0 ? (
						<p className="counsellorDashboard__none">
							{t('dashboard.circles.none')}
						</p>
					) : (
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
					)}
				</section>
			</div>
		</div>
	);
};
