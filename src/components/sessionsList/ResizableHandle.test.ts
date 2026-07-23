import { describe, expect, it } from 'vitest';
import { getToggledSidebarWidth } from './ResizableHandle';

describe('session-list collapse control', () => {
	it('collapses an expanded list to the compact rail', () => {
		expect(getToggledSidebarWidth(420, 80, 397)).toBe(80);
	});

	it('restores the complete expanded minimum instead of a truncated width', () => {
		expect(getToggledSidebarWidth(80, 80, 397)).toBe(397);
	});
});
