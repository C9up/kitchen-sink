/**
 * Shared SSR + hydrate page — same source runs on the server (Node, via
 * @swc-node/register) and in the browser (loaded through aurora's
 * `/__assets/pages/*` mount + the importmap that aliases `@c9up/aurora`).
 *
 * Plain ESM JS on purpose: zero compile step for app code.
 *
 * Props shape (the controller must pass these exact keys; the SSR + the
 * hydrate path see the SAME object):
 *
 *   {
 *     locale: "fr" | "en",
 *     channel: `project/<id>`,
 *     project: { id, name, slug, visibility },
 *     description: string,
 *     tasks: Array<{ id, title, status }>,
 *     commentsCount: number,
 *     labels: { title, visibility, tasksHeading, ... }
 *   }
 *
 * All translation lookups happen server-side and ship inside `labels` —
 * the page itself is i18n-agnostic.
 */

import { component, html, onMount, signal } from "@c9up/aurora";
import { relay } from "@c9up/aurora/relay";

export default component((props) => {
	const tasks = signal(props.tasks ?? []);
	const commentsCount = signal(props.commentsCount ?? 0);
	const liveStatus = signal("idle");

	onMount(() => {
		liveStatus("connecting…");
		const off = relay().subscribe(props.channel, (ev) => {
			liveStatus(`last: ${ev.event}`);
			if (ev.event === "task.assigned") {
				// Append a placeholder — a real app would refetch the
				// task by id. Showing SOMETHING proves the wire is live.
				tasks([
					...tasks(),
					{
						id: ev.taskId,
						title: "(live) new task assignment",
						status: "todo",
					},
				]);
			} else if (ev.event === "comment.added") {
				commentsCount(commentsCount() + 1);
			}
		});
		// Returning a cleanup tells aurora to detach the listener on
		// unmount. Same shape as React's useEffect cleanup.
		return off;
	});

	return html`<main lang="${props.locale}">
		<header>
			<h1>${props.labels.title}</h1>
			<p class="visibility" data-visibility="${props.project.visibility}">
				${props.labels.visibility}
			</p>
			<p class="description">${props.description}</p>
		</header>
		<section class="tasks-section">
			<h2>${props.labels.tasksHeading}</h2>
			${() =>
				tasks().length === 0
					? html`<p class="empty">${props.labels.tasksEmpty}</p>`
					: html`<ul class="tasks">
							${tasks().map(
								(task) =>
									html`<li data-task-id="${task.id}" data-status="${task.status}">
										<span class="title">${task.title}</span>
										<span class="status">${props.labels.taskStatus[task.status]}</span>
									</li>`,
							)}
						</ul>`}
		</section>
		<section class="comments-section">
			<h2>${props.labels.commentsHeading}</h2>
			<p data-comments-count="${() => commentsCount()}">
				${() =>
					commentsCount() === 0
						? props.labels.commentsEmpty
						: String(commentsCount())}
			</p>
		</section>
		<aside class="live" data-status="${() => liveStatus()}">${() => liveStatus()}</aside>
		<footer>
			<small>${props.labels.appName} — ${props.labels.appTagline}</small>
		</footer>
	</main>`;
});
