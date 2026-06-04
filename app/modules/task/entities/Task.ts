import { BaseEntity, BelongsTo, Column, Entity, PrimaryKey } from "@c9up/atlas";
import { User } from "#modules/auth/entities/User.js";
import { Project } from "#modules/project/entities/Project.js";
import { dateColumn } from "#modules/shared/entities/columnAdapters.js";

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "medium" | "high";

/**
 * Task = unit of work inside a project. Status transitions emit
 * `TaskStatusChanged` events via the bus; assignment changes emit
 * `TaskAssigned`. The bay queue picks those up and fans out to
 * email (rover) + push (nova) + in-app (Notification).
 *
 * `dueAt` is the resolved due date (parsed via chronos at create
 * time so the wire format can be ISO or human-friendly). `recurrenceRrule`
 * stores the raw RFC-5545 RRULE string when set; consumers expand it
 * via chronos.expandRRule to render upcoming instances.
 */
@Entity("tasks")
export class Task extends BaseEntity {
	@PrimaryKey({ generated: "uuid" }) declare id: string;
	@Column() declare projectId: string;
	@Column() declare title: string;
	@Column() declare description: string;
	@Column() declare status: TaskStatus;
	@Column() declare priority: TaskPriority;
	@Column() declare assigneeId: string | null;
	@Column(dateColumn) declare dueAt: Date | null;
	@Column() declare recurrenceRrule: string | null;
	@Column(dateColumn) declare createdAt: Date;
	@Column(dateColumn) declare updatedAt: Date;
	@Column(dateColumn) declare completedAt: Date | null;

	@BelongsTo(() => Project) declare project: Project;
	@BelongsTo(() => User, { foreignKey: "assigneeId" }) declare assignee: User | null;
}
