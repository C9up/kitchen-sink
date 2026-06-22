import { Migration } from "@c9up/atlas";

export default class CreateNotifications extends Migration {
	async up() {
		this.schema.createTable("notifications", (t) => {
			t.uuid("id").primary();
			t.uuid("user_id").notNullable().references("users");
			t.text("type").notNullable();
			t.text("payload").notNullable().defaultTo("{}");
			t.timestamp("read_at").nullable();
			t.timestamp("created_at").notNullable();
			// Inbox UI orders by created_at DESC + filters on read_at IS NULL,
			// so a composite (user_id, read_at, created_at) makes both
			// "unread inbox" and "all inbox" scans single-index lookups.
			t.index(["user_id", "read_at"], "notifications_user_read_idx");
			t.index(["user_id", "created_at"], "notifications_user_created_idx");
		});
	}

	async down() {
		this.schema.dropTable("notifications");
	}
}
