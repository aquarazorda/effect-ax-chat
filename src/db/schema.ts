export { organization } from "./schemas/auth/organization";
export { user } from "./schemas/auth/user";
export { user_preferences } from "./schemas/auth/userPreferences";

export { chain_run_table } from "./schemas/builder/chainRunTable";
export { application_group } from "./schemas/builder/applicationGroup";
export { automation_rule } from "./schemas/builder/automationRule";
export { email } from "./schemas/builder/email";
export { gmail_message_processing_queue } from "./schemas/builder/gmailMessageProcessingQueue";

import { organization } from "./schemas/auth/organization";
import { user } from "./schemas/auth/user";
import { user_preferences } from "./schemas/auth/userPreferences";
import { chain_run_table } from "./schemas/builder/chainRunTable";
import { application_group } from "./schemas/builder/applicationGroup";
import { automation_rule } from "./schemas/builder/automationRule";
import { email } from "./schemas/builder/email";
import { gmail_message_processing_queue } from "./schemas/builder/gmailMessageProcessingQueue";

export const dbSchema = {
  organization,
  user,
  user_preferences,
  chain_run_table,
  application_group,
  automation_rule,
  email,
  gmail_message_processing_queue,
};

