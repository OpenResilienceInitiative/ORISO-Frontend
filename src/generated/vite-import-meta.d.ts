interface ImportMeta {
	glob<T = unknown>(
		pattern: string | string[],
		options?: {
			eager?: boolean;
			import?: string;
			query?: string | Record<string, string | number | boolean>;
		}
	): Record<string, T>;
}
