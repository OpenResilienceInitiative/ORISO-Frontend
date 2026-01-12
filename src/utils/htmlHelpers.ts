/**
 * Utility functions for HTML manipulation
 */

/**
 * Safely truncate HTML while preserving structure
 * @param html - The HTML string to truncate
 * @param maxLength - Maximum length in characters (text content)
 * @returns Truncated HTML string
 */
export const truncateHtml = (html: string, maxLength: number): string => {
	// Check if we're in a browser environment
	if (typeof document === 'undefined') {
		// Fallback for SSR: simple truncation (may break HTML tags)
		const textContent = html.replace(/<[^>]*>/g, '');
		if (textContent.length <= maxLength) return html;
		const truncatedText = textContent.substring(0, maxLength);
		const lastSpace = truncatedText.lastIndexOf(' ');
		const cutPoint = lastSpace > maxLength * 0.8 ? lastSpace : maxLength;
		return html.substring(0, Math.min(cutPoint, html.length)) + '...';
	}

	// Create a temporary DOM element to parse HTML
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = html;

	// Get text content and find truncation point
	const text = tempDiv.textContent || tempDiv.innerText || '';
	if (text.length <= maxLength) return html;

	// Find a good word boundary
	let truncateAt = maxLength;
	const truncatedText = text.substring(0, maxLength);
	const lastSpace = truncatedText.lastIndexOf(' ');
	if (lastSpace > maxLength * 0.8 && lastSpace > 0) {
		truncateAt = lastSpace;
	}

	// Walk through nodes and truncate at the right point
	let currentLength = 0;
	const walker = document.createTreeWalker(
		tempDiv,
		NodeFilter.SHOW_TEXT,
		null
	);

	let node;
	let targetNode = null;
	let targetRemaining = 0;

	while ((node = walker.nextNode())) {
		const nodeLength = node.textContent?.length || 0;
		if (currentLength + nodeLength >= truncateAt) {
			targetNode = node;
			targetRemaining = truncateAt - currentLength;
			break;
		}
		currentLength += nodeLength;
	}

	if (targetNode && targetNode.textContent) {
		// Truncate the target node
		targetNode.textContent =
			targetNode.textContent.substring(0, targetRemaining) + '...';

		// Remove all following siblings of the target node's parent
		let parent = targetNode.parentNode;
		if (parent) {
			let sibling = targetNode.nextSibling;
			while (sibling) {
				const next = sibling.nextSibling;
				parent.removeChild(sibling);
				sibling = next;
			}
		}

		// Also remove any remaining text nodes via walker
		let nextNode;
		while ((nextNode = walker.nextNode())) {
			if (nextNode.parentNode) {
				nextNode.parentNode.removeChild(nextNode);
			}
		}
	}

	const result = tempDiv.innerHTML;
	// Verify truncation worked - if result is still too long, use simple fallback
	const resultText = result.replace(/<[^>]*>/g, '');
	if (resultText.length > maxLength + 50) {
		// Fallback: simple truncation
		const simpleTruncated = text.substring(0, truncateAt) + '...';
		return simpleTruncated;
	}

	return result;
};
