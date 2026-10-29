import type {
	ListItemInterface,
	TenantDataInterface
} from '../../globalState/interfaces';
import { getGroupUpcomingDates } from '../groupChat/entryRoom/groupWaitingRoomData';
import { isSelfHelp } from '../groupChat/joinRequest/knockableGroupId';
import type { DashboardCircle } from './CounsellorDashboard';

/** "Do., 30. Okt. · 19:00" in the counsellor's language. */
export const formatCircleWhen = (date: Date, uiLocale: string) => {
	// 'de@informal' is no BCP-47 tag; Intl would throw.
	const locale = uiLocale.split('@')[0];
	const day = new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	}).format(date);
	const time = new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit'
	}).format(date);
	return `${day} · ${time}`;
};

const pad = (value: number) => String(value).padStart(2, '0');

/** The local calendar day, as the statistics endpoint expects it. */
const localIsoDate = (date: Date) =>
	`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** "Letzte 30 Tage", as the tile says: today and the 29 days before. */
export const last30Days = (today = new Date()) => {
	const start = new Date(today);
	start.setDate(start.getDate() - 29);
	return { startDate: localIsoDate(start), endDate: localIsoDate(today) };
};

const mediumOf = (modality: string | undefined): DashboardCircle['medium'] =>
	modality === 'VIDEO' ? 'VIDEO' : modality === 'AUDIO' ? 'AUDIO' : 'CHAT';

/**
 * The counsellor's self-help circles (Gesprächskreise) with a date still
 * ahead, soonest first, read from her own conversation list. A circle that
 * is running right now still counts; its date is the one it runs on.
 */
export const upcomingCirclesFrom = (
	sessions: ListItemInterface[],
	locale: string,
	now = new Date(),
	limit = 3
): DashboardCircle[] =>
	sessions
		.flatMap((item) => {
			const chat = item.chat;
			if (!chat || !isSelfHelp(chat)) return [];
			const durationMs = (chat.duration ?? 0) * 60_000;
			const next = (getGroupUpcomingDates(chat) ?? []).find(
				(date) => date.getTime() + durationMs > now.getTime()
			);
			if (!next) return [];
			return [
				{
					circle: {
						id: String(chat.id),
						topic: chat.topic,
						when: formatCircleWhen(next, locale),
						medium: mediumOf(chat.modality),
						participants: chat.participants?.length ?? 0
					},
					at: next.getTime()
				}
			];
		})
		.sort((a, b) => a.at - b.at)
		.slice(0, limit)
		.map(({ circle }) => circle);

/** Same rule as the profile's statistics page: off only where the Träger says so. */
export const statisticsEnabled = (tenant: TenantDataInterface | null) =>
	tenant === null || Boolean(tenant.settings?.featureStatisticsEnabled);
