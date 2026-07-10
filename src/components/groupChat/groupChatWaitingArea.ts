export interface WaitingAreaTime {
	signedMinutes: number;
	label: string;
	discomfortEmoji: string;
	pills: Array<{
		kind: 'dog' | 'cat' | 'roman';
		value: number | string;
	}>;
}

const roman = (value: number): string => {
	if (value <= 0) return '0';
	const numerals: Array<[number, string]> = [
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
	let remaining = Math.min(value, 399);
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
	const signedMinutes = Math.ceil(
		(plannedStart.getTime() - now.getTime()) / 60_000
	);
	const absoluteMinutes = Math.abs(signedMinutes);
	const hours = Math.floor(absoluteMinutes / 60)
		.toString()
		.padStart(2, '0');
	const minutes = (absoluteMinutes % 60).toString().padStart(2, '0');
	const label = `${signedMinutes < 0 ? '-' : ''}${hours}:${minutes}`;
	const discomfortEmoji =
		signedMinutes <= -15
			? '😵'
			: signedMinutes <= -5
				? '😬'
				: signedMinutes < 0
					? '😅'
					: '🙂';

	return {
		signedMinutes,
		label,
		discomfortEmoji,
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
