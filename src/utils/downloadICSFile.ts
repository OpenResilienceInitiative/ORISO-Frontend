/**
 * Trigger a browser download of an already-built iCalendar document.
 *
 * Kept separate from `buildAppointmentIcs` so the ICS generation stays pure and
 * unit-testable while this thin helper owns the DOM side effect.
 */
export const downloadICSFile = (filename: string, icsMSG: string) => {
	// Sanitize the filename so slashes / illegal characters can't break the
	// download (the title is user-facing text).
	const safeName =
		filename.replace(/[^\p{L}\p{N}\-_ ]+/gu, '_').trim() || 'appointment';

	const blob = new Blob([icsMSG], { type: 'text/calendar;charset=utf-8' });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.download = `${safeName}.ics`;
	link.href = url;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	// Release the object URL on the next tick so the click has been handled.
	setTimeout(() => URL.revokeObjectURL(url), 0);
};
