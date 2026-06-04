import { Migration } from "@c9up/atlas";

export default class CreateComments extends Migration {
	async up() {
		this.schema.createTable("comments", (t) => {
			t.uuid("id").primary();
			t.uuid("task_id").notNullable().references("tasks");
			t.uuid("author_id").notNullable().references("users");
			// Already-sanitized HTML written by the comment controller. The
			// sanitisation pass is non-negotiable: blackholeMiddleware does
			// it globally for responses, but inbound bodies need an
			// explicit `bh.sanitizeResponse(body, "text/html")` call before
			// insertion — see CommentController.
			t.text("body").notNullable();
			t.timestamp("created_at").notNullable();
			t.index(["task_id"], "comments_task_id_idx");
		});
	}

	async down() {
		this.schema.dropTable("comments");
	}
}
