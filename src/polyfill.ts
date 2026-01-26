import 'react-app-polyfill/stable';
import 'fastestsmallesttextencoderdecoder';
import 'whatwg-fetch';
import 'core-js/features/promise';
import 'core-js/web/dom-collections';
import 'element-remove';
import 'element-scroll-polyfill';
import elementClosest from 'element-closest';
import * as ReactDOM from 'react-dom';

elementClosest(window);

// Polyfill for findDOMNode (removed in React 19) for intro.js-react compatibility
if (!(ReactDOM as any).findDOMNode) {
	(ReactDOM as any).findDOMNode = function (componentOrElement: any) {
		if (componentOrElement == null) {
			return null;
		}
		if (componentOrElement.nodeType === 1) {
			return componentOrElement;
		}
		// Try to get the DOM node from React fiber
		if (componentOrElement._reactInternals) {
			const fiber = componentOrElement._reactInternals;
			let node = fiber;
			while (node) {
				if (node.stateNode && node.stateNode.nodeType === 1) {
					return node.stateNode;
				}
				if (node.child) {
					node = node.child;
				} else if (node.sibling) {
					node = node.sibling;
				} else {
					while (node && !node.sibling && node.return) {
						node = node.return;
					}
					if (node) {
						node = node.sibling;
					}
				}
			}
		}
		return null;
	};
}
