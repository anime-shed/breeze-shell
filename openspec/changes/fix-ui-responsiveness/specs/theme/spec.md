# Capability: Theme Configuration

## ADDED Requirements

### Requirement: Animation Settings Visual Feedback
The Theme settings SHALL correctly reflect the current animation configuration visually through button selection states.

#### Scenario: Selecting Animation Preset
- **GIVEN** I am on the "Main Config" tab
- **AND** the current animation preset is "default"
- **WHEN** I click on the "Fast" animation button
- **THEN** the "Fast" button SHALL display a highlighted border (selected state)
- **AND** the "default" button SHALL lose its highlighted border
- **AND** the animation settings SHALL be applied to the context menu

#### Scenario: Animation Selection Persists on Page Load
- **GIVEN** I have previously selected the "Fast" animation preset
- **WHEN** I close and reopen the Breeze Config application
- **AND** I navigate to the "Main Config" tab
- **THEN** the "Fast" button SHALL be highlighted (selected state)
- **AND** other animation buttons SHALL NOT be highlighted

#### Scenario: Animation Selection Matches Theme Buttons Behavior
- **GIVEN** I am on the "Main Config" tab
- **WHEN** I observe the "Theme" preset buttons
- **AND** I observe the "Animation" preset buttons
- **THEN** both button groups SHALL exhibit identical selection highlight behavior
- **AND** the currently active preset in each group SHALL show a blue border

#### Scenario: Custom Animation Configuration
- **GIVEN** I have manually configured animation settings that don't match any preset
- **WHEN** I view the animation buttons
- **THEN** no preset button SHALL be highlighted
- **OR** a "Custom" indicator MAY be shown
