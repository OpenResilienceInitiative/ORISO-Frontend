/**
 * Regular Live-Chat opening hours shown in the "no availability" modal
 * dropdown. `dayKey` is used to look up a translated weekday label while the
 * German name is the fallback. Times are static schedule data.
 */
export const LIVE_CHAT_OPENING_HOURS: Array<{
	dayKey: string;
	day: string;
	time: string;
}> = [
	{ dayKey: 'monday', day: 'Montag', time: '09:00 - 12:00' },
	{ dayKey: 'monday', day: 'Montag', time: '13:00 - 17:00' },
	{ dayKey: 'tuesday', day: 'Dienstag', time: '09:00 - 10:30' },
	{ dayKey: 'wednesday', day: 'Mittwoch', time: '09:00 - 12:00' },
	{ dayKey: 'thursday', day: 'Donnerstag', time: '09:00 - 12:00' },
	{ dayKey: 'friday', day: 'Freitag', time: '09:00 - 11:30' }
];
