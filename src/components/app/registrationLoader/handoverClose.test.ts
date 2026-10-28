import { describe, expect, it } from 'vite-plus/test';
import { canCloseHandover } from './handoverClose';

describe('canCloseHandover', () => {
	it('waits for the click, the app and a pending group assignment', () => {
		const ready = { entered: true, appReady: true, groupJoinSettled: true };
		expect(canCloseHandover(ready)).toBe(true);
		expect(canCloseHandover({ ...ready, entered: false })).toBe(false);
		expect(canCloseHandover({ ...ready, appReady: false })).toBe(false);
		// The slow gate can be clicked while ?gcid= is still being assigned;
		// closing then would show the app's route before the group's room.
		expect(canCloseHandover({ ...ready, groupJoinSettled: false })).toBe(
			false
		);
	});
});
