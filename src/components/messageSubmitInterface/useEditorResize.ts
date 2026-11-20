import { useCallback, useEffect, useRef } from 'react';

/** Re-measure when the editor changes size, including after TipTap mounts it. */
export const useEditorResize = (onResize: () => void) => {
	const callback = useRef(onResize);
	callback.current = onResize;
	const resizeObserver = useRef<ResizeObserver | null>(null);
	const mutationObserver = useRef<MutationObserver | null>(null);
	const observed = useRef<Element | null>(null);
	const container = useRef<Element | null>(null);
	const frame = useRef<number | null>(null);
	const disconnect = useCallback(() => {
		mutationObserver.current?.disconnect();
		resizeObserver.current?.disconnect();
		mutationObserver.current = null;
		resizeObserver.current = null;
		observed.current = null;
		container.current = null;
		if (frame.current !== null) {
			window.cancelAnimationFrame(frame.current);
			frame.current = null;
		}
	}, []);
	const observeContainer = useCallback(
		(element: Element | null) => {
			if (container.current === element) return;
			disconnect();
			if (!element || typeof ResizeObserver === 'undefined') return;
			container.current = element;
			const syncEditor = () => {
				const editor = element.querySelector('.ProseMirror');
				if (editor === observed.current) return;
				resizeObserver.current?.disconnect();
				if (frame.current !== null) {
					window.cancelAnimationFrame(frame.current);
					frame.current = null;
				}
				observed.current = editor;
				if (!editor) return;
				resizeObserver.current = new ResizeObserver(() => {
					if (frame.current !== null) return;
					frame.current = window.requestAnimationFrame(() => {
						frame.current = null;
						callback.current();
					});
				});
				resizeObserver.current.observe(editor);
			};
			syncEditor();
			if (typeof MutationObserver !== 'undefined') {
				mutationObserver.current = new MutationObserver(syncEditor);
				mutationObserver.current.observe(element, {
					childList: true,
					subtree: true
				});
			}
		},
		[disconnect]
	);
	useEffect(() => disconnect, [disconnect]);
	return observeContainer;
};
