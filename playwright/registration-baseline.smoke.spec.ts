import { expect, Page, test } from '@playwright/test';

type DemoTopic = {
	id: number;
	label: string;
};

type Agency = {
	id: number;
	name?: string;
};

type AgencyResponseRecord = {
	url: string;
	status: number;
	bodyLength?: number;
	topicId?: string | null;
	postcode?: string | null;
	error?: string;
};

const POSTCODE = '88885';
const CONSULTING_TYPE = '1';
const DEMO_TOPICS: DemoTopic[] = [
	{ id: 10, label: 'Eltern und Familie' },
	{ id: 2, label: 'Kinder und Jugendliche' }
];

function deployedAppBaseURL(): string {
	const baseURL =
		process.env.PLAYWRIGHT_BASE_URL || process.env.ORISO_APP_BASE_URL;
	if (!baseURL) {
		throw new Error(
			'Set PLAYWRIGHT_BASE_URL, for example PLAYWRIGHT_BASE_URL=https://app.oriso.org npm run test:smoke:baseline'
		);
	}
	return baseURL;
}

function deployedApiBaseURL(appBaseURL: string): string {
	const explicitApiBaseURL =
		process.env.PLAYWRIGHT_API_BASE_URL || process.env.ORISO_API_BASE_URL;
	if (explicitApiBaseURL) {
		return explicitApiBaseURL;
	}

	const url = new URL(appBaseURL);
	if (url.hostname.startsWith('app.')) {
		url.hostname = url.hostname.replace(/^app\./, 'api.');
	}
	return url.origin;
}

function agencyURL(apiBaseURL: string, topicId: number): string {
	const url = new URL('/service/agencies', apiBaseURL);
	url.searchParams.set('postcode', POSTCODE);
	url.searchParams.set('topicId', String(topicId));
	url.searchParams.set('consultingType', CONSULTING_TYPE);
	return url.toString();
}

function agencyRequestMatches(url: string, topicId: number): boolean {
	const parsed = new URL(url);
	return (
		parsed.pathname === '/service/agencies' &&
		parsed.searchParams.get('postcode') === POSTCODE &&
		parsed.searchParams.get('topicId') === String(topicId) &&
		parsed.searchParams.get('consultingType') === CONSULTING_TYPE
	);
}

function agencyRequestHasDemoPostcode(url: string): boolean {
	const parsed = new URL(url);
	return (
		parsed.pathname === '/service/agencies' &&
		parsed.searchParams.get('postcode') === POSTCODE
	);
}

async function dismissWelcomeScreen(page: Page) {
	const closeWelcome = page.locator('[data-cy="close-welcome-screen"]');
	if (await closeWelcome.isVisible().catch(() => false)) {
		await closeWelcome.click();
	}
}

function postcodeInput(page: Page) {
	return page
		.getByRole('textbox', { name: /postcode|postleitzahl/i })
		.or(page.locator('input#postcode'))
		.or(page.locator('input[name="postcode"]'));
}

async function goToPostcodeStep(page: Page, topic: DemoTopic) {
	const postcode = postcodeInput(page);
	if (await postcode.isVisible().catch(() => false)) {
		return;
	}

	const topicLoadError = page.locator(
		'[data-cy="topic-selection-load-error"]'
	);
	const topicEmpty = page.locator('[data-cy="topic-selection-empty"]');
	const topicRadio = page.locator(
		`[data-cy="topic-selection-radio-${topic.id}"]`
	);

	if (await topicLoadError.isVisible().catch(() => false)) {
		throw new Error(`Topic catalogue not loading for ${topic.label}`);
	}
	if (await topicEmpty.isVisible().catch(() => false)) {
		throw new Error(`Topic catalogue loaded empty for ${topic.label}`);
	}
	if (await topicRadio.isVisible().catch(() => false)) {
		await topicRadio.click();
	}

	for (let attempt = 0; attempt < 3; attempt += 1) {
		if (await postcode.isVisible().catch(() => false)) {
			return;
		}
		const nextButton = page.getByRole('button', { name: /^Next$/ }).last();
		if (!(await nextButton.isVisible().catch(() => false))) {
			break;
		}
		await nextButton.click();
	}

	if (!(await postcode.isVisible().catch(() => false))) {
		throw new Error(
			`Postcode step did not become visible for ${topic.label}; topic catalogue or routing may be broken`
		);
	}
}

test.describe('deployed registration demo baseline', () => {
	test.skip(
		!process.env.PLAYWRIGHT_BASE_URL && !process.env.ORISO_APP_BASE_URL,
		'Set PLAYWRIGHT_BASE_URL or ORISO_APP_BASE_URL to run deployed baseline smoke checks.'
	);

	for (const topic of DEMO_TOPICS) {
		test(`${topic.label} returns and renders a demo agency`, async ({
			page,
			request
		}) => {
			const appBaseURL = deployedAppBaseURL();
			const apiBaseURL = deployedApiBaseURL(appBaseURL);
			const directURL = agencyURL(apiBaseURL, topic.id);
			const directResponse = await request.get(directURL);
			const directStatus = directResponse.status();
			const directAgencies = (await directResponse.json()) as Agency[];

			expect(
				directStatus,
				`API request failed for ${topic.label}: ${directURL}`
			).toBe(200);
			expect(
				directAgencies.length,
				`API returned an empty list for ${topic.label}: ${directURL}`
			).toBeGreaterThan(0);

			const seenAgencyResponses: AgencyResponseRecord[] = [];
			page.on('response', async (response) => {
				if (!agencyRequestHasDemoPostcode(response.url())) {
					return;
				}
				const parsed = new URL(response.url());
				const record: AgencyResponseRecord = {
					url: response.url(),
					status: response.status(),
					topicId: parsed.searchParams.get('topicId'),
					postcode: parsed.searchParams.get('postcode')
				};
				try {
					const body = (await response.json()) as Agency[];
					record.bodyLength = Array.isArray(body)
						? body.length
						: undefined;
				} catch (error) {
					record.error = String(error);
				}
				seenAgencyResponses.push(record);
			});

			await page.goto(`/registration?tid=${topic.id}`, {
				waitUntil: 'domcontentloaded'
			});
			await dismissWelcomeScreen(page);
			await expect(
				page.locator('[data-cy="registration-form"]')
			).toBeVisible();
			await goToPostcodeStep(page, topic);

			const agencyResponsePromise = page.waitForResponse((response) =>
				agencyRequestMatches(response.url(), topic.id)
			);
			await postcodeInput(page).fill(POSTCODE);
			const nextButton = page
				.getByRole('button', { name: /^Next$/ })
				.last();
			await expect(
				nextButton,
				'Postcode step did not enable Next'
			).toBeEnabled();
			await nextButton.click();
			const agencyResponse = await agencyResponsePromise.catch(
				() => null
			);

			expect(
				agencyResponse,
				`UI did not request the expected topicId=${topic.id}; observed agency requests: ${JSON.stringify(
					seenAgencyResponses
				)}`
			).not.toBeNull();

			const uiStatus = agencyResponse!.status();
			const uiURL = agencyResponse!.url();
			const uiAgencies = (await agencyResponse!.json()) as Agency[];

			expect(uiStatus, `UI agency request failed: ${uiURL}`).toBe(200);
			expect(
				uiAgencies.length,
				`UI agency request returned an empty list: ${uiURL}`
			).toBeGreaterThan(0);

			const expectedAgency = uiAgencies[0];
			await expect(
				page.locator(
					`[data-cy="agency-selection-radio-${expectedAgency.id}"]`
				),
				`UI did not render agency ${expectedAgency.id} ${expectedAgency.name || ''} despite non-empty response: ${uiURL}`
			).toBeVisible();

			test.info().annotations.push({
				type: 'demo-baseline',
				description: JSON.stringify({
					topic,
					directURL,
					directStatus,
					directBodyLength: directAgencies.length,
					uiURL,
					uiStatus,
					uiBodyLength: uiAgencies.length,
					renderedAgencyId: expectedAgency.id,
					renderedAgencyName: expectedAgency.name
				})
			});
		});
	}
});
