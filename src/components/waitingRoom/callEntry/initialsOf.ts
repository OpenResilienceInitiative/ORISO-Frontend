/** "Mara K." → "MK"; an empty name gets a neutral dot instead of nothing. */
export const initialsOf = (name: string): string => {
	const letters = name
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]!.toUpperCase())
		.join('');
	return letters || '·';
};
