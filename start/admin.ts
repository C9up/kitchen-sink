/**
 * One resource in the admin, so station actually has a surface.
 *
 * Station mounts nothing until the first resource is declared — an
 * application with no resources has no admin — and a resource has to be
 * declared in a preload, because providers start before preloads run.
 *
 * Read-only on purpose: the write actions need a rune schema per entity, and
 * what is worth proving here is that the admin is mounted, rendered through
 * the shared template engine, and closed to anyone who is not signed in.
 */

import { defineResource } from "@c9up/station";
import station from "@c9up/station/services/main";
import { Project } from "#modules/project/entities/Project.js";

station.register(
	defineResource({
		entity: Project,
		label: "Projects",
		actions: ["list", "show"],
	}),
);
