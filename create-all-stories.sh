#!/bin/bash

# Create stories for ALL components following the registration pattern
cd /home/caritas/Desktop/online-beratung/caritas-workspace/ORISO-Frontend-v2

echo "📚 Creating stories for ALL components..."

# Function to create a story file
create_story() {
  local comp_dir=$1
  local comp_name=$2
  local category=$3
  local story_file="$comp_dir/${comp_name}.stories.ts"
  
  # Skip if story already exists
  if [ -f "$story_file" ]; then
    echo "⏭️  Skipping $comp_name (story exists)"
    return
  fi
  
  # Check if component file exists
  local comp_file="$comp_dir/${comp_name}.tsx"
  if [ ! -f "$comp_file" ]; then
    # Try index.tsx
    comp_file="$comp_dir/index.tsx"
    if [ ! -f "$comp_file" ]; then
      echo "⚠️  Component file not found for $comp_name"
      return
    fi
  fi
  
  # Extract export name from component file
  export_name=$(grep -E "^export (const|function|class|default)" "$comp_file" | head -1 | sed -n 's/.*export \(const\|function\|class\|default\) \([A-Za-z0-9_]*\).*/\2/p')
  
  if [ -z "$export_name" ]; then
    # Try default export
    if grep -q "export default" "$comp_file"; then
      export_name="${comp_name}"
    else
      echo "⚠️  Could not determine export name for $comp_name"
      return
    fi
  fi
  
  # Create the story file
  cat > "$story_file" << EOF
import { Meta } from '@storybook/react';

import { ${export_name} } from './${comp_name}';

export default {
	title: '${category}/${comp_name}',
	component: ${export_name}
} as Meta<typeof ${export_name}>;

export const Default = {
	args: {}
};
EOF

  echo "✅ Created: $category/${comp_name}"
}

# Core UI Components
create_story "src/components/button" "Button" "Components/Forms"
create_story "src/components/checkbox" "Checkbox" "Components/Forms"
create_story "src/components/radioButton" "RadioButton" "Components/Forms"
create_story "src/components/inputField" "InputField" "Components/Forms"
create_story "src/components/tagSelect" "TagSelect" "Components/Forms"

# Display Components
create_story "src/components/text" "Text" "Components/Display"
create_story "src/components/headline" "Headline" "Components/Display"
create_story "src/components/tag" "Tag" "Components/Display"
create_story "src/components/box" "Box" "Components/Layout"
create_story "src/components/banner" "Banner" "Components/Display"
create_story "src/components/card" "index" "Components/Layout" "Card"

# Feedback Components
create_story "src/components/notice" "Notice" "Components/Feedback"
create_story "src/components/loadingSpinner" "LoadingSpinner" "Components/Feedback"
create_story "src/components/loadingIndicator" "LoadingIndicator" "Components/Feedback"
create_story "src/components/spinner" "Spinner" "Components/Feedback"
create_story "src/components/notifications" "Notifications" "Components/Feedback"
create_story "src/components/overlay" "Overlay" "Components/Feedback"
create_story "src/components/error" "Error" "Components/Feedback"

# Layout Components
create_story "src/components/modal" "Modal" "Components/Layout"

# UI Components
create_story "src/components/dragAndDropArea" "DragAndDropArea" "Components/UI"
create_story "src/components/flyoutMenu" "FlyoutMenu" "Components/UI"
create_story "src/components/generateQrCode" "GenerateQrCode" "Components/UI"
create_story "src/components/localeSwitch" "LocaleSwitch" "Components/UI"
create_story "src/components/progressbar" "ProgressBar" "Components/UI"
create_story "src/components/editableData" "EditableData" "Components/Profile"

# Session/Message Components
create_story "src/components/sessionsList" "SessionsList" "Components/Session"
create_story "src/components/typingIndicator" "typingIndicator" "Components/Message" "TypingIndicator"
create_story "src/components/message" "UserAvatar" "Components/Message"

# Profile Components
create_story "src/components/profile" "Profile" "Components/Profile"
create_story "src/components/askerInfo" "AskerInfo" "Components/AskerInfo"
create_story "src/components/askerInfo" "AskerInfoTools" "Components/AskerInfo"

# Other Components
create_story "src/components/agencyRadioSelect" "AgencyRadioSelect" "Components/Registration"
create_story "src/components/legalLinks" "LegalLinks" "Components/Legal"
create_story "src/components/legalPageWrapper" "LegalPageWrapper" "Components/Legal"

echo ""
echo "✅ Done! Created stories for all components"



