import * as React from 'react';
import { ReactNode, useEffect, useState } from 'react';
import {
	apiGetConsultantStatistics,
	ConsultantStatisticsDTO
} from '../../api/apiGetConsultantStatistics';
import { FETCH_ERRORS } from '../../api/fetchData';
import { DirectLink } from '../conversationCreate/directLink/directLink';
import { DirectLinkShareDialog } from '../conversationCreate/directLink/DirectLinkShareDialog';
import { useDirectLinks } from '../conversationCreate/directLink/useDirectLinks';
import { CounsellorDashboard, DashboardStats } from './CounsellorDashboard';

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

interface CounsellorDashboardWiredProps {
	/** Shown while the links load, and when the counsellor has none. */
	fallback: ReactNode;
	compact?: boolean;
}

/**
 * #1795 wired: "Gespräche" with nothing selected. The counsellor's real
 * direct links (ORISO-UserService#1479) with copy, QR and on/off, and her own
 * figures from `apiGetConsultantStatistics`. Without any link the screen stays
 * what it was (`fallback`); upcoming circles are not loaded here yet.
 */
export const CounsellorDashboardWired = ({
	fallback,
	compact = false
}: CounsellorDashboardWiredProps) => {
	const { links, loaded, toggle } = useDirectLinks();
	const [stats, setStats] = useState<ConsultantStatisticsDTO | null>(null);
	const [qrLink, setQrLink] = useState<DirectLink>();

	useEffect(() => {
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
	}, []);

	if (!loaded || links.length === 0) return <>{fallback}</>;

	return (
		<>
			<CounsellorDashboard
				stats={toStats(stats)}
				links={links}
				upcomingCircles={[]}
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
