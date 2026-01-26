// Shim for react-dom to provide findDOMNode compatibility with React 19
import * as ReactDOM from '../node_modules/react-dom/index.js';

// Polyfill findDOMNode for React 19 compatibility
const findDOMNode = function (componentOrElement: any) {
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

// Export a modified react-dom module with findDOMNode
export default ReactDOM;
export * from '../node_modules/react-dom/index.js';
export { findDOMNode };

