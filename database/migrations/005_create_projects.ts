import { Migration } from "@c9up/atlas";

export default class CreateProjects extends Migration {
	async up() {
		this.schema.createTable("projects", (t) => {
			t.uuid("id").primary();
			t.uuid("workspace_id").notNullable().references("workspaces");
			t.text("name").notNullable();
			t.text("slug").notNullable();
			t.text("visibility").notNullable().defaultTo("'private'");
			// `descriptions` is JSON-as-text (sqlite has no JSON column type
			// at storage layer; we keep the column kind portable to PG by
			// using `text` rather than the sqlite-specific JSON pragma).
			t.text("descriptions").notNullable().defaultTo("'{}'");
			t.timestamp("created_at").notNullable();
			t.timestamp("updated_at").notNullable();
			t.timestamp("deleted_at").nullable();
			// Slug uniqueness is scoped per-workspace, not global — two
			// workspaces can have a project named "Roadmap" without
			// fighting over `roadmap`.
			t.uniqueIndex(
				["workspace_id", "slug"],
				"projects_workspace_slug_unique",
			);
			t.index(["workspace_id"], "projects_workspace_id_idx");
		});
	}

	async down() {
		this.schema.dropTable("projects");
	}
}
