import { BaseEntity, BelongsTo, Column, Entity, PrimaryKey } from "@c9up/atlas";
import { User } from "#modules/auth/entities/User.js";
import { dateColumn } from "#modules/shared/entities/columnAdapters.js";
import { Task } from "#modules/task/entities/Task.js";

/**
 * Free-form comment on a task. `body` is HTML that has already been
 * sanitised by blackhole at write time — any script / iframe / onclick
 * was stripped before this row landed in DB, so downstream rendering
 * trusts the stored value.
 */
@Entity("comments")
export class Comment extends BaseEntity {
	@PrimaryKey({ generated: "uuid" }) declare id: string;
	@Column() declare taskId: string;
	@Column() declare authorId: string;
	@Column() declare body: string;
	@Column(dateColumn) declare createdAt: Date;

	@BelongsTo(() => Task) declare task: Task;
	@BelongsTo(() => User, { foreignKey: "authorId" }) declare author: User;
}
