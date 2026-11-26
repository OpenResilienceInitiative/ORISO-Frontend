import * as React from 'react';
import { useEffect, useState } from 'react';
import {
	apiGetConsultantStatistics,
	ConsultantStatisticsDTO
} from '../../api/apiGetConsultantStatistics';
import { FETCH_ERRORS } from '../../api/fetchData';
import { useTenant } from '../../globalState/provider/TenantProvider';
import type { EmptyStateVariant } from '../emptyState/EmptyState';
import { CounsellorDashboard, DashboardStats } from './CounsellorDashboard';
import { last30Days, statisticsEnabled } from './dashboardData';

const toStats = (dto: ConsultantStatisticsDTO): DashboardStats => ({
	assignedSessions: dto.numberOfAssignedSessions ?? 0,
	activeSessions: dto.numberOfActiveSessions ?? 0
});

interface CounsellorDashboardWiredProps {
	/** The empty pane's own line and animation. */
	headline: string;
	variant: EmptyStateVariant;
}

/**
 * #1795 wired: "Gespräche" with nothing selected. The empty pane with two of
 * her own figures from `apiGetConsultantStatistics` for the last 30 days,
 * hidden where the Träger switched statistics off. Until the figures arrive,
 * or when they fail, the pane is the plain empty state.
 */
export const CounsellorDashboardWired = ({
	headline,
	variant
}: CounsellorDashboardWiredProps) => {
	const tenant = useTenant();
	const showStats = statisticsEnabled(tenant);
	const [stats, setStats] = useState<ConsultantStatisticsDTO | null>(null);

	useEffect(() => {
		if (!showStats) return;
		let cancelled = false;
		apiGetConsultantStatistics({
			...last30Days(),
			// A missing figure must not send the whole app to the error page.
			responseHandling: [FETCH_ERRORS.CATCH_ALL]
		})
			.then((dto) => {
				if (!cancelled) setStats(dto);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [showStats]);

	return (
		<CounsellorDashboard
			headline={headline}
			variant={variant}
			// No zeros while the figures load or after they failed.
			stats={showStats && stats ? toStats(stats) : undefined}
		/>
	);
};
