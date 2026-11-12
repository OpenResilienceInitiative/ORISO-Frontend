import * as React from 'react';
import { useContext, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	ActiveSessionContext,
	AppConfigContext,
	E2EEContext,
	UserDataContext
} from '../../globalState';
import { ConsultantListContext } from '../../globalState/provider/ConsultantListProvider';
import { ServerSettingsContext } from '../../globalState/provider/ServerSettingsProvider';
import { MessageItemComponent } from './MessageItemComponent';
import {
	MOCK_ASKER_MATRIX_ID,
	mockActiveSession1on1,
	mockConsultantListContext,
	mockE2EEContext,
	mockE2eeParams,
	mockMessageItemComponentProps,
	mockServerSettingsContext,
	mockUserData
} from './MessageItemComponent.mocks';
import { desktop1440Globals } from './messageStoryShell';
import { CHAT_COMPOSER_FORMATS } from './chatMessageConfig';
import { a11yExcept } from '../../../.storybook/a11yExceptions';
import './message.styles.scss';

const LAST_WORDS = 'Das ist der allerletzte Satz.';
const longText = (length: number) =>
	`${'Heute war es schwer für mich und ich brauche Orientierung. '.repeat(
		Math.ceil(length / 59)
	)}${LAST_WORDS}`;

const EVERY_FORMAT =
	'<h2>Titel</h2>' +
	'<p><strong>fett</strong> <em>kursiv</em> <u>unter</u> <s>durch</s> <code>code</code> ' +
	'<sup>hoch</sup> <sub>tief</sub> <mark data-color="#fff59d">markiert</mark> ' +
	'<a href="https://example.org">link</a></p>' +
	'<ul><li><p>punkt</p></li></ul><ol><li><p>zahl</p></li></ol>' +
	'<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>aufgabe</p></div></li></ul>' +
	'<blockquote><p>zitat</p></blockquote><pre><code>block</code></pre>';

/**
 * The rendered task-list checkbox has no accessible name: the renderer forces it
 * inert (#1079) and its text sits next to the label, not in it. That predates
 * this setting and belongs in its own fix.
 */
const taskCheckboxException = {
	a11y: {
		config: {
			rules: [
				...a11yExcept().config.rules,
				// `a11yExcept` widens a rule to `*`, which fits only rules that
				// already audit everything; `label` must keep its own selector.
				{
					id: 'label',
					selector: 'input:not([type="checkbox"][disabled]), textarea'
				}
			]
		}
	}
};

type Args = {
	message: string;
	/** Characters above which the message collapses; 0 = never. */
	collapseThreshold: string;
	/** Widest message on desktop, in pixels. */
	maxWidthDesktop: string;
	disabledFormats: string;
};

const Message = ({
	message,
	collapseThreshold,
	maxWidthDesktop,
	disabledFormats
}: Args) => {
	const config = useContext(AppConfigContext);
	return (
		<AppConfigContext.Provider
			value={{
				...config,
				chatMessageCollapseThreshold: collapseThreshold,
				chatMessageMaxWidthDesktop: maxWidthDesktop,
				chatComposerDisabledFormats: disabledFormats
			}}
		>
			<ServerSettingsContext.Provider value={mockServerSettingsContext()}>
				<ConsultantListContext.Provider
					value={mockConsultantListContext() as never}
				>
					<E2EEContext.Provider value={mockE2EEContext()}>
						<UserDataContext.Provider
							value={{
								userData: mockUserData(),
								setUserData: () => {},
								reloadUserData: async () => null as any
							}}
						>
							<ActiveSessionContext.Provider
								value={{
									activeSession: mockActiveSession1on1(),
									reloadActiveSession: () => {},
									readActiveSession: () => {}
								}}
							>
								<div
									style={{ padding: 16, background: '#fff' }}
								>
									<MessageItemComponent
										{...mockMessageItemComponentProps({
											isMyMessage: false,
											userId: MOCK_ASKER_MATRIX_ID,
											askerMatrixUserId:
												MOCK_ASKER_MATRIX_ID,
											message
										})}
										handleDecryptionErrors={() => {}}
										handleDecryptionSuccess={() => {}}
										e2eeParams={mockE2eeParams()}
									/>
								</div>
							</ActiveSessionContext.Provider>
						</UserDataContext.Provider>
					</E2EEContext.Provider>
				</ConsultantListContext.Provider>
			</ServerSettingsContext.Provider>
		</AppConfigContext.Provider>
	);
};

const meta = {
	title: 'Components/Chat/MessageItem/Platform settings',
	component: Message,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'The platform-wide chat settings as a message shows them (Admin -> Einstellungen -> ' +
					'Chat-Nachrichten). Use the controls: `collapseThreshold` (0 = never), `maxWidthDesktop` in ' +
					'pixels, `disabledFormats` (comma-separated keys, which must not change how a message renders).'
			}
		}
	},
	globals: desktop1440Globals,
	argTypes: {
		message: { control: 'text' },
		collapseThreshold: { control: 'text' },
		maxWidthDesktop: { control: 'text' },
		disabledFormats: { control: 'text' }
	},
	args: {
		message: longText(600),
		collapseThreshold: '300',
		maxWidthDesktop: '770',
		disabledFormats: ''
	}
} satisfies Meta<typeof Message>;

export default meta;
type Story = StoryObj<typeof meta>;

const showMoreName = /^(Mehr anzeigen|Show more)$/;
const showLessName = /^(Weniger anzeigen|Show less)$/;

/** `.messageItem` fades in, so a first look can still find it transparent. */
const expectShowMoreVisible = async (canvasElement: HTMLElement) => {
	const showMore = await within(canvasElement).findByRole('button', {
		name: showMoreName
	});
	await waitFor(() => expect(showMore).toBeVisible());
};

const bubbleWidth = (canvasElement: HTMLElement) =>
	canvasElement
		.querySelector<HTMLElement>('.messageItem__message')!
		.getBoundingClientRect().width;

const expectBubbleWidth = async (
	canvasElement: HTMLElement,
	expected: number
) => {
	// `.messageItem` enters at scale(0.98); wait for it to settle.
	await waitFor(() => {
		const width = bubbleWidth(canvasElement);
		expect(width).toBeGreaterThanOrEqual(expected - 1);
		expect(width).toBeLessThanOrEqual(expected + 1);
	});
};

/** Today's behaviour. What "show more" hides is really there after the click. */
export const CollapsedThenExpanded: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: showMoreName })
		);
		await expect(canvas.queryByText(new RegExp(LAST_WORDS))).not.toBeNull();
		await userEvent.click(
			canvas.getByRole('button', { name: showLessName })
		);
		await waitFor(() =>
			expect(canvas.queryByText(new RegExp(LAST_WORDS))).toBeNull()
		);
		await expect(
			canvas.getByRole('button', { name: showMoreName })
		).toBeVisible();
	}
};

export const CollapsesEarlierWhenTheThresholdIsLower: Story = {
	args: { message: longText(120), collapseThreshold: '100' },
	play: async ({ canvasElement }) => {
		await expectShowMoreVisible(canvasElement);
	}
};

export const StaysOpenBelowAHigherThreshold: Story = {
	args: { collapseThreshold: '5000' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await canvas.findByText(new RegExp(LAST_WORDS));
		await expect(
			canvas.queryByRole('button', { name: showMoreName })
		).toBeNull();
	}
};

/** 0 switches it off: the longest message shows in full, with no button. */
export const CollapsingOff: Story = {
	args: { message: longText(7000), collapseThreshold: '0' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await canvas.findByText(new RegExp(LAST_WORDS));
		await expect(
			canvas.queryByRole('button', { name: showMoreName })
		).toBeNull();
	}
};

/** A backend that does not send the settings yet: exactly today's numbers. */
export const BackendWithoutTheSettings: Story = {
	args: {
		collapseThreshold: undefined,
		maxWidthDesktop: undefined,
		disabledFormats: undefined
	},
	play: async ({ canvasElement }) => {
		await expectShowMoreVisible(canvasElement);
		await expectBubbleWidth(canvasElement, 770);
	}
};

export const DefaultWidth: Story = {
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByRole('button', {
			name: showMoreName
		});
		await expectBubbleWidth(canvasElement, 770);
	}
};

export const NarrowerThanTheDefault: Story = {
	args: { maxWidthDesktop: '500' },
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByRole('button', {
			name: showMoreName
		});
		await expectBubbleWidth(canvasElement, 500);
	}
};

export const WiderThanTheDefault: Story = {
	args: { maxWidthDesktop: '1000' },
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByRole('button', {
			name: showMoreName
		});
		await expectBubbleWidth(canvasElement, 1000);
	}
};

/** A short message stays narrow, and a width below 460 limits it as well. */
export const ShortMessageStaysNarrow: Story = {
	args: { message: longText(0).slice(-29), maxWidthDesktop: '1000' },
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByText(new RegExp(LAST_WORDS));
		await expect(
			canvasElement.querySelector('.messageItem__message--wide')
		).toBeNull();
		await expect(bubbleWidth(canvasElement)).toBeLessThanOrEqual(461);
	}
};

const renderedFormats = (canvasElement: HTMLElement) => {
	const bubble = canvasElement.querySelector<HTMLElement>(
		'.messageItem__message'
	)!;
	return {
		heading: bubble.querySelector('h2')?.textContent,
		bold: bubble.querySelector('strong')?.textContent,
		italic: bubble.querySelector('em')?.textContent,
		underline: bubble.querySelector('u')?.textContent,
		strike: bubble.querySelector('s')?.textContent,
		code: bubble.querySelector('p code')?.textContent,
		superscript: bubble.querySelector('sup')?.textContent,
		subscript: bubble.querySelector('sub')?.textContent,
		highlight: bubble.querySelector('[data-color]')?.textContent,
		link: bubble.querySelector('a[href]')?.textContent,
		bullet: bubble.querySelector('ul:not([data-type]) li')?.textContent,
		number: bubble.querySelector('ol li')?.textContent,
		task: bubble.querySelector('input[type="checkbox"][checked]') !== null,
		quote: bubble.querySelector('blockquote')?.textContent,
		codeBlock: bubble.querySelector('pre code')?.textContent
	};
};

/**
 * The hard requirement. Every format in the menu is switched off, and a message
 * written before that still renders each of them.
 */
export const OldMessageWithEveryFormatOffRendersIt: Story = {
	parameters: taskCheckboxException,
	args: {
		message: EVERY_FORMAT,
		collapseThreshold: '0',
		disabledFormats: CHAT_COMPOSER_FORMATS.join(',')
	},
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByText('fett');
		await expect(renderedFormats(canvasElement)).toEqual({
			heading: 'Titel',
			bold: 'fett',
			italic: 'kursiv',
			underline: 'unter',
			strike: 'durch',
			code: 'code',
			superscript: 'hoch',
			subscript: 'tief',
			highlight: 'markiert',
			link: 'link',
			bullet: 'punkt',
			number: 'zahl',
			task: true,
			quote: 'zitat',
			codeBlock: 'block'
		});
	}
};

const OffAndOnAgainHarness = (args: Args) => {
	const [off, setOff] = useState(false);
	return (
		<>
			<label>
				<input
					type="checkbox"
					checked={off}
					onChange={(event) => setOff(event.target.checked)}
				/>
				Platform switches every format off
			</label>
			<Message
				{...args}
				disabledFormats={off ? CHAT_COMPOSER_FORMATS.join(',') : ''}
			/>
		</>
	);
};

/** On, off, on: the same message, the same markup, every time. */
export const OldMessageIsUntouchedInBothDirections: Story = {
	parameters: taskCheckboxException,
	args: { message: EVERY_FORMAT, collapseThreshold: '0' },
	render: (args) => <OffAndOnAgainHarness {...args} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await canvas.findByText('fett');
		const markup = () =>
			canvasElement.querySelector('.messageItem__message span')
				?.innerHTML;
		const before = markup();
		expect(before).toContain('<strong>');
		const platformSwitch = canvas.getByRole('checkbox', {
			name: 'Platform switches every format off'
		});
		await userEvent.click(platformSwitch);
		expect(markup()).toBe(before);
		await userEvent.click(platformSwitch);
		expect(markup()).toBe(before);
	}
};
