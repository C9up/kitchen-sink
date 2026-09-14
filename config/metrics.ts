import { defineConfig, drivers } from "@c9up/parsec";

/**
 * Metrics.
 *
 * `maxSeries` is the cardinality cap per instrument: a label fed from a
 * request turns a counter into a map nothing ever evicts. Past the cap, new
 * label combinations are refused and counted in
 * `parsec_series_dropped_total`.
 */
export default defineConfig({
	default: "prometheus",

	exporters: {
		prometheus: drivers.prometheus({ maxSeries: 1000 }),
		noop: drivers.noop(),
	},
});
