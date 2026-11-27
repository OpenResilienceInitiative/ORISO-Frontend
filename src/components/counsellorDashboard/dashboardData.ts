import type { TenantDataInterface } from '../../globalState/interfaces';

const pad = (value: number) => String(value).padStart(2, '0');

/** The local calendar day, as the statistics endpoint expects it. */
const localIsoDate = (date: Date) =>
	`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** "30 Tage", as the figure says: today and the 29 days before. */
export const last30Days = (today = new Date()) => {
	const start = new Date(today);
	start.setDate(start.getDate() - 29);
	return { startDate: localIsoDate(start), endDate: localIsoDate(today) };
};

/** Same rule as the profile's statistics page: off only where the Träger says so. */
export const statisticsEnabled = (tenant: TenantDataInterface | null) =>
	tenant === null || Boolean(tenant.settings?.featureStatisticsEnabled);
