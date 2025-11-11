#!/usr/bin/env node

/**
 * Smart Story Generator - Only creates stories for actual React components
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Only generate stories for these core UI components
const CORE_COMPONENTS = [
	'button/Button',
	'inputField/InputField',
	'checkbox/Checkbox',
	'radioButton/RadioButton',
	'text/Text',
	'headline/Headline',
	'tag/Tag',
	'card/Card',
	'modal/Modal',
	'notice/Notice',
	'loadingSpinner/LoadingSpinner',
	'spinner/Spinner',
	'overlay/Overlay',
	'progressbar/ProgressBar',
	'banner/Banner',
	'box/Box'
];

function isReactComponent(filePath) {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		
		// Must export a React component (function/const that returns JSX)
		const hasComponentExport = /export\s+(?:const|function|class)\s+[A-Z][a-zA-Z0-9_]*/.test(content);
		const hasJSX = /return\s*\(|<[A-Z]/.test(content);
		const hasReactImport = /from\s+['"]react['"]/.test(content);
		
		// Exclude constants, types, helpers
		const isConstant = /export\s+(?:const|let)\s+[A-Z_]+/.test(content) && !hasJSX;
		const isType = /export\s+(?:type|interface)\s+/.test(content) && !hasComponentExport;
		
		return hasComponentExport && (hasJSX || hasReactImport) && !isConstant && !isType;
	} catch {
		return false;
	}
}

function getComponentExport(componentPath) {
	try {
		const content = fs.readFileSync(componentPath, 'utf-8');
		
		// Find the main component export
		const componentMatch = content.match(/export\s+(?:const|function|class)\s+([A-Z][a-zA-Z0-9_]*)/);
		if (componentMatch) {
			return componentMatch[1];
		}
		
		// Try default export
		if (content.includes('export default')) {
			const fileName = path.basename(componentPath, path.extname(componentPath));
			if (fileName === 'index') {
				const dirName = path.basename(path.dirname(componentPath));
				return dirName.charAt(0).toUpperCase() + dirName.slice(1);
			}
			return fileName.charAt(0).toUpperCase() + fileName.slice(1);
		}
		
		return null;
	} catch {
		return null;
	}
}

function getCategory(componentPath) {
	const dirName = path.basename(path.dirname(componentPath));
	const fileName = path.basename(componentPath, path.extname(componentPath));
	
	const categoryMap = {
		button: 'Forms',
		checkbox: 'Forms',
		inputField: 'Forms',
		radioButton: 'Forms',
		text: 'Display',
		headline: 'Display',
		tag: 'Display',
		banner: 'Display',
		box: 'Layout',
		card: 'Layout',
		modal: 'Layout',
		notice: 'Feedback',
		loadingSpinner: 'Feedback',
		spinner: 'Feedback',
		overlay: 'Feedback',
		progressbar: 'UI'
	};
	
	const key = fileName === 'index' ? dirName : fileName;
	return categoryMap[key] || 'Components';
}

function getDefaultArgs(componentName, componentPath) {
	// Provide sensible defaults for common components
	const defaults = {
		Button: {
			item: {
				type: 'PRIMARY',
				label: 'Button',
				id: 'btn-1'
			}
		},
		InputField: {
			item: {
				id: 'input-1',
				type: 'text',
				name: 'input',
				label: 'Input Field',
				content: ''
			},
			inputHandle: () => {}
		},
		Checkbox: {
			item: {
				id: 'checkbox-1',
				label: 'Checkbox',
				checked: false
			},
			checkboxHandle: () => {}
		},
		RadioButton: {
			type: 'default',
			inputId: 'radio-1',
			name: 'radio',
			value: 'option1',
			handleRadioButton: () => {}
		},
		Text: {
			type: 'standard',
			text: 'Sample text'
		},
		Headline: {
			text: 'Headline',
			semanticLevel: '1'
		},
		Tag: {
			text: 'Tag',
			color: 'green'
		},
		Card: {
			children: 'Card content'
		},
		Modal: {
			children: 'Modal content'
		},
		Notice: {
			title: 'Notice',
			children: 'Notice content'
		},
		LoadingSpinner: {},
		Spinner: {},
		Overlay: {},
		ProgressBar: {
			max: 100,
			current: 50
		},
		Banner: {
			children: 'Banner content'
		},
		Box: {
			children: 'Box content'
		}
	};
	
	return defaults[componentName] || {};
}

function generateStory(componentPath, storyPath) {
	const componentName = path.basename(componentPath, path.extname(componentPath));
	const exportName = getComponentExport(componentPath);
	const category = getCategory(componentPath);
	
	if (!exportName) {
		return false;
	}
	
	const importPath = componentName === 'index' ? './index' : `./${componentName}`;
	const defaultArgs = getDefaultArgs(exportName, componentPath);
	
	const storyContent = `import { Meta, StoryObj } from '@storybook/react';
import { ${exportName} } from '${importPath}';

const meta = {
	title: 'Components/${category}/${exportName}',
	component: ${exportName},
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: '${exportName} component.'
			}
		}
	}
} satisfies Meta<typeof ${exportName}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: ${JSON.stringify(defaultArgs, null, 2).replace(/"([a-zA-Z_][a-zA-Z0-9_]*)":/g, '$1:').replace(/"/g, "'")}
};
`;
	
	fs.writeFileSync(storyPath, storyContent, 'utf-8');
	return true;
}

async function main() {
	console.log('🚀 Generating smart Storybook stories (React components only)...\n');
	
	const componentFiles = await glob('src/components/**/*.{tsx,jsx}', {
		ignore: [
			'**/*.stories.{ts,tsx,js,jsx}',
			'**/*.test.{ts,tsx,js,jsx}',
			'**/node_modules/**',
			'**/registration/**'
		]
	});
	
	let generated = 0;
	let skipped = 0;
	
	for (const componentPath of componentFiles) {
		// Only process core components
		const relPath = path.relative('src/components', componentPath);
		const isCore = CORE_COMPONENTS.some(core => relPath.includes(core));
		
		if (!isCore) {
			skipped++;
			continue;
		}
		
		if (!isReactComponent(componentPath)) {
			skipped++;
			continue;
		}
		
		const componentName = path.basename(componentPath, path.extname(componentPath));
		const dir = path.dirname(componentPath);
		const storyPath = path.join(dir, `${componentName}.stories.ts`);
		
		if (generateStory(componentPath, storyPath)) {
			generated++;
			console.log(`✅ Generated: ${path.relative('src', storyPath)}`);
		} else {
			skipped++;
		}
	}
	
	console.log(`\n📊 Summary:`);
	console.log(`   Generated: ${generated} working stories`);
	console.log(`   Skipped: ${skipped} (not core components or not React components)`);
	console.log(`\n✨ Done! Only meaningful, working stories created.`);
}

main().catch(console.error);



