import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, type EmptyStateVariant } from '../emptyState/EmptyState';
import './counsellorDashboard.styles.scss';

/** The counsellor's own figures from `apiGetConsultantStatistics` for the period. */
export interface DashboardStats {
	assignedSessions: number;
	activeSessions: number;
}

export interface CounsellorDashboardProps {
	/** The same line the empty conversation pane shows without the overview. */
	headline: string;
	variant: EmptyStateVariant;
	/** Left out while loading, after a failure, or where the Träger switched statistics off. */
	stats?: DashboardStats;
}

/**
 * #1795, calmed down after user feedback that the screen was overloaded
 * (Frank, 2026-11-25, variant C): "Gespräche" with no conversation selected
 * keeps the quiet empty state — the turning cup and its line — and adds two
 * small figures. No tiles. Direct links are managed in "Meine Termine". On
 * the phone this pane never shows: the list opens straight into the chat.
 */
export const CounsellorDashboard = ({
	headline,
	variant,
	stats
}: CounsellorDashboardProps) => {
	const { t } = useTranslation();
	return (
		<div
			className="session session--empty counsellorDashboard"
			data-testid="counsellor-dashboard"
		>
			<EmptyState
				className="session__emptyState"
				headline={headline}
				variant={variant}
			>
				{stats && (
					<dl
						className="counsellorDashboard__figures"
						data-testid="counsellor-dashboard-figures"
					>
						<div className="counsellorDashboard__figure">
							<dd>{stats.activeSessions}</dd>
							<dt>{t('dashboard.quiet.active')}</dt>
						</div>
						<div className="counsellorDashboard__figure">
							<dd>{stats.assignedSessions}</dd>
							<dt>{t('dashboard.quiet.assigned')}</dt>
						</div>
					</dl>
				)}
			</EmptyState>
		</div>
	);
};
