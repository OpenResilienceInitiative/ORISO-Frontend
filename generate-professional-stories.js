#!/usr/bin/env node

/**
 * Professional Story Generator
 * Generates enterprise-grade Storybook stories for all components
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Component category mapping
const CATEGORY_MAP = {
	button: 'Forms',
	checkbox: 'Forms',
	inputField: 'Forms',
	radioButton: 'Forms',
	tagSelect: 'Forms',
	text: 'Display',
	headline: 'Display',
	tag: 'Display',
	banner: 'Display',
	box: 'Layout',
	card: 'Layout',
	modal: 'Layout',
	notice: 'Feedback',
	loadingSpinner: 'Feedback',
	loadingIndicator: 'Feedback',
	spinner: 'Feedback',
	notifications: 'Feedback',
	overlay: 'Feedback',
	error: 'Feedback',
	dragAndDropArea: 'UI',
	flyoutMenu: 'UI',
	generateQrCode: 'UI',
	localeSwitch: 'UI',
	progressbar: 'UI',
	editableData: 'Profile',
	sessionsList: 'Session',
	typingIndicator: 'Message',
	profile: 'Profile',
	askerInfo: 'AskerInfo',
	askerInfoTools: 'AskerInfo',
	agencyRadioSelect: 'Registration',
	legalLinks: 'Legal',
	legalPageWrapper: 'Legal'
};

function getComponentExport(componentPath) {
	try {
		const content = fs.readFileSync(componentPath, 'utf-8');
		
		// Try named export: export const ComponentName
		const namedMatch = content.match(/^export\s+(?:const|function|class)\s+([A-Z][a-zA-Z0-9_]*)/m);
		if (namedMatch) {
			return namedMatch[1];
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
	} catch (error) {
		console.error(`Error reading ${componentPath}:`, error.message);
		return null;
	}
}

function getCategory(componentPath) {
	const dirName = path.basename(path.dirname(componentPath));
	const fileName = path.basename(componentPath, path.extname(componentPath));
	const key = fileName === 'index' ? dirName : fileName;
	return CATEGORY_MAP[key] || 'Components';
}

function hasProps(componentPath) {
	try {
		const content = fs.readFileSync(componentPath, 'utf-8');
		return /(interface|type)\s+\w+Props/.test(content) || /props\s*[:=]/.test(content);
	} catch {
		return false;
	}
}

function generateStory(componentPath, storyPath) {
	const componentName = path.basename(componentPath, path.extname(componentPath));
	const exportName = getComponentExport(componentPath);
	const category = getCategory(componentPath);
	const hasPropsInterface = hasProps(componentPath);
	
	if (!exportName) {
		console.warn(`⚠️  Could not determine export for ${componentPath}`);
		return false;
	}
	
	const importPath = componentName === 'index' ? './index' : `./${componentName}`;
	
	const storyContent = `import { Meta, StoryObj } from '@storybook/react';
import { ${exportName} } from '${importPath}';

const meta = {
	title: 'Components/${category}/${exportName}',
	component: ${exportName},
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: '${exportName} component${hasPropsInterface ? ' with configurable props' : ''}.'
			}
		}
	}${hasPropsInterface ? `,
	argTypes: {
		// Auto-generated from component props
	}` : ''}
} satisfies Meta<typeof ${exportName}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {}
};
`;
	
	fs.writeFileSync(storyPath, storyContent, 'utf-8');
	return true;
}

async function main() {
	console.log('🚀 Generating professional Storybook stories...\n');
	
	const componentFiles = await glob('src/components/**/*.{tsx,jsx}', {
		ignore: [
			'**/*.stories.{ts,tsx,js,jsx}',
			'**/*.test.{ts,tsx,js,jsx}',
			'**/node_modules/**',
			'**/registration/**' // Keep existing registration stories
		]
	});
	
	let generated = 0;
	let skipped = 0;
	let errors = 0;
	
	for (const componentPath of componentFiles) {
		const componentName = path.basename(componentPath, path.extname(componentPath));
		const dir = path.dirname(componentPath);
		const storyPath = path.join(dir, `${componentName}.stories.ts`);
		
		// Skip if story already exists (we'll regenerate later if needed)
		if (fs.existsSync(storyPath)) {
			skipped++;
			continue;
		}
		
		if (generateStory(componentPath, storyPath)) {
			generated++;
			console.log(`✅ Generated: ${path.relative('src', storyPath)}`);
		} else {
			errors++;
		}
	}
	
	console.log(`\n📊 Summary:`);
	console.log(`   Generated: ${generated}`);
	console.log(`   Skipped: ${skipped}`);
	console.log(`   Errors: ${errors}`);
	console.log(`\n✨ Done!`);
}

main().catch(console.error);



