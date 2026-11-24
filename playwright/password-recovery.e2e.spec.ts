import { expect, test, BrowserContext, Page } from '@playwright/test';
import {
	actor,
	assertLoginRejected,
	login,
	passwordReady,
	phase,
	required,
	screenshots,
	sendMessage,
	waitForRecoveryStartup
} from './recovery-fixtures';
import {
	hasExactRecoveryEvent,
	readEncryptedSendReceipt,
	type EncryptedSendReceipt
} from './recovery-event-witness';

const backupKey = ({
	homeserverOrigin,
	roomId,
	sessionId
}: Omit<EncryptedSendReceipt, 'eventId'>) =>
	JSON.stringify([homeserverOrigin, roomId, sessionId]);

async function receiptForMessage(
	page: Page,
	marker: string,
	receipts: Map<string, EncryptedSendReceipt>
) {
	let verified: EncryptedSendReceipt | undefined;
	await expect
		.poll(
			async () => {
				const matching: EncryptedSendReceipt[] = [];
				for (const receipt of receipts.values()) {
					if (
						await hasExactRecoveryEvent(
							page,
							receipt.eventId,
							marker
						)
					) {
						matching.push(receipt);
					}
				}
				verified = matching.length === 1 ? matching[0] : undefined;
				return Boolean(verified);
			},
			{
				message:
					'Expected one confirmed encrypted Matrix event for the sent marker'
			}
		)
		.toBe(true);
	if (!verified) throw new Error('Missing encrypted recovery witness');
	return { ...verified, marker };
}

type Settings = { asker: string; consultant: string; revision: number };
const settingResponse =
	(method: string) => (response: import('@playwright/test').Response) =>
		response.request().method() === method &&
		new URL(response.url()).pathname.endsWith('/controls/chat-recovery');

async function readSettings(page: Page): Promise<Settings> {
	phase('Admin settings read started');
	// Login waits for the tenant-list content before this document navigation.
	// A new document guarantees a fresh query client for server readback;
	// an SPA return did not issue a GET in the observed WebKit roundtrip.
	const [readback] = await Promise.all([
		page.waitForResponse(settingResponse('GET'), { timeout: 30_000 }),
		page.goto(
			`${required('ORISO_ADMIN_BASE_URL').replace(/\/$/, '')}/theme-settings/global-config`
		)
	]);
	expect(readback.status()).toBe(200);
	await expect(page).toHaveURL(/\/admin\/theme-settings\/global-config\/?$/);
	await expect(
		page.getByRole('heading', {
			name: 'Chat-Wiederherstellung für neue Konten',
			exact: true
		})
	).toBeVisible();
	const value = await readback.json();
	const modes = ['LOGIN_PASSWORD', 'RECOVERY_KEY'];
	if (
		!value ||
		!modes.includes(value.asker) ||
		!modes.includes(value.consultant) ||
		!Number.isSafeInteger(value.revision) ||
		value.revision < 0
	) {
		throw new Error('Unexpected recovery settings readback shape');
	}
	phase('Admin settings read completed');
	return {
		asker: value.asker,
		consultant: value.consultant,
		revision: value.revision
	};
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
				const restored = await saveSettings(page, original);
				expect(restored.revision).toBeGreaterThanOrEqual(
					original.revision
				);
				await testInfo.attach('admin-settings-restored-readback', {
					contentType: 'application/json',
					body: Buffer.from(
						JSON.stringify(
							{
								original,
								restored,
								readbackStatus: 200
							},
							null,
							2
						)
					)
				});
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
		const senders = {
			asker: {
				page: askerPage,
				events: new Map<string, EncryptedSendReceipt>(),
				backups: new Set<string>()
			},
			consultant: {
				page: consultantPage,
				events: new Map<string, EncryptedSendReceipt>(),
				backups: new Set<string>()
			}
		};
		for (const { page, events, backups } of Object.values(senders)) {
			page.on('response', async (response) => {
				if (!response.ok() || response.request().method() !== 'PUT')
					return;
				try {
					const receipt = await readEncryptedSendReceipt(response);
					if (receipt) events.set(receipt.eventId, receipt);
					const url = new URL(response.url());
					const backup = url.pathname.match(
						/\/_matrix\/client\/v3\/room_keys\/keys(?:\/([^/]+)(?:\/([^/]+))?)?$/
					);
					if (backup && url.searchParams.get('version')) {
						const addPair = (roomId: string, sessionId: string) =>
							backups.add(
								backupKey({
									homeserverOrigin: url.origin,
									roomId,
									sessionId
								})
							);
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
		const askerSent = await receiptForMessage(
			consultantPage,
			messages[0],
			senders.asker.events
		);
		await sendMessage(consultantPage, messages[1]);
		const consultantSent = await receiptForMessage(
			askerPage,
			messages[1],
			senders.consultant.events
		);
		expect(
			askerSent.homeserverOrigin === consultantSent.homeserverOrigin &&
				askerSent.roomId === consultantSent.roomId &&
				askerSent.eventId !== consultantSent.eventId,
			'Expected two confirmed encrypted events in the same Matrix room'
		).toBe(true);
		const verifyHistory = async (page: Page) => {
			for (const { eventId, marker } of [askerSent, consultantSent]) {
				await expect
					.poll(() => hasExactRecoveryEvent(page, eventId, marker), {
						message:
							'Expected the exact encrypted event body in the recovery timeline'
					})
					.toBe(true);
			}
		};
		await Promise.all([
			verifyHistory(askerPage),
			verifyHistory(consultantPage)
		]);

		// Configuration status alone is insufficient. This matches each sent room/session to a successful backup ACK;
		// the definitive key-availability assertion is the offline restore below.
		await expect
			.poll(
				() =>
					senders.asker.backups.has(backupKey(askerSent)) &&
					senders.consultant.backups.has(backupKey(consultantSent)),
				{
					timeout: 60_000,
					message:
						'Each sender must back up the exact room/session used by its encrypted message before closing originals'
				}
			)
			.toBe(true);
		await screenshots(
			askerPage,
			testInfo,
			'original-encrypted-exchange',
			messages,
			() => verifyHistory(askerPage)
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
			await verifyHistory(page);
			await screenshots(
				page,
				testInfo,
				`fresh-${role}-history-peers-offline`,
				messages,
				() => verifyHistory(page)
			);
			await closeDevice(fresh);
		}
		await testInfo.attach('acceptance-boundary', {
			body: JSON.stringify({
				engine: testInfo.project.name,
				actors: [asker.username, consultant.username],
				messages,
				originalsClosedBeforeFreshDevices: true,
				exactEncryptedEventReadback: true,
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
