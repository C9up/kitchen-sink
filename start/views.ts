/**
 * The one route that renders a template.
 *
 * It exists for the chain behind it rather than the page: `t()` in the markup
 * is rosetta's, and rosetta never touches the engine directly. It pushes a
 * plugin into inker's module singleton during its own boot — before the engine
 * is built — and the engine runs it just before this first render. A page that
 * says "Kitchen Sink" proves the whole handoff.
 *
 * `bio` comes from the query string on purpose: escaping by default is the
 * property worth proving against input nobody controls.
 */
import inker from "@c9up/inker/services/main";
import router from "@c9up/ream/services/router";

router.get("/views/profile", async (ctx) => {
	await inker.render(ctx, "profile", {
		bio: String(ctx.request.input("bio") ?? ""),
		trusted: "<em>trusted</em>",
	});
});
