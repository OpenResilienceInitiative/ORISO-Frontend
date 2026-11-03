import type { CardArtwork } from '../topics';
import video640 from './640/video-call.webp';
import video1280 from './1280/video-call.webp';
import audio640 from './640/audio-call.webp';
import audio1280 from './1280/audio-call.webp';
import chat640 from './640/chat.webp';
import chat1280 from './1280/chat.webp';
import onSite640 from './640/termin-vor-ort.webp';
import onSite1280 from './1280/termin-vor-ort.webp';

/** Counselling-format motifs (Caritas red tones), one per medium. */
export const FORMAT_ARTWORK = {
	VIDEO: {
		id: 'format-video-call',
		label: 'Videocall',
		kind: 'format',
		src: video640,
		src1280: video1280
	},
	AUDIO: {
		id: 'format-audio-call',
		label: 'Audio-Call',
		kind: 'format',
		src: audio640,
		src1280: audio1280
	},
	CHAT: {
		id: 'format-chat',
		label: 'Chat',
		kind: 'format',
		src: chat640,
		src1280: chat1280
	},
	ON_SITE: {
		id: 'format-on-site',
		label: 'Termin vor Ort',
		kind: 'format',
		src: onSite640,
		src1280: onSite1280
	}
} as const satisfies Record<string, CardArtwork>;
