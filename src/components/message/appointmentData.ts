export interface AppointmentData {
	title: string;
	date: string;
	duration: number;
	location: string;
	note?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseAppointmentData = (data: string): AppointmentData | null => {
	let value: unknown;
	try {
		value = JSON.parse(data);
	} catch {
		return null;
	}

	if (
		!isRecord(value) ||
		typeof value.title !== 'string' ||
		value.title.trim().length === 0 ||
		typeof value.date !== 'string' ||
		Number.isNaN(new Date(value.date).getTime()) ||
		typeof value.duration !== 'number' ||
		!Number.isFinite(value.duration) ||
		value.duration <= 0 ||
		Number.isNaN(
			new Date(
				new Date(value.date).getTime() + value.duration * 60 * 1000
			).getTime()
		) ||
		typeof value.location !== 'string' ||
		(value.note !== undefined && typeof value.note !== 'string')
	) {
		return null;
	}

	const appointment: AppointmentData = {
		title: value.title,
		date: value.date,
		duration: value.duration,
		location: value.location
	};
	if (typeof value.note === 'string') {
		appointment.note = value.note;
	}
	return appointment;
};
