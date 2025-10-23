import * as S from "effect/Schema";

// Helper: define schemas and inferred types for branded IDs

// Organization / Auth context
export const OrganizationIdSchema = S.String.pipe(S.brand("OrganizationId"));
export type OrganizationId = typeof OrganizationIdSchema.Type;

export const UserIdSchema = S.String.pipe(S.brand("UserId"));
export type UserId = typeof UserIdSchema.Type;

// Application grouping and workspace
export const ApplicationGroupIdSchema = S.String.pipe(
  S.brand("ApplicationGroupId"),
);
export type ApplicationGroupId = typeof ApplicationGroupIdSchema.Type;

export const WorkspaceVersionIdSchema = S.String.pipe(
  S.brand("WorkspaceVersionId"),
);
export type WorkspaceVersionId = typeof WorkspaceVersionIdSchema.Type;

// Data model: entity types, actions, relations, states, columns
export const EntityTypeIdSchema = S.String.pipe(S.brand("EntityTypeId"));
export type EntityTypeId = typeof EntityTypeIdSchema.Type;

export const EntityTypeVersionIdSchema = S.String.pipe(
  S.brand("EntityTypeVersionId"),
);
export type EntityTypeVersionId = typeof EntityTypeVersionIdSchema.Type;

export const ActionIdSchema = S.String.pipe(S.brand("ActionId"));
export type ActionId = typeof ActionIdSchema.Type;

export const ActionVersionIdSchema = S.String.pipe(S.brand("ActionVersionId"));
export type ActionVersionId = typeof ActionVersionIdSchema.Type;

export const RelationIdSchema = S.String.pipe(S.brand("RelationId"));
export type RelationId = typeof RelationIdSchema.Type;

export const RelationVersionIdSchema = S.String.pipe(
  S.brand("RelationVersionId"),
);
export type RelationVersionId = typeof RelationVersionIdSchema.Type;

export const ColumnIdSchema = S.String.pipe(S.brand("ColumnId"));
export type ColumnId = typeof ColumnIdSchema.Type;

export const ColumnValidationIdSchema = S.String.pipe(
  S.brand("ColumnValidationId"),
);
export type ColumnValidationId = typeof ColumnValidationIdSchema.Type;

export const StateIdSchema = S.String.pipe(S.brand("StateId"));
export type StateId = typeof StateIdSchema.Type;

export const TransitionIdSchema = S.String.pipe(S.brand("TransitionId"));
export type TransitionId = typeof TransitionIdSchema.Type;

export const FieldGroupIdSchema = S.String.pipe(S.brand("FieldGroupId"));
export type FieldGroupId = typeof FieldGroupIdSchema.Type;

export const ViewFieldIdSchema = S.String.pipe(S.brand("ViewFieldId"));
export type ViewFieldId = typeof ViewFieldIdSchema.Type;

// Entities and domain objects
export const EntityIdSchema = S.String.pipe(S.brand("EntityId"));
export type EntityId = typeof EntityIdSchema.Type;

export const UserEntityIdSchema = S.String.pipe(S.brand("UserEntityId"));
export type UserEntityId = typeof UserEntityIdSchema.Type;

export const EmailIdSchema = S.String.pipe(S.brand("EmailId"));
export type EmailId = typeof EmailIdSchema.Type;

export const MessageIdSchema = S.String.pipe(S.brand("MessageId"));
export type MessageId = typeof MessageIdSchema.Type;

export const WebhookMessageIdSchema = S.String.pipe(
  S.brand("WebhookMessageId"),
);
export type WebhookMessageId = typeof WebhookMessageIdSchema.Type;

export const GmailMessageProcessingQueueIdSchema = S.String.pipe(
  S.brand("GmailMessageProcessingQueueId"),
);
export type GmailMessageProcessingQueueId =
  typeof GmailMessageProcessingQueueIdSchema.Type;

export const InboxConnectionIdSchema = S.String.pipe(
  S.brand("InboxConnectionId"),
);
export type InboxConnectionId = typeof InboxConnectionIdSchema.Type;

export const InboxConnectionSyncJobIdSchema = S.String.pipe(
  S.brand("InboxConnectionSyncJobId"),
);
export type InboxConnectionSyncJobId =
  typeof InboxConnectionSyncJobIdSchema.Type;

export const CategoryIdSchema = S.String.pipe(S.brand("CategoryId"));
export type CategoryId = typeof CategoryIdSchema.Type;

export const CategoryWithEntityTypeIdSchema = S.String.pipe(
  S.brand("CategoryWithEntityTypeId"),
);
export type CategoryWithEntityTypeId =
  typeof CategoryWithEntityTypeIdSchema.Type;

export const CustomViewIdSchema = S.String.pipe(S.brand("CustomViewId"));
export type CustomViewId = typeof CustomViewIdSchema.Type;

export const CRMCacheIdSchema = S.String.pipe(S.brand("CRMCacheId"));
export type CRMCacheId = typeof CRMCacheIdSchema.Type;

export const ActionLogIdSchema = S.String.pipe(S.brand("ActionLogId"));
export type ActionLogId = typeof ActionLogIdSchema.Type;

export const ChainRunIdSchema = S.String.pipe(S.brand("ChainRunId"));
export type ChainRunId = typeof ChainRunIdSchema.Type;

export const AutomationRuleIdSchema = S.String.pipe(
  S.brand("AutomationRuleId"),
);
export type AutomationRuleId = typeof AutomationRuleIdSchema.Type;

export const AthenaOnboardingStateIdSchema = S.String.pipe(
  S.brand("AthenaOnboardingStateId"),
);
export type AthenaOnboardingStateId = typeof AthenaOnboardingStateIdSchema.Type;

export const EmailProcessingIdSchema = S.String.pipe(
  S.brand("EmailProcessingId"),
);
export type EmailProcessingId = typeof EmailProcessingIdSchema.Type;

export const EntityCommentIdSchema = S.String.pipe(S.brand("EntityCommentId"));
export type EntityCommentId = typeof EntityCommentIdSchema.Type;

export const EntityEnrichmentProcessingIdSchema = S.String.pipe(
  S.brand("EntityEnrichmentProcessingId"),
);
export type EntityEnrichmentProcessingId =
  typeof EntityEnrichmentProcessingIdSchema.Type;

export const OnboardingSessionIdSchema = S.String.pipe(
  S.brand("OnboardingSessionId"),
);
export type OnboardingSessionId = typeof OnboardingSessionIdSchema.Type;

export const StateMachineMetadataVersionIdSchema = S.String.pipe(
  S.brand("StateMachineMetadataVersionId"),
);
export type StateMachineMetadataVersionId =
  typeof StateMachineMetadataVersionIdSchema.Type;

export const StateMachineMetadataIdSchema = S.String.pipe(
  S.brand("StateMachineMetadataId"),
);
export type StateMachineMetadataId = typeof StateMachineMetadataIdSchema.Type;

export const FeatureApplicationRunIdSchema = S.String.pipe(
  S.brand("FeatureApplicationRunId"),
);
export type FeatureApplicationRunId = typeof FeatureApplicationRunIdSchema.Type;

export const FeatureIdSchema = S.String.pipe(S.brand("FeatureId"));
export type FeatureId = typeof FeatureIdSchema.Type;

export const FeatureSuggestionsRunIdSchema = S.String.pipe(
  S.brand("FeatureSuggestionsRunId"),
);
export type FeatureSuggestionsRunId = typeof FeatureSuggestionsRunIdSchema.Type;

export const VersionedEntityIdSchema = S.String.pipe(
  S.brand("VersionedEntityId"),
);
export type VersionedEntityId = typeof VersionedEntityIdSchema.Type;

export const DerivedColumnComputationIdSchema = S.String.pipe(
  S.brand("DerivedColumnComputationId"),
);
export type DerivedColumnComputationId =
  typeof DerivedColumnComputationIdSchema.Type;

export const DerivedRelationComputationIdSchema = S.String.pipe(
  S.brand("DerivedRelationComputationId"),
);
export type DerivedRelationComputationId =
  typeof DerivedRelationComputationIdSchema.Type;
