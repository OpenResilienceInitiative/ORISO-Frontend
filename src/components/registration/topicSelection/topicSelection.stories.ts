import { Meta, StoryObj } from '@storybook/react-vite';
import { TopicSelection } from './TopicSelection';
import { ORISO_M3_FIGMA_URL } from '../../storybookDesignLinks';
// Uploaded category pictures; shipped paths would need the topic service running.
import crisisPicture from '../../../resources/img/registration-md3/icons/cat-05.png';
import familyPicture from '../../../resources/img/registration-md3/icons/cat-02.png';

const meta = {
	title: 'REGISTRATION/TopicSelection',
	component: TopicSelection,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: ORISO_M3_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'TopicSelection component for selecting topics during registration.'
			}
		}
	}
} satisfies Meta<typeof TopicSelection>;

export default meta;
type Story = StoryObj<typeof TopicSelection>;

export const Default: Story = {
	args: {
		onChange: () => {},
		nextStepUrl: '/registration/next',
		onNextClick: () => {}
	}
};

const SHIPPED = '/service/topic/public/icons/';
const catalogueTopic = (
	id: number,
	slug: string,
	name: string,
	description: string,
	icon: string
) => ({
	id,
	slug,
	internalIdentifier: slug,
	name,
	description,
	status: 'active',
	icon: `${SHIPPED}${icon}`
});

/** What the topic service ships after a platform admin edited it. */
const catalogueTopics = [
	catalogueTopic(
		1,
		'parents-and-family',
		'Eltern & Familie',
		'Beratung bei Fragen zu Familie, Erziehung und Zusammenleben.',
		't-01-eltern-und-familie.png'
	),
	catalogueTopic(
		3,
		'u25-suicide-prevention',
		'U25 Suizidprävention',
		'Anonyme Begleitung für junge Menschen in Krisen.',
		't-14-u25.png'
	),
	catalogueTopic(
		5,
		'debt',
		'Schulden und Geld',
		'Vom Admin umbenannt: Hilfe bei Schulden, Mahnungen und Geldsorgen.',
		't-05-schulden.png'
	),
	catalogueTopic(
		7,
		'life-in-old-age',
		'Leben im Alter',
		'Unterstützung bei Pflege, Alltag und sozialer Teilhabe.',
		't-02-leben-im-alter.png'
	)
];

/** Two categories in the admin's order and with the admin's names. */
const catalogueGroups = [
	{
		id: 31,
		name: 'Geld & Krisen (vom Admin benannt)',
		icon: crisisPicture,
		topicIds: [5, 3]
	},
	{
		id: 32,
		name: 'Familie & Alter',
		icon: familyPicture,
		topicIds: [1, 7]
	}
];

/**
 * Topics, categories, order and pictures come from the topic service (the
 * Caritas defaults as a platform admin edited them), not from the built-in clusters.
 */
export const CatalogueFromTopicService: Story = {
	args: Default.args,
	beforeEach: () => {
		const previous = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url = new URL(
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.href
						: input.url,
				window.location.origin
			);
			const json = (body: unknown) =>
				new Response(JSON.stringify(body), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			if (url.pathname.includes('/service/topic/public'))
				return json(catalogueTopics);
			if (url.pathname === '/service/topic-groups')
				return json({ data: { items: catalogueGroups } });
			return previous(input, init);
		};
		return () => {
			globalThis.fetch = previous;
		};
	}
};
