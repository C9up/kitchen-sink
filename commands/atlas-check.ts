/**
 * `atlas:check` — verify the app's models match the live database schema.
 *
 * Registered in `reamrc.ts` (`commands`) and dispatched by the console kernel
 * (`bin/console.ts`). Run with: `pnpm atlas:check` (add `--warn` for an
 * advisory, non-failing run). Atlas has no global entity registry, so the
 * app lists its models here — mirrors Lucid, where `ace` is pointed at models.
 */
import { schemaCheckCommand } from "@c9up/atlas";
import { User } from "#modules/auth/entities/User.js";
import { Comment } from "#modules/comment/entities/Comment.js";
import { Notification } from "#modules/notification/entities/Notification.js";
import { Attachment } from "#modules/attachment/entities/Attachment.js";
import { Project } from "#modules/project/entities/Project.js";
import { Task } from "#modules/task/entities/Task.js";
import { Invitation } from "#modules/workspace/entities/Invitation.js";
import { Membership } from "#modules/workspace/entities/Membership.js";
import { Workspace } from "#modules/workspace/entities/Workspace.js";

export default schemaCheckCommand([
	User,
	Workspace,
	Membership,
	Invitation,
	Project,
	Task,
	Comment,
	Attachment,
	Notification,
]);
