export interface WaitingAreaTime {
	signedMinutes: number;
	label: string;
	discomfortEmoji: string;
	discomfortLabel: 'onTime' | 'slightlyLate' | 'late' | 'veryLate';
	pills: Array<{
		kind: 'dog' | 'cat' | 'roman';
		value: number | string;
	}>;
}

const EMOJI_BY_SEVERITY: Record<WaitingAreaTime['discomfortLabel'], string> = {
	onTime: '🙂',
	slightlyLate: '😅',
	late: '😬',
	veryLate: '😵'
};

const roman = (value: number): string => {
	if (value <= 0) return '0';
	const numerals: Array<[number, string]> = [
		[1000, 'M'],
		[900, 'CM'],
		[500, 'D'],
		[400, 'CD'],
		[100, 'C'],
		[90, 'XC'],
		[50, 'L'],
		[40, 'XL'],
		[10, 'X'],
		[9, 'IX'],
		[5, 'V'],
		[4, 'IV'],
		[1, 'I']
	];
	let remaining = value;
	let result = '';
	for (const [amount, symbol] of numerals) {
		while (remaining >= amount) {
			result += symbol;
			remaining -= amount;
		}
	}
	return result;
};

export const getWaitingAreaTime = (
	now: Date,
	plannedStart: Date
): WaitingAreaTime => {
	const deltaMinutes = (plannedStart.getTime() - now.getTime()) / 60_000;
	const signedMinutes =
		deltaMinutes < 0 ? Math.floor(deltaMinutes) : Math.ceil(deltaMinutes);
	const absoluteMinutes = Math.abs(signedMinutes);
	const hours = Math.floor(absoluteMinutes / 60)
		.toString()
		.padStart(2, '0');
	const minutes = (absoluteMinutes % 60).toString().padStart(2, '0');
	const label = `${signedMinutes < 0 ? '-' : ''}${hours}:${minutes}`;
	const discomfortLabel: WaitingAreaTime['discomfortLabel'] =
		deltaMinutes <= -15
			? 'veryLate'
			: deltaMinutes <= -5
				? 'late'
				: deltaMinutes < 0
					? 'slightlyLate'
					: 'onTime';
	const discomfortEmoji = EMOJI_BY_SEVERITY[discomfortLabel];

	return {
		signedMinutes,
		label,
		discomfortEmoji,
		discomfortLabel,
		pills: [
			{ kind: 'dog', value: absoluteMinutes * 7 },
			{
				kind: 'cat',
				value: Math.max(1, Math.round(absoluteMinutes * 4.5))
			},
			{ kind: 'roman', value: roman(absoluteMinutes) }
		]
	};
};
