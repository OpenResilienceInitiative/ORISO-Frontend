import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { useAppConfig } from '../../hooks/useAppConfig';

/**
 * The platform-wide chat settings a platform admin sets in Admin -> Einstellungen.
 * They arrive through GET /service/settings as strings (ORISO-ConsultingTypeService).
 * A backend without them, or a value that makes no sense, means today's behaviour.
 */
export const CHAT_COMPOSER_FORMATS = [
	'heading',
	'bulletList',
	'orderedList',
	'taskList',
	'blockquote',
	'codeBlock',
	'bold',
	'italic',
	'strike',
	'code',
	'underline',
	'highlight',
	'link',
	'superscript',
	'subscript',
	'image',
	'dateTime'
] as const;

export type ChatComposerFormat = (typeof CHAT_COMPOSER_FORMATS)[number];

export const DEFAULT_CHAT_MESSAGE_COLLAPSE_THRESHOLD = 300;

/** The fallback of `--message-item-max-width-desktop` in message.styles.scss. */
export const DEFAULT_CHAT_MESSAGE_MAX_WIDTH_DESKTOP = 770;

export const parseDisabledFormats = (
	raw: unknown
): ReadonlySet<ChatComposerFormat> => {
	if (typeof raw !== 'string') {
		return new Set();
	}
	const keys = raw.split(',').map((key) => key.trim());
	return new Set(
		CHAT_COMPOSER_FORMATS.filter((format) => keys.includes(format))
	);
};

const parseInteger = (raw: unknown): number | null => {
	if (typeof raw !== 'string' && typeof raw !== 'number') {
		return null;
	}
	if (raw === '') {
		return null;
	}
	const parsed = Number(raw);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

/** 0 means collapsing is switched off. */
export const parseCollapseThreshold = (raw: unknown): number =>
	parseInteger(raw) ?? DEFAULT_CHAT_MESSAGE_COLLAPSE_THRESHOLD;

export const parseMaxWidthDesktop = (raw: unknown): number => {
	const parsed = parseInteger(raw);
	return parsed === null || parsed === 0
		? DEFAULT_CHAT_MESSAGE_MAX_WIDTH_DESKTOP
		: parsed;
};

/**
 * Carries the width to message.styles.scss. The default sets nothing, so the
 * stylesheet alone decides and an unconfigured platform renders as before.
 */
export const chatMessageWidthStyle = (
	maxWidthDesktop: number
): CSSProperties | undefined =>
	maxWidthDesktop === DEFAULT_CHAT_MESSAGE_MAX_WIDTH_DESKTOP
		? undefined
		: ({
				'--message-item-max-width-desktop': `${maxWidthDesktop}px`
			} as CSSProperties);

export const useChatComposerDisabledFormats =
	(): ReadonlySet<ChatComposerFormat> => {
		const raw = useAppConfig()?.chatComposerDisabledFormats;
		return useMemo(() => parseDisabledFormats(raw), [raw]);
	};

export const useChatMessageDisplayConfig = () => {
	const config = useAppConfig();
	const maxWidthDesktop = parseMaxWidthDesktop(
		config?.chatMessageMaxWidthDesktop
	);
	return {
		collapseThreshold: parseCollapseThreshold(
			config?.chatMessageCollapseThreshold
		),
		widthStyle: useMemo(
			() => chatMessageWidthStyle(maxWidthDesktop),
			[maxWidthDesktop]
		)
	};
};
