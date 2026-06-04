import { Migration } from "@c9up/atlas";

export default class CreateMemberships extends Migration {
	async up() {
		this.schema.createTable("memberships", (t) => {
			t.uuid("id").primary();
			t.uuid("workspace_id").notNullable().references("workspaces");
			t.uuid("user_id").notNullable().references("users");
			// Stored as text — sqlite has no native enum and the surface
			// is small enough that a CHECK constraint in a future
			// migration would be straightforward to add if needed.
			t.text("role").notNullable();
			t.timestamp("joined_at").notNullable();
			// One user can hold at most ONE membership per workspace.
			// Enforced at DB level so the application service can
			// rely on this invariant when joining tables.
			t.uniqueIndex(
				["workspace_id", "user_id"],
				"memberships_workspace_user_unique",
			);
			t.index(["user_id"], "memberships_user_id_idx");
		});
	}

	async down() {
		this.schema.dropTable("memberships");
	}
}
