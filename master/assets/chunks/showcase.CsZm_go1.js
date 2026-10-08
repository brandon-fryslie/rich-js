import{l as t}from"./164122d0914b7327.68XUuyrw.js";const e=t+`
const { BarColumn, ColorSpec, Layout, Live, Panel, Progress, RichText, Segment, SpinnerColumn, Style, Table, TaskProgressColumn, TextColumn, Tree, regionRows, withCellWidth } = __richLibrary["@promptctl/rich-js"];
//#region examples/showcase/showcase.ts
/**
* showcase — the program the docs site's landing page runs in its hero
* terminal (docs/.vitepress/theme/RichShowcase.ts). It needs no input and
* never ends: a full-screen dashboard of the library's renderables, most of
* them moving, drawn the way any program would draw them.
*
* Every moving pane is a function of the seconds since the program started,
* and the loop only asks for the frame at that moment, so the dashboard is
* already full in its first frame, the one a reader who asked for reduced
* motion is shown (theme/live-terminal.ts).
*
* It imports the library only through its entry points: the docs site runs it
* on the library every live example shares, and a deep import would bundle a
* second copy of the code it names.
*/
var SERVICES = [
	{
		name: "api-gateway",
		latency: 12,
		load: 1840,
		phase: 0
	},
	{
		name: "auth",
		latency: 31,
		load: 612,
		phase: 1.3
	},
	{
		name: "search",
		latency: 88,
		load: 947,
		phase: 2.1
	},
	{
		name: "billing",
		latency: 45,
		load: 203,
		phase: 3.7
	},
	{
		name: "render-farm",
		latency: 140,
		load: 77,
		phase: 4.4
	},
	{
		name: "notifications",
		latency: 22,
		load: 1290,
		phase: 5.2
	},
	{
		name: "storage",
		latency: 9,
		load: 3310,
		phase: .8
	},
	{
		name: "metrics",
		latency: 17,
		load: 2650,
		phase: 2.9
	}
];
/** A swing between -1 and 1, the sum of two waves so it never looks periodic. */
var swing = (t, phase) => (Math.sin(t * 1.7 + phase) + Math.sin(t * .61 + phase * 2.3)) / 2;
/** How far above its mean a service's latency swings before it reads as slow. */
var SLOW = .55;
function services(t) {
	const table = new Table({
		title: "Services",
		caption: "p50 latency and load, live",
		expand: true,
		borderStyle: "bright_black",
		headerStyle: "bold"
	});
	table.addColumn("Service", {
		style: "cyan",
		noWrap: true
	});
	table.addColumn("p50", { justify: "right" });
	table.addColumn("req/s", { justify: "right" });
	table.addColumn("Status", { noWrap: true });
	for (const service of SERVICES) {
		const s = swing(t, service.phase);
		const slow = s > SLOW;
		const latency = Math.round(service.latency * (1 + .6 * s));
		const load = Math.round(service.load * (1 - .3 * s));
		table.addRow(service.name, slow ? \`[yellow]\${latency} ms[/]\` : \`\${latency} ms\`, load.toLocaleString("en-US"), slow ? "[yellow]● slow[/]" : "[green]● up[/]");
	}
	return table;
}
/**
* Truecolor: each cell is two pixels, an upper half block in one colour over
* a background of the next, and the hues drift with time.
*/
var Spectrum = class {
	t;
	constructor(t) {
		this.t = t;
	}
	*render(options) {
		const width = withCellWidth(options).maxWidth;
		const rows = regionRows(options.height) ?? 5;
		const colour = (x, y) => hsl(x / width * 360 + this.t * 40, .85, .72 - y / (rows * 2) * .5);
		for (let row = 0; row < rows; row++) {
			for (let x = 0; x < width; x++) yield new Segment("▀", Style.fromColor(colour(x, row * 2), colour(x, row * 2 + 1)));
			yield Segment.line();
		}
	}
};
/** A truecolor colour, from a hue in degrees and a saturation and lightness in 0–1. */
function hsl(hue, saturation, lightness) {
	const a = saturation * Math.min(lightness, 1 - lightness);
	const channel = (n) => {
		const k = (n + hue / 30) % 12;
		return Math.round((lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
	};
	return ColorSpec.fromRgb(channel(0), channel(8), channel(4));
}
/** Jobs that fill at their own pace and start over when full. */
var JOBS = [
	{
		description: "Rendering frames",
		seconds: 5.5,
		offset: .35
	},
	{
		description: "Downloading assets",
		seconds: 8,
		offset: .6
	},
	{
		description: "Compiling shaders",
		seconds: 3.2,
		offset: .1
	},
	{
		description: "Indexing docs",
		seconds: 11,
		offset: .8
	},
	{
		description: "Uploading build",
		seconds: 6.5,
		offset: .45
	}
];
var STEPS = 1e3;
var jobs = new Progress(new SpinnerColumn("dots"), new TextColumn("[progress.description]{task.description}"), new BarColumn(32), new TaskProgressColumn(), { expand: true });
var tasks = JOBS.map((job) => jobs.addTask(job.description, { total: STEPS }));
var project = new Tree("[bold]rich-js", { guide_style: "bright_black" });
project.add("[magenta]core").add("console.ts");
project.add("[magenta]renderables").add("table.ts");
var heading = new RichText("");
heading.append("rich-js", Style.parse("bold magenta"));
heading.append(" · beautiful terminal output for TypeScript", Style.parse("dim"));
var root = new Layout(void 0, { name: "root" });
root.splitColumn(new Layout(new Panel(heading, {
	expand: true,
	borderStyle: "magenta"
}), {
	name: "heading",
	size: 3
}), new Layout(void 0, { name: "middle" }), new Layout(new Panel(jobs, {
	title: "Progress",
	borderStyle: "bright_black",
	expand: true
}), {
	name: "jobs",
	size: 7
}));
var right = new Layout(void 0, {
	name: "right",
	ratio: 2
});
root.getByName("middle").splitRow(new Layout(void 0, {
	name: "services",
	ratio: 3
}), right);
right.splitColumn(new Layout(void 0, { name: "spectrum" }), new Layout(new Panel(project, {
	title: "Tree",
	borderStyle: "bright_black",
	expand: true
}), {
	name: "tree",
	size: 7
}));
/** The dashboard as it stands \`t\` seconds in. */
function frameAt(t) {
	root.getByName("services").update(services(t));
	root.getByName("spectrum").update(new Panel(new Spectrum(t), {
		title: "Truecolor",
		borderStyle: "bright_black",
		expand: true,
		padding: 0
	}));
	JOBS.forEach((job, i) => jobs.updateTask(tasks[i], { completed: Math.round((t / job.seconds + job.offset) % 1 * STEPS) }));
	return root;
}
var FRAMES_PER_SECOND = 12;
var started = Date.now();
var live = new Live(void 0, {
	altScreen: true,
	autoRefresh: false
});
var draw = () => live.update(frameAt((Date.now() - started) / 1e3), { refresh: true });
live.start();
draw();
setInterval(draw, 1e3 / FRAMES_PER_SECOND);
//#endregion
`;export{e as default};
