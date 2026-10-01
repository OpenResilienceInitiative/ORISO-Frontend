import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/** Local Storybook fixture only: no account, mail or Dev backend is used. */
test('counsellor self-help footer selects the saved appointment preference', async ({
	page
}) => {
	await page.goto(
		'/iframe.html?id=organisms-emailnotificationsettings--counsellor-appointment-preference&viewMode=story'
	);
	const row = page.locator('[data-cy="notification-switch-appointment"]');
	const toggle = row.getByRole('switch');
	await expect(row).toHaveClass(/notifications__row--highlighted/);
	await expect(toggle).toBeChecked();
	await expect(page.getByRole('switch')).toHaveCount(9);
	const evidence = process.env.ORISO_LOCAL_EVIDENCE_DIR;
	if (evidence) {
		mkdirSync(evidence, { recursive: true });
		await page.screenshot({
			path: join(
				evidence,
				'01-local-counsellor-appointments-enabled.png'
			),
			fullPage: true
		});
	}
	// The visible switch track covers the visually hidden native checkbox.
	await row.locator('label').click();
	await expect
		.poll(async () =>
			page.evaluate(
				() =>
					JSON.parse(
						sessionStorage.getItem(
							'storybook.selfhelp.appointment.preference'
						) || 'null'
					)?.emailNotifications.settings
						.appointmentNotificationEnabled
			)
		)
		.toBe(false);
	await page.reload();
	await expect(toggle).not.toBeChecked();
	await expect(row).toHaveClass(/notifications__row--highlighted/);
	if (evidence) {
		await page.screenshot({
			path: join(
				evidence,
				'02-local-counsellor-appointments-saved-disabled.png'
			),
			fullPage: true
		});
	}
	await toggle.focus();
	await expect(toggle).toBeFocused();
	await toggle.press('Space');
	await expect
		.poll(async () =>
			page.evaluate(
				() =>
					JSON.parse(
						sessionStorage.getItem(
							'storybook.selfhelp.appointment.preference'
						) || 'null'
					)?.emailNotifications.settings
						.appointmentNotificationEnabled
			)
		)
		.toBe(true);
});
