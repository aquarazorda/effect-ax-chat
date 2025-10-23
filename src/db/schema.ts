export { organization } from "./schemas/auth/organization";
export { user } from "./schemas/auth/user";
export { user_preferences } from "./schemas/auth/userPreferences";
export { inbox_connection } from "./schemas/auth/inboxConnection";
export { inbox_connection_sync_job } from "./schemas/auth/inboxConnectionSyncJob";
export { organization_user } from "./schemas/auth/organizationUser";
export { organization_user_entity_id } from "./schemas/auth/organizationUserEntityId";

export { chain_run_table } from "./schemas/builder/chainRunTable";
export { application_group } from "./schemas/builder/applicationGroup";
export { automation_rule } from "./schemas/builder/automationRule";
export { email } from "./schemas/builder/email";
export { gmail_message_processing_queue } from "./schemas/builder/gmailMessageProcessingQueue";
export { action_draft_email_extracted_input } from "./schemas/builder/actionDraftEmailExtractedInput";
export { action_edits_history } from "./schemas/builder/actionEditsHistory";
export { action_log } from "./schemas/builder/actionLog";
export { athena_onboarding_state } from "./schemas/builder/athenaOnboardingState";
export { automation_execution } from "./schemas/builder/automationExecution";
export { category } from "./schemas/builder/category";
export { category_with_entity_type } from "./schemas/builder/categoryWithEntityType";
export { crm_cache } from "./schemas/builder/crmCache";
export { custom_views } from "./schemas/builder/customViews";
export { data_model_action } from "./schemas/builder/dataModelAction";
export { data_model_ai_column_metadata } from "./schemas/builder/dataModelAiColumnMetadata";
export { data_model_ai_relation_metadata } from "./schemas/builder/dataModelAiRelationMetadata";
export { data_model_authorization } from "./schemas/builder/dataModelAuthorization";
export { data_model_entity_relation } from "./schemas/builder/dataModelEntityRelation";
export { data_model_entity_type } from "./schemas/builder/dataModelEntityType";
export { data_model_entity_type_column } from "./schemas/builder/dataModelEntityTypeColumn";
export { data_model_entity_type_column_validation } from "./schemas/builder/dataModelEntityTypeColumnValidation";
export { data_model_entity_type_version } from "./schemas/builder/dataModelEntityTypeVersion";
export { data_model_validation_group } from "./schemas/builder/dataModelValidationGroup";
export { data_store_config } from "./schemas/builder/dataStoreConfig";
export { derived_column_computation } from "./schemas/builder/derivedColumnComputation";
export { derived_column_metadata } from "./schemas/builder/derivedColumnMetadata";
export { derived_relation_computation } from "./schemas/builder/derivedRelationComputation";
export { derived_relation_metadata } from "./schemas/builder/derivedRelationMetadata";
export { email_extracted_action_input } from "./schemas/builder/emailExtractedActionInput";
export { email_processing } from "./schemas/builder/emailProcessing";
export { entity_action_draft } from "./schemas/builder/entityActionDraft";
export { entity_comment } from "./schemas/builder/entityComment";
export { entity_enrichment_processing } from "./schemas/builder/entityEnrichmentProcessing";
export { entity_type_edits_history } from "./schemas/builder/entityTypeEditsHistory";
export { feature_application_run } from "./schemas/builder/featureApplicationRun";
export { feature_application_run_features } from "./schemas/builder/featureApplicationRunFeatures";
export { feature_suggestions_run } from "./schemas/builder/featureSuggestionsRun";
export { features } from "./schemas/builder/features";
export { field_group } from "./schemas/builder/fieldGroup";
export { lock_user_entity_type } from "./schemas/builder/lockUserEntityType";
export { onboarding_session } from "./schemas/builder/onboardingSession";
export { relation_edits_history } from "./schemas/builder/relationEditsHistory";
export { state_machine_metadata } from "./schemas/builder/stateMachineMetadata";
export { state_machine_state } from "./schemas/builder/stateMachineState";
export { state_machine_transition } from "./schemas/builder/stateMachineTransition";
export { version_refs } from "./schemas/builder/versionRefs";
export { workspace_version } from "./schemas/builder/workspaceVersion";
export { workspace_version_action_version } from "./schemas/builder/workspaceVersionActionVersion";
export { workspace_version_entity_type_version } from "./schemas/builder/workspaceVersionEntityTypeVersion";
export { workspace_version_relation_version } from "./schemas/builder/workspaceVersionRelationVersion";
export { workspace_version_state_machine_metadata_version } from "./schemas/builder/workspaceVersionStateMachineMetadataVersion";
export { fake_ai_columns_computation_table } from "./schemas/builder/fakeAiColumnsComputationTable";
export { fake_ai_relations_computation_table } from "./schemas/builder/fakeAiRelationsComputationTable";
export { fake_data_entity_type_retrieval_pointer } from "./schemas/builder/fakeDataEntityTypeRetrievalPointer";
export { fake_m2m_table } from "./schemas/builder/fakeM2mTable";

// billing_tracking
export { billing_event_queue } from "./schemas/billing_tracking/billingEventQueue";
export { customer } from "./schemas/billing_tracking/customer";
export { invoice } from "./schemas/billing_tracking/invoice";
export { organization_subscription } from "./schemas/billing_tracking/organizationSubscription";
export { usage_metrics } from "./schemas/billing_tracking/usageMetrics";

// marketing
export { blog_posts } from "./schemas/marketing/blogPosts";
export { homepage_generation } from "./schemas/marketing/homepageGeneration";
export { homepage_generation_share } from "./schemas/marketing/homepageGenerationShare";
export { homepage_generation_share_view } from "./schemas/marketing/homepageGenerationShareView";
export { industry } from "./schemas/marketing/industry";
export { landing_page } from "./schemas/marketing/landingPage";
export { vertical } from "./schemas/marketing/vertical";

// public
export { kysely_migration } from "./schemas/public/kyselyMigration";
export { kysely_migration_lock } from "./schemas/public/kyselyMigrationLock";

import { organization } from "./schemas/auth/organization";
import { user } from "./schemas/auth/user";
import { user_preferences } from "./schemas/auth/userPreferences";
import { inbox_connection } from "./schemas/auth/inboxConnection";
import { inbox_connection_sync_job } from "./schemas/auth/inboxConnectionSyncJob";
import { organization_user } from "./schemas/auth/organizationUser";
import { organization_user_entity_id } from "./schemas/auth/organizationUserEntityId";
import { chain_run_table } from "./schemas/builder/chainRunTable";
import { application_group } from "./schemas/builder/applicationGroup";
import { automation_rule } from "./schemas/builder/automationRule";
import { email } from "./schemas/builder/email";
import { gmail_message_processing_queue } from "./schemas/builder/gmailMessageProcessingQueue";
import { action_draft_email_extracted_input } from "./schemas/builder/actionDraftEmailExtractedInput";
import { action_edits_history } from "./schemas/builder/actionEditsHistory";
import { action_log } from "./schemas/builder/actionLog";
import { athena_onboarding_state } from "./schemas/builder/athenaOnboardingState";
import { automation_execution } from "./schemas/builder/automationExecution";
import { category } from "./schemas/builder/category";
import { category_with_entity_type } from "./schemas/builder/categoryWithEntityType";
import { crm_cache } from "./schemas/builder/crmCache";
import { custom_views } from "./schemas/builder/customViews";
import { data_model_action } from "./schemas/builder/dataModelAction";
import { data_model_ai_column_metadata } from "./schemas/builder/dataModelAiColumnMetadata";
import { data_model_ai_relation_metadata } from "./schemas/builder/dataModelAiRelationMetadata";
import { data_model_authorization } from "./schemas/builder/dataModelAuthorization";
import { data_model_entity_relation } from "./schemas/builder/dataModelEntityRelation";
import { data_model_entity_type } from "./schemas/builder/dataModelEntityType";
import { data_model_entity_type_column } from "./schemas/builder/dataModelEntityTypeColumn";
import { data_model_entity_type_column_validation } from "./schemas/builder/dataModelEntityTypeColumnValidation";
import { data_model_entity_type_version } from "./schemas/builder/dataModelEntityTypeVersion";
import { data_model_validation_group } from "./schemas/builder/dataModelValidationGroup";
import { data_store_config } from "./schemas/builder/dataStoreConfig";
import { derived_column_computation } from "./schemas/builder/derivedColumnComputation";
import { derived_column_metadata } from "./schemas/builder/derivedColumnMetadata";
import { derived_relation_computation } from "./schemas/builder/derivedRelationComputation";
import { derived_relation_metadata } from "./schemas/builder/derivedRelationMetadata";
import { email_extracted_action_input } from "./schemas/builder/emailExtractedActionInput";
import { email_processing } from "./schemas/builder/emailProcessing";
import { entity_action_draft } from "./schemas/builder/entityActionDraft";
import { entity_comment } from "./schemas/builder/entityComment";
import { entity_enrichment_processing } from "./schemas/builder/entityEnrichmentProcessing";
import { entity_type_edits_history } from "./schemas/builder/entityTypeEditsHistory";
import { feature_application_run } from "./schemas/builder/featureApplicationRun";
import { feature_application_run_features } from "./schemas/builder/featureApplicationRunFeatures";
import { feature_suggestions_run } from "./schemas/builder/featureSuggestionsRun";
import { features } from "./schemas/builder/features";
import { field_group } from "./schemas/builder/fieldGroup";
import { lock_user_entity_type } from "./schemas/builder/lockUserEntityType";
import { onboarding_session } from "./schemas/builder/onboardingSession";
import { relation_edits_history } from "./schemas/builder/relationEditsHistory";
import { state_machine_metadata } from "./schemas/builder/stateMachineMetadata";
import { state_machine_state } from "./schemas/builder/stateMachineState";
import { state_machine_transition } from "./schemas/builder/stateMachineTransition";
import { version_refs } from "./schemas/builder/versionRefs";
import { workspace_version } from "./schemas/builder/workspaceVersion";
import { workspace_version_action_version } from "./schemas/builder/workspaceVersionActionVersion";
import { workspace_version_entity_type_version } from "./schemas/builder/workspaceVersionEntityTypeVersion";
import { workspace_version_relation_version } from "./schemas/builder/workspaceVersionRelationVersion";
import { workspace_version_state_machine_metadata_version } from "./schemas/builder/workspaceVersionStateMachineMetadataVersion";
import { fake_ai_columns_computation_table } from "./schemas/builder/fakeAiColumnsComputationTable";
import { fake_ai_relations_computation_table } from "./schemas/builder/fakeAiRelationsComputationTable";
import { fake_data_entity_type_retrieval_pointer } from "./schemas/builder/fakeDataEntityTypeRetrievalPointer";
import { fake_m2m_table } from "./schemas/builder/fakeM2mTable";

import { billing_event_queue } from "./schemas/billing_tracking/billingEventQueue";
import { customer } from "./schemas/billing_tracking/customer";
import { invoice } from "./schemas/billing_tracking/invoice";
import { organization_subscription } from "./schemas/billing_tracking/organizationSubscription";
import { usage_metrics } from "./schemas/billing_tracking/usageMetrics";

import { blog_posts } from "./schemas/marketing/blogPosts";
import { homepage_generation } from "./schemas/marketing/homepageGeneration";
import { homepage_generation_share } from "./schemas/marketing/homepageGenerationShare";
import { homepage_generation_share_view } from "./schemas/marketing/homepageGenerationShareView";
import { industry } from "./schemas/marketing/industry";
import { landing_page } from "./schemas/marketing/landingPage";
import { vertical } from "./schemas/marketing/vertical";

import { kysely_migration } from "./schemas/public/kyselyMigration";
import { kysely_migration_lock } from "./schemas/public/kyselyMigrationLock";

export const dbSchema = {
  organization,
  user,
  user_preferences,
  inbox_connection,
  inbox_connection_sync_job,
  organization_user,
  organization_user_entity_id,
  chain_run_table,
  application_group,
  automation_rule,
  email,
  gmail_message_processing_queue,
  fake_ai_columns_computation_table,
  fake_ai_relations_computation_table,
  fake_data_entity_type_retrieval_pointer,
  fake_m2m_table,
  action_draft_email_extracted_input,
  action_edits_history,
  action_log,
  athena_onboarding_state,
  automation_execution,
  category,
  category_with_entity_type,
  crm_cache,
  custom_views,
  data_model_action,
  data_model_ai_column_metadata,
  data_model_ai_relation_metadata,
  data_model_authorization,
  data_model_entity_relation,
  data_model_entity_type,
  data_model_entity_type_column,
  data_model_entity_type_column_validation,
  data_model_entity_type_version,
  data_model_validation_group,
  data_store_config,
  derived_column_computation,
  derived_column_metadata,
  derived_relation_computation,
  derived_relation_metadata,
  email_extracted_action_input,
  email_processing,
  entity_action_draft,
  entity_comment,
  entity_enrichment_processing,
  entity_type_edits_history,
  feature_application_run,
  feature_application_run_features,
  feature_suggestions_run,
  features,
  field_group,
  lock_user_entity_type,
  onboarding_session,
  relation_edits_history,
  state_machine_metadata,
  state_machine_state,
  state_machine_transition,
  version_refs,
  workspace_version,
  workspace_version_action_version,
  workspace_version_entity_type_version,
  workspace_version_relation_version,
  workspace_version_state_machine_metadata_version,
  // billing_tracking
  billing_event_queue,
  customer,
  invoice,
  organization_subscription,
  usage_metrics,
  // marketing
  blog_posts,
  homepage_generation,
  homepage_generation_share,
  homepage_generation_share_view,
  industry,
  landing_page,
  vertical,
  // public (kysely)
  kysely_migration,
  kysely_migration_lock,
};
