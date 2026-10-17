export interface AppointmentData {
	title: string;
	date: string;
	duration: number;
	location: string;
	note?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

// The appointment contract carries an ISO instant. Never infer a timezone
// from the viewer's browser for a legacy or malformed payload.
const ISO_INSTANT =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i;

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
		!ISO_INSTANT.test(value.date) ||
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
