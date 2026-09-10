import { expect, test, BrowserContext, Page } from '@playwright/test';
import {
	actor,
	assertLoginRejected,
	conversationMessage,
	login,
	passwordReady,
	phase,
	required,
	screenshots,
	sendMessage,
	waitForRecoveryStartup
} from './recovery-fixtures';

type Settings = { asker: string; consultant: string; revision: number };
const settingResponse =
	(method: string) => (response: import('@playwright/test').Response) =>
		response.request().method() === method &&
		new URL(response.url()).pathname.endsWith('/controls/chat-recovery');

async function readSettings(page: Page): Promise<Settings> {
	phase('Admin settings read started');
	const [readback] = await Promise.all([
		page.waitForResponse(settingResponse('GET'), { timeout: 30_000 }),
		page.goto(
			`${required('ORISO_ADMIN_BASE_URL').replace(/\/$/, '')}/theme-settings/global-config`
		)
	]);
	expect(readback.status()).toBe(200);
	phase('Admin settings read completed');
	return readback.json();
}

async function saveSettings(
	page: Page,
	desired: Pick<Settings, 'asker' | 'consultant'>
) {
	phase('Admin settings edit started');
	const form = page.locator('form').filter({
		has: page.getByText('Diese Einstellung gilt für alle Beratungsarten.', {
			exact: true
		})
	});
	// CardEditable renders footer actions next to the Form in the card container.
	const card = form.locator('..');
	await card.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
	for (const [label, mode] of [
		['Ratsuchende', desired.asker],
		['Berater:innen', desired.consultant]
	]) {
		await form.getByRole('combobox', { name: label }).click();
		await page
			.getByRole('option', {
				name:
					mode === 'LOGIN_PASSWORD'
						? 'Anmeldepasswort'
						: 'Wiederherstellungsschlüssel',
				exact: true
			})
			.click();
	}
	phase('Admin settings save started');
	const [response] = await Promise.all([
		page.waitForResponse(settingResponse('PUT'), { timeout: 30_000 }),
		card.getByRole('button', { name: 'Speichern', exact: true }).click()
	]);
	expect(response.status()).toBe(200);
	phase('Admin settings save acknowledged');
	const confirmed = await readSettings(page);
	expect(confirmed).toMatchObject({
		asker: desired.asker,
		consultant: desired.consultant
	});
	for (const [label, mode] of [
		['Ratsuchende', desired.asker],
		['Berater:innen', desired.consultant]
	]) {
		await expect(form.getByRole('combobox', { name: label })).toHaveValue(
			mode === 'LOGIN_PASSWORD'
				? 'Anmeldepasswort'
				: 'Wiederherstellungsschlüssel'
		);
	}
	phase('Admin settings save and UI readback completed');
	return confirmed;
}

test('platform defaults persist independently and borrowed values are restored', async ({
	browser
}, testInfo) => {
	required('ORISO_RECOVERY_ALLOW_SETTINGS_ROUNDTRIP');
	const context = await browser.newContext({ locale: 'de-DE' });
	const page = await context.newPage();
	let original: Settings | undefined;
	try {
		await login(
			page,
			required('ORISO_RECOVERY_ADMIN_RECORD'),
			required('ORISO_RECOVERY_ADMIN_USERNAME'),
			true
		);
		original = await readSettings(page);
		await saveSettings(page, {
			asker: 'LOGIN_PASSWORD',
			consultant: 'LOGIN_PASSWORD'
		});
		await screenshots(page, testInfo, 'admin-password-defaults');
		await saveSettings(page, {
			asker: 'LOGIN_PASSWORD',
			consultant: 'RECOVERY_KEY'
		});
		await screenshots(page, testInfo, 'admin-mixed-defaults');
	} finally {
		try {
			if (original) {
				phase('Admin original settings restoration started');
				// Discard an unfinished inline edit before restoring confirmed values.
				await readSettings(page);
				await saveSettings(page, original);
				phase('Admin original settings restoration completed');
			}
		} finally {
			await context.close();
		}
	}
});

test('fresh asker and consultant restore encrypted history with every original peer offline', async ({
	browser
}, testInfo) => {
	const asker = actor(testInfo.project.name, 'ASKER');
	const consultant = actor(testInfo.project.name, 'CONSULTANT');
	const stamp = `${testInfo.project.name}-${Date.now()}`;
	const messages = [
		`Recovery synthetic asker ${stamp}`,
		`Recovery synthetic consultant ${stamp}`
	];
	const contexts = new Set<BrowserContext>();
	const newDevice = async () => {
		// No storageState, persistent profile, key injection or device transfer.
		const context = await browser.newContext({ locale: 'de-DE' });
		contexts.add(context);
		return context;
	};
	const closeDevice = async (context: BrowserContext) => {
		await context.close();
		contexts.delete(context);
	};
	try {
		const originalAsker = await newDevice();
		const originalConsultant = await newDevice();
		const askerPage = await originalAsker.newPage();
		const consultantPage = await originalConsultant.newPage();
		const sentSessions = new Map<Page, Set<string>>();
		const backedUpSessions = new Map<Page, Set<string>>();
		const encryptedSends = new Set<Page>();
		for (const page of [askerPage, consultantPage]) {
			sentSessions.set(page, new Set());
			backedUpSessions.set(page, new Set());
			page.on('response', (response) => {
				if (!response.ok() || response.request().method() !== 'PUT')
					return;
				try {
					const path = new URL(response.url()).pathname;
					const send = path.match(
						/\/rooms\/([^/]+)\/send\/m\.room\.encrypted\//
					);
					if (send) {
						// Parse in memory only. Keep room/session identifiers, never ciphertext.
						const body = response.request().postDataJSON();
						if (
							typeof body?.session_id === 'string' &&
							body.session_id
						) {
							sentSessions
								.get(page)
								.add(
									JSON.stringify([
										decodeURIComponent(send[1]),
										body.session_id
									])
								);
							encryptedSends.add(page);
						}
					}
					const backup = path.match(
						/\/room_keys\/keys(?:\/([^/]+)(?:\/([^/]+))?)?$/
					);
					if (backup) {
						const addPair = (room: string, session: string) =>
							backedUpSessions
								.get(page)
								.add(JSON.stringify([room, session]));
						if (backup[1] && backup[2]) {
							addPair(
								decodeURIComponent(backup[1]),
								decodeURIComponent(backup[2])
							);
						} else {
							const body = response.request().postDataJSON();
							if (backup[1]) {
								for (const session of Object.keys(
									body?.sessions || {}
								))
									addPair(
										decodeURIComponent(backup[1]),
										session
									);
							} else {
								for (const room of Object.keys(
									body?.rooms || {}
								)) {
									for (const session of Object.keys(
										body.rooms[room]?.sessions || {}
									))
										addPair(room, session);
								}
							}
						}
					}
				} catch {
					// Missing/malformed evidence fails the later correlation assertion.
					// Never emit parser errors: they may contain request body fragments.
				}
			});
		}

		await login(askerPage, asker.record, asker.username);
		await waitForRecoveryStartup(askerPage, asker, 'asker');
		await passwordReady(askerPage);
		await login(consultantPage, consultant.record, consultant.username);
		await waitForRecoveryStartup(consultantPage, consultant, 'consultant');
		await passwordReady(consultantPage);
		await askerPage.goto(asker.conversationURL);
		await consultantPage.goto(consultant.conversationURL);
		await sendMessage(askerPage, messages[0]);
		await expect(
			conversationMessage(consultantPage, messages[0])
		).toBeVisible();
		await sendMessage(consultantPage, messages[1]);
		await expect(conversationMessage(askerPage, messages[1])).toBeVisible();
		await expect
			.poll(() => encryptedSends.size, {
				message: 'Both sends must use Matrix encrypted events'
			})
			.toBe(2);

		// Configuration status alone is insufficient. This matches each sent room/session to a successful backup ACK;
		// the definitive key-availability assertion is the offline restore below.
		await expect
			.poll(
				() =>
					[askerPage, consultantPage].filter((page) => {
						const targets = sentSessions.get(page);
						return (
							targets.size > 0 &&
							[...targets].every((pair) =>
								backedUpSessions.get(page).has(pair)
							)
						);
					}).length,
				{
					timeout: 60_000,
					message:
						'Each sender must back up the exact room/session used by its encrypted message before closing originals'
				}
			)
			.toBe(2);
		await screenshots(
			askerPage,
			testInfo,
			'original-encrypted-exchange',
			messages
		);
		await closeDevice(originalAsker);
		await closeDevice(originalConsultant);
		expect(contexts.size).toBe(0);
		for (const [role, account] of [
			['asker', asker],
			['consultant', consultant]
		] as const) {
			// Even the first restored device is closed before the second is created.
			expect(contexts.size).toBe(0);
			const fresh = await newDevice();
			const page = await fresh.newPage();
			await login(page, account.record, account.username);
			await waitForRecoveryStartup(page, account, role);
			phase(`Fresh ${role} password recovery completion check started`);
			await passwordReady(page);
			phase(
				`Fresh ${role} password recovery completed; opening conversation`
			);
			await page.goto(account.conversationURL);
			phase(`Fresh ${role} conversation loaded; checking prior history`);
			for (const message of messages)
				await expect(conversationMessage(page, message)).toBeVisible();
			await screenshots(
				page,
				testInfo,
				`fresh-${role}-history-peers-offline`,
				messages
			);
			await closeDevice(fresh);
		}
		await testInfo.attach('acceptance-boundary', {
			body: JSON.stringify({
				engine: testInfo.project.name,
				actors: [asker.username, consultant.username],
				messages,
				originalsClosedBeforeFreshDevices: true,
				credentialPath: 'normal password + mandatory OTP',
				scope: 'existing dedicated conversation; fresh devices; engine emulation, not physical device'
			}),
			contentType: 'application/json'
		});
	} finally {
		await Promise.all([...contexts].map((context) => context.close()));
	}
});

test('negative gate: wrong password cannot unlock asker history', async ({
	browser
}, testInfo) => {
	const context = await browser.newContext({ locale: 'de-DE' });
	try {
		await assertLoginRejected(
			await context.newPage(),
			testInfo,
			{
				record: required('ORISO_RECOVERY_NEGATIVE_ASKER_RECORD'),
				username: required('ORISO_RECOVERY_NEGATIVE_ASKER_USERNAME')
			},
			'wrong-password'
		);
	} finally {
		await context.close();
	}
});

test('negative gate: missing and wrong OTP cannot unlock consultant history', async ({
	browser
}, testInfo) => {
	const context = await browser.newContext({ locale: 'de-DE' });
	try {
		await assertLoginRejected(
			await context.newPage(),
			testInfo,
			{
				record: required('ORISO_RECOVERY_NEGATIVE_CONSULTANT_RECORD'),
				username: required(
					'ORISO_RECOVERY_NEGATIVE_CONSULTANT_USERNAME'
				)
			},
			'missing-and-wrong-otp'
		);
	} finally {
		await context.close();
	}
});
