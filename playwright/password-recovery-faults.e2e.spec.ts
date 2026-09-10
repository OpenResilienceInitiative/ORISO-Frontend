import { execFileSync } from 'node:child_process';
import { expect, Page, TestInfo, test } from '@playwright/test';
import { passwordReady, required } from './recovery-fixtures';

type Actor = { record: string; username: string; email: string };
const fixture = (label: string, engine: string): Actor => {
	// WebKit creation fixtures must never fall back to already-consumed Chromium accounts.
	const prefix =
		engine === 'webkit'
			? `ORISO_FAULT_WEBKIT_${label}`
			: `ORISO_FAULT_${label}`;
	return {
		record: required(`${prefix}_RECORD`),
		username: required(`${prefix}_USERNAME`),
		email: required(`${prefix}_EMAIL`)
	};
};
const pathOf = (url: string) => new URL(url).pathname;
const finalize = (url: string) =>
	/\/service\/users\/sessions\/\d+\/enquiry\/new$/.test(pathOf(url));
const reminder = (page: Page) =>
	page.locator('[data-cy="recovery-key-save-reminder"]');
const editor = (page: Page) =>
	page.locator('.ProseMirror[contenteditable="true"]');
const success = (page: Page) =>
	page.getByText('Vielen Dank für Ihre Nachricht!', { exact: true });
const problem = (page: Page) =>
	page.getByText('Beim Senden der Nachricht ist ein Fehler aufgetreten', {
		exact: true
	});
let phase = 'not started';
function mark(value: string) {
	phase = value;
	console.log(`[recovery-fault] ${value}`);
}
function access(args: string[]): string {
	try {
		return execFileSync(
			process.env.ORISO_TEST_ACCESS_BIN || 'test-access',
			[
				'--identity',
				process.env.ORISO_TEST_ACCESS_IDENTITY || 'codex-m4-oriso',
				...args
			],
			{
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
				timeout: 30000
			}
		).trim();
	} catch {
		throw new Error(
			'Test Access operation failed; sensitive diagnostics suppressed'
		);
	}
}
async function shot(page: Page, info: TestInfo, name: string) {
	const file = info.outputPath(`${name}.png`);
	await page.screenshot({
		path: file,
		animations: 'disabled',
		mask: [
			page.locator(
				'input,textarea,code,pre,[contenteditable="true"],[data-cy="optional-recovery-key"],[data-cy="recovery-key-display"],.twoFactorSetupDialog__secret,.twoFactorSetupDialog__qr'
			)
		]
	});
	await info.attach(name, { path: file, contentType: 'image/png' });
}
async function signup(page: Page, actor: Actor, info: TestInfo) {
	const revisionInput = required('ORISO_FAULT_EXPECTED_POLICY_REVISION');
	const expectedRevision = Number(revisionInput);
	if (
		!/^\d+$/.test(revisionInput) ||
		!Number.isSafeInteger(expectedRevision)
	) {
		throw new Error(
			'ORISO_FAULT_EXPECTED_POLICY_REVISION must be a nonnegative safe integer'
		);
	}
	mark(`Registering ${actor.username}`);
	await page.goto(`${required('PLAYWRIGHT_BASE_URL')}/registration?tid=10`);
	// Follow the actual public registration stages; no session/crypto injection.
	const topic = page
		.locator('[data-cy^="topic-selection-radio-"]')
		.filter({ hasText: 'Eltern und Familie' });
	const zipcode = page.locator('[data-cy="zipcode-digit-1"]');
	await expect(topic.or(zipcode)).toBeVisible();
	if (await topic.isVisible()) {
		await topic.click();
		await page.locator('[data-cy="button-next"]').click();
	}
	mark(`Registration postcode for ${actor.username}`);
	await page.locator('[data-cy="zipcode-digit-1"]').fill('10965');
	await page.locator('[data-cy="button-next"]').click();
	await page.locator('[data-cy="agency-selection-radio-12"]').click();
	await page.locator('[data-cy="button-next"]').click();
	let password: string | undefined = access(['get', actor.record]);
	try {
		await page
			.getByRole('textbox', { name: 'User-ID', exact: true })
			.fill(actor.username);
		await page.getByLabel('Passwort', { exact: true }).fill(password);
		await page
			.getByLabel('Passwort wiederholen', { exact: true })
			.fill(password);
	} finally {
		password = undefined;
	}
	await page.getByRole('checkbox').check();
	const registration = page.waitForResponse(
		(r) =>
			r.request().method() === 'POST' &&
			pathOf(r.url()).endsWith('/service/users/askers/new')
	);
	const userDataResponse = page.waitForResponse(
		(r) => r.ok() && pathOf(r.url()).endsWith('/service/users/data')
	);
	await page.locator('[data-cy="button-register"]').click();
	expect((await registration).status()).toBe(201);
	access([
		'sync',
		actor.record,
		'--version',
		'2.0.3',
		'--status',
		'active',
		'--topics',
		'Eltern und Familie',
		'--note',
		`Created through PreDev public registration; ${actor.username}; password-recovery fault/isolation fixture. Product email not yet bound; scoped pool identity ${actor.email}.`
	]);
	await info.attach(`created-${actor.username}`, {
		body: JSON.stringify({
			username: actor.username,
			email: actor.email,
			record: actor.record,
			status: 201
		}),
		contentType: 'application/json'
	});
	mark(
		`Registration201 and Test Access metadata synced for ${actor.username}`
	);
	await page
		.getByRole('button', { name: 'Anfrage schreiben', exact: true })
		.click();
	const data = await (await userDataResponse).json();
	expect(data.chatRecoveryMode).toBe('LOGIN_PASSWORD');
	expect(data.chatRecoveryPolicyRevision).toBe(expectedRevision);
	await info.attach(`policy-${actor.username}`, {
		body: JSON.stringify({
			mode: data.chatRecoveryMode,
			revision: data.chatRecoveryPolicyRevision
		}),
		contentType: 'application/json'
	});
	await expect(editor(page)).toBeVisible();
	await expect(page.locator('[data-cy="optional-recovery-key"]')).toHaveCount(
		0
	);
	await expect(reminder(page)).toHaveCount(0);
}
async function loginExisting(page: Page, actor: Actor) {
	mark(`Normal login existing ${actor.username}`);
	await page.goto(required('PLAYWRIGHT_BASE_URL'));
	let password: string | undefined = access(['get', actor.record]);
	try {
		await page.locator('#passwordInput').fill(password);
	} finally {
		password = undefined;
	}
	await page.locator('#username').fill(actor.username);
	await page.getByRole('button', { name: /^(Anmelden|Sign in)$/ }).click();
	await expect(editor(page)).toBeVisible();
	await expect(reminder(page)).toHaveCount(0);
}
async function bindEmail(page: Page, actor: Actor) {
	const previous = page.url();
	await page.getByRole('tab', { name: 'Mein Profil', exact: true }).click();
	const email = page.locator('[id="E-Mail-Adresse"]');
	await expect(email).toBeVisible();
	await page
		.locator('.editableData')
		.filter({ has: email })
		.locator('.editableData__inputButton--singleEdit')
		.click();
	await email.fill(actor.email);
	await page.getByRole('button', { name: 'Speichern', exact: true }).click();
	await expect(email).toBeDisabled();
	await expect(email).toHaveValue(actor.email);
	access([
		'sync',
		actor.record,
		'--version',
		'2.0.3',
		'--status',
		'active',
		'--topics',
		'Eltern und Familie',
		'--note',
		`Public signup and profile email readback complete; ${actor.username}; password-recovery fault/isolation fixture.`
	]);
	await page.goto(previous);
	mark(`Exact pool email bound and read back for ${actor.username}`);
}
async function submit(page: Page, text: string) {
	await editor(page).fill(text);
	await page.locator('button.sendButton').click();
}
async function failureEvidence(page: Page, info: TestInfo) {
	try {
		await shot(page, info, 'failure-masked');
		await info.attach('failure-phase', {
			body: JSON.stringify({
				phase,
				path: pathOf(page.url()),
				registrationStep: await page
					.locator('[data-cy="registration-form"]')
					.getAttribute('data-cy-step')
					.catch(() => null),
				reminders: await reminder(page).count()
			}),
			contentType: 'application/json'
		});
	} catch {
		/* Preserve the original sanitized failure without DOM snapshots. */
	}
}

test('failed finalization does not announce success and real retry sends no duplicate', async ({
	browser
}, info) => {
	const a = fixture('A', info.project.name);
	const context = await browser.newContext({
		locale: 'de-DE',
		viewport: { width: 1440, height: 900 }
	});
	const page = await context.newPage();
	page.setDefaultTimeout(30000);
	let failNext = true,
		failed = 0,
		sent = 0;
	await page.route(
		(url) => finalize(url.toString()),
		async (route) => {
			if (route.request().method() === 'POST' && failNext) {
				failNext = false;
				failed++;
				await route.fulfill({
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify({
						message: 'Synthetic finalization outage'
					})
				});
			} else await route.continue();
		}
	);
	page.on('response', (r) => {
		if (
			r.ok() &&
			r.request().method() === 'PUT' &&
			/\/send\/m\.room\.encrypted\//.test(pathOf(r.url()))
		)
			sent++;
	});
	try {
		if (
			process.env[
				info.project.name === 'webkit'
					? 'ORISO_FAULT_WEBKIT_A_EXISTING'
					: 'ORISO_FAULT_A_EXISTING'
			] === '1'
		)
			await loginExisting(page, a);
		else await signup(page, a, info);
		const marker = `Fault finalization ${Date.now()}`;
		mark('Injecting one finalization503 after encrypted send');
		await submit(page, marker);
		await expect(problem(page)).toBeVisible();
		expect(failed).toBe(1);
		expect(sent).toBe(1);
		await expect(editor(page)).toContainText(marker);
		await expect(success(page)).toHaveCount(0);
		await expect(reminder(page)).toHaveCount(0);
		await shot(page, info, 'asker-finalization-rejected-no-success');
		mark('Retrying through real finalization endpoint');
		const acknowledged = page.waitForResponse(
			(r) =>
				finalize(r.url()) &&
				r.request().method() === 'POST' &&
				r.status() === 201
		);
		await page.locator('button.sendButton').click();
		await acknowledged;
		expect(sent).toBe(1);
		await expect(editor(page)).toBeEmpty();
		await expect(problem(page)).toHaveCount(0);
		await info.attach('finalization-fault-result', {
			body: JSON.stringify({
				failedFinalizations: failed,
				encryptedSends: sent,
				realRetryFinalization: 201,
				noPrematureSuccess: true,
				noPrematureReminder: true
			}),
			contentType: 'application/json'
		});
		await bindEmail(page, a);
	} catch {
		await failureEvidence(page, info);
		throw new Error(
			`Fault/isolation browser gate failed during: ${phase}; sensitive diagnostics suppressed`
		);
	} finally {
		await context.close();
	}
});

test('same-context logout isolates pending key and reminder between identities', async ({
	browser
}, info) => {
	const source = fixture('C', info.project.name),
		target = fixture('A', info.project.name);
	const context = await browser.newContext({
		locale: 'de-DE',
		viewport: { width: 1440, height: 900 }
	});
	const page = await context.newPage();
	page.setDefaultTimeout(30000);
	let sourceKey: string | null = null;
	try {
		await signup(page, source, info);
		const finalized = page.waitForResponse(
			(r) => finalize(r.url()) && r.status() === 201
		);
		await submit(page, `Identity isolation ${Date.now()}`);
		await finalized;
		await expect(reminder(page)).toBeVisible();
		await expect(success(page)).not.toBeVisible();
		await bindEmail(page, source);
		await reminder(page)
			.getByRole('button', { name: 'Schlüssel anzeigen', exact: true })
			.click();
		const displayed = page.locator('[data-cy="optional-recovery-key"]');
		await expect(displayed).toBeVisible();
		sourceKey = await displayed.textContent();
		await shot(page, info, 'source-C-key-masked-before-logout');
		mark('Normal UI logout C then normal password login A in SAME context');
		await page.locator('.navigation__item--nav-logout').click();
		await expect(page.locator('#username')).toBeVisible();
		await loginExisting(page, target);
		await expect(reminder(page)).toHaveCount(0);
		await expect(displayed).toHaveCount(0);
		expect(
			await page
				.locator('body')
				.evaluate(
					(node, key) => !!key && node.textContent?.includes(key),
					sourceKey
				)
		).toBe(false);
		sourceKey = null;
		await passwordReady(page);
		await expect(reminder(page)).toHaveCount(0);
		await expect(displayed).toHaveCount(0);
		await shot(page, info, 'target-A-own-password-ready-no-C-key-reminder');
		await bindEmail(page, target);
		await info.attach('identity-isolation-result', {
			body: JSON.stringify({
				sameBrowserContext: true,
				source: source.username,
				target: target.username,
				normalLogout: true,
				targetPasswordRecoveryReady: true,
				sourceKeyVisible: false,
				sourceReminderVisible: false
			}),
			contentType: 'application/json'
		});
	} catch {
		await failureEvidence(page, info);
		throw new Error(
			`Identity isolation failed during ${phase}; sensitive diagnostics suppressed`
		);
	} finally {
		sourceKey = null;
		await context.close();
	}
});

test('backup fails after successful enquiry and status stays truthful', async ({
	browser
}, info) => {
	const b = fixture('B', info.project.name);
	const context = await browser.newContext({
		locale: 'de-DE',
		viewport: { width: 1440, height: 900 }
	});
	const page = await context.newPage();
	page.setDefaultTimeout(30000);
	let release: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	let held = 0,
		failed = 0,
		completed = false;
	// Only failure is injected. The real encrypted-send and enquiry finalization
	// endpoints remain untouched. Registration creates the first authenticated client.
	await page.route(
		(url) =>
			/\/_matrix\/client\/[^/]+\/room_keys\/version$/.test(url.pathname),
		async (route) => {
			if (route.request().method() !== 'POST') {
				await route.continue();
				return;
			}
			held++;
			await gate;
			failed++;
			await route.fulfill({
				status: 503,
				contentType: 'application/json',
				body: JSON.stringify({
					errcode: 'M_UNKNOWN',
					error: 'Synthetic backup outage'
				})
			});
		}
	);
	try {
		await signup(page, b, info);
		mark('Waiting for original backup creation request before enquiry');
		await expect.poll(() => held).toBeGreaterThan(0);
		const acknowledged = page.waitForResponse(
			(r) =>
				finalize(r.url()) &&
				r.request().method() === 'POST' &&
				r.status() === 201
		);
		await submit(page, `Fault backup ${Date.now()}`);
		await acknowledged;
		completed = true;
		mark('Real enquiry201 acknowledged; releasing backup503');
		release();
		await expect.poll(() => failed).toBeGreaterThan(0);
		await expect(reminder(page)).toContainText(
			'Ihre Anfrage wurde gesendet. Die zusätzliche Schlüsselsicherung ist noch nicht bereit.'
		);
		await expect(
			reminder(page).getByRole('link', {
				name: 'Sicherung in den Sicherheitseinstellungen prüfen',
				exact: true
			})
		).toBeVisible();
		await expect(problem(page)).toHaveCount(0);
		await expect(
			page.locator('[data-cy="optional-recovery-key"]')
		).toHaveCount(0);
		await shot(page, info, 'asker-enquiry-succeeded-backup-failed');
		await bindEmail(page, b);
		await info.attach('backup-failure-result', {
			body: JSON.stringify({
				enquiryFinalization: 201,
				backupFailureAfterFinalization: true,
				heldBackupCreates: held,
				failedBackupCreates: failed,
				truthfulIncompleteStatus: true
			}),
			contentType: 'application/json'
		});
	} catch {
		await failureEvidence(page, info);
		throw new Error(
			`Backup-fault browser gate failed during: ${phase}; enquiryCompleted=${completed}; sensitive diagnostics suppressed`
		);
	} finally {
		release();
		await context.close();
	}
});
