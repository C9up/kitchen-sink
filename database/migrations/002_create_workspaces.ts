import { Migration } from "@c9up/atlas";

export default class CreateWorkspaces extends Migration {
	async up() {
		this.schema.createTable("workspaces", (t) => {
			t.uuid("id").primary();
			t.text("name").notNullable();
			t.text("slug").notNullable();
			t.uuid("owner_id").notNullable().references("users");
			t.timestamp("created_at").notNullable();
			t.timestamp("updated_at").notNullable();
			t.uniqueIndex(["slug"], "workspaces_slug_unique");
			t.index(["owner_id"], "workspaces_owner_id_idx");
		});
	}

	async down() {
		this.schema.dropTable("workspaces");
	}
}
