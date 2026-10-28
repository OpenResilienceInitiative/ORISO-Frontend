import * as React from 'react';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGetConsultantSessionList } from '../../api/apiGetConsultantSessionList';
import {
	apiGetConsultantStatistics,
	ConsultantStatisticsDTO
} from '../../api/apiGetConsultantStatistics';
import { FETCH_ERRORS } from '../../api/fetchData';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { DirectLink } from '../conversationCreate/directLink/directLink';
import { DirectLinkShareDialog } from '../conversationCreate/directLink/DirectLinkShareDialog';
import { useDirectLinks } from '../conversationCreate/directLink/useDirectLinks';
import {
	CounsellorDashboard,
	DashboardCircle,
	DashboardStats
} from './CounsellorDashboard';
import { statisticsEnabled, upcomingCirclesFrom } from './dashboardData';

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** "Letzte 30 Tage", as the tile says: today and the 29 days before. */
export const last30Days = (today = new Date()) => {
	const start = new Date(today);
	start.setDate(start.getDate() - 29);
	return { startDate: isoDate(start), endDate: isoDate(today) };
};

const toStats = (dto: ConsultantStatisticsDTO | null): DashboardStats => ({
	assignedSessions: dto?.numberOfAssignedSessions ?? 0,
	activeSessions: dto?.numberOfActiveSessions ?? 0,
	sentMessages: dto?.numberOfSentMessages ?? 0
});

/** Enough of her own list to find the next circles; one page, no paging. */
const CIRCLE_LOOKUP_COUNT = 100;

interface CounsellorDashboardWiredProps {
	/** Shown while the links load, and when the counsellor has none. */
	fallback: ReactNode;
	compact?: boolean;
}

/**
 * #1795 wired: "Gespräche" with nothing selected. The counsellor's real
 * direct links (ORISO-UserService#1479) with copy, QR and on/off, and her own
 * figures from `apiGetConsultantStatistics` (hidden where the Träger switched
 * statistics off), plus her next self-help circles from her own conversation
 * list. Without any link or circle the screen stays what it was (`fallback`).
 */
export const CounsellorDashboardWired = ({
	fallback,
	compact = false
}: CounsellorDashboardWiredProps) => {
	const { i18n } = useTranslation();
	const tenant = useTenant();
	const showStats = statisticsEnabled(tenant);
	const { links, loaded, toggle } = useDirectLinks();
	const [stats, setStats] = useState<ConsultantStatisticsDTO | null>(null);
	const [circles, setCircles] = useState<DashboardCircle[]>([]);
	const [qrLink, setQrLink] = useState<DirectLink>();

	useEffect(() => {
		let cancelled = false;
		apiGetConsultantSessionList({
			type: SESSION_LIST_TYPES.MY_SESSION,
			count: CIRCLE_LOOKUP_COUNT
		})
			.then((list) => {
				if (!cancelled)
					setCircles(
						upcomingCirclesFrom(list?.sessions ?? [], i18n.language)
					);
			})
			// No conversations (204) or a failed lookup: no circle tile.
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [i18n.language]);

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

	if (!loaded || (links.length === 0 && circles.length === 0))
		return <>{fallback}</>;

	return (
		<>
			<CounsellorDashboard
				stats={showStats ? toStats(stats) : undefined}
				links={links}
				upcomingCircles={circles}
				onToggleLink={(id, active) => void toggle(id, active)}
				onShowQr={setQrLink}
			/>
			{qrLink && (
				<DirectLinkShareDialog
					open
					link={qrLink}
					fullScreen={compact}
					onClose={() => setQrLink(undefined)}
				/>
			)}
		</>
	);
};
