import { Migration } from "@c9up/atlas";

export default class CreateInvitations extends Migration {
	async up() {
		this.schema.createTable("invitations", (t) => {
			t.uuid("id").primary();
			t.uuid("workspace_id").notNullable().references("workspaces");
			t.text("email").notNullable();
			// 64 hex chars from sigil.randomHex(32). Unique so the
			// accept endpoint can look up by token alone.
			t.text("token").notNullable();
			t.text("role").notNullable();
			t.timestamp("expires_at").notNullable();
			t.timestamp("accepted_at").nullable();
			t.timestamp("created_at").notNullable();
			t.uniqueIndex(["token"], "invitations_token_unique");
			t.index(["workspace_id"], "invitations_workspace_id_idx");
			t.index(["email"], "invitations_email_idx");
		});
	}

	async down() {
		this.schema.dropTable("invitations");
	}
}
