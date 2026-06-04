import { BaseEvent } from "@c9up/ream/events";

/**
 * Emitted when a task gets a new assignee. Carries the IDs only —
 * listeners re-fetch the task / user if they need more, so the event
 * payload stays small and serializable across the event bus.
 */
export class TaskAssigned extends BaseEvent {
	constructor(
		public readonly taskId: string,
		public readonly projectId: string,
		public readonly assigneeId: string,
		public readonly byUserId: string,
	) {
		super();
	}
}

/**
 * Emitted whenever a comment lands on a task. Used by the
 * notification fan-out to notify the task's assignee (when set)
 * and anyone else watching the task in future versions.
 */
export class CommentAdded extends BaseEvent {
	constructor(
		public readonly commentId: string,
		public readonly taskId: string,
		public readonly projectId: string,
		public readonly authorId: string,
		public readonly bodyExcerpt: string,
	) {
		super();
	}
}

/** Emitted when a task transitions to status=done. */
export class TaskCompleted extends BaseEvent {
	constructor(
		public readonly taskId: string,
		public readonly projectId: string,
		public readonly completedByUserId: string,
	) {
		super();
	}
}
