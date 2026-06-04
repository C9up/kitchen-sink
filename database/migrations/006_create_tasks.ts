import { Migration } from "@c9up/atlas";

export default class CreateTasks extends Migration {
	async up() {
		this.schema.createTable("tasks", (t) => {
			t.uuid("id").primary();
			t.uuid("project_id").notNullable().references("projects");
			t.text("title").notNullable();
			t.text("description").notNullable().defaultTo("''");
			// CHECK constraints aren't expressed by atlas's TableBuilder today;
			// the application layer enforces valid status/priority via rune.
			t.text("status").notNullable().defaultTo("'todo'");
			t.text("priority").notNullable().defaultTo("'medium'");
			t.uuid("assignee_id").nullable().references("users");
			t.timestamp("due_at").nullable();
			t.text("recurrence_rrule").nullable();
			t.timestamp("created_at").notNullable();
			t.timestamp("updated_at").notNullable();
			t.timestamp("completed_at").nullable();
			t.index(["project_id"], "tasks_project_id_idx");
			t.index(["assignee_id"], "tasks_assignee_id_idx");
			t.index(["status"], "tasks_status_idx");
		});
	}

	async down() {
		this.schema.dropTable("tasks");
	}
}
