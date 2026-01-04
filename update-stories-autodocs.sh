#!/bin/bash

# Convert all stories to modern autodocs format
cd /home/caritas/Desktop/online-beratung/caritas-workspace/ORISO-Frontend-v2

echo "🔄 Converting all stories to autodocs format..."

for story in $(find src/components -name "*.stories.ts" -not -path "*/registration/*"); do
  comp_dir=$(dirname "$story")
  comp_file=$(basename "$story" .stories.ts)
  
  # Get component name from import
  import_line=$(grep "^import" "$story" | head -1)
  comp_name=$(echo "$import_line" | sed -n "s/.*{ \([^}]*\) }.*/\1/p" | sed -n "s/.*from.*/\1/p")
  
  if [ -z "$comp_name" ]; then
    # Try default import
    comp_name=$(echo "$import_line" | sed -n "s/import \([^ ]*\) from.*/\1/p")
  fi
  
  if [ -z "$comp_name" ]; then
    echo "⚠️  Could not determine component name for $story"
    continue
  fi
  
  # Get title
  title=$(grep "title:" "$story" | head -1 | sed -n "s/.*title: '\([^']*\)'.*/\1/p")
  
  if [ -z "$title" ]; then
    echo "⚠️  Could not determine title for $story"
    continue
  fi
  
  # Create new story with autodocs
  cat > "$story" << EOF
import { Meta, StoryObj } from '@storybook/react';

import { ${comp_name} } from './${comp_file}';

const meta = {
	title: '${title}',
	component: ${comp_name},
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: '${comp_name} component'
			}
		}
	}
} satisfies Meta<typeof ${comp_name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {}
};
EOF

  echo "✅ Updated: $title"
done

echo ""
echo "✅ All stories converted to autodocs format!"



