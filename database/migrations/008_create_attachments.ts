import { Migration } from "@c9up/atlas";

export default class CreateAttachments extends Migration {
	async up() {
		this.schema.createTable("attachments", (t) => {
			t.uuid("id").primary();
			t.uuid("task_id").notNullable().references("tasks");
			t.uuid("uploaded_by_id").notNullable().references("users");
			t.text("filename").notNullable();
			t.text("content_type").notNullable();
			t.integer("size").notNullable();
			t.text("storage_key").notNullable();
			t.timestamp("created_at").notNullable();
			t.index(["task_id"], "attachments_task_id_idx");
			t.uniqueIndex(["storage_key"], "attachments_storage_key_unique");
		});
	}

	async down() {
		this.schema.dropTable("attachments");
	}
}
