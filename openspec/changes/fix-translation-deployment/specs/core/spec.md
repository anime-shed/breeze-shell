# Capability: Core Language Support

## ADDED Requirements

### Requirement: Automatic Locale Deployment
The system SHALL ensure essential locale files are present at runtime.

#### Scenario: First Run Initialization
Given a clean installation where `<data_directory>/locales` does not exist
When the application performs initialization (specifically `i18n_manager`)
Then the directory `<data_directory>/locales` MUST be created
And the default locale files (`en-US.json`, `zh-CN.json`) MUST be written to that directory with their default content

#### Scenario: Existing User Customization
Given a user has customized `<data_directory>/locales/en-US.json`
When the application restarts
Then the `en-US.json` file MUST NOT be overwritten
And the user's custom translations MUST be preserved
