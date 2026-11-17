/** Sample direct links for stories (Meine Direktlinks, calendar list). */
import { DirectLink } from '../conversationCreate/directLink/directLink';

export const SAMPLE_DIRECT_LINKS: DirectLink[] = [
	{
		id: '1',
		name: 'Flyer Schule',
		topic: 'Schulden',
		topicId: 3,
		medium: 'VIDEO',
		temporary: true,
		active: true,
		url: 'https://app.oriso.org/invite/Ab3dE6gH'
	},
	{
		id: '2',
		name: 'Plakat Rathaus',
		topic: 'Sucht',
		topicId: 4,
		medium: 'CHAT',
		temporary: false,
		active: true,
		url: 'https://app.oriso.org/invite/Zy8xW6vU',
		// #2142: the date and time the counsellor noted.
		scheduledAt: '2026-11-20T13:30:00.000Z'
	},
	{
		id: '3',
		name: 'Telefonsprechstunde',
		topic: 'Schulden',
		topicId: 3,
		medium: 'AUDIO',
		temporary: true,
		active: false,
		url: 'https://app.oriso.org/invite/Qr5sT2uV'
	}
];
