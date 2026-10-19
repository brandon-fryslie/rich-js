import t from"./library.W4NrgHim.js";const e=t+`
const { BarColumn, ColorRgba, ColorSpec, DEFAULT_TERMINAL_THEME, EASES, EFFECT_CATALOGUE, Effected, FrameSequence, Frames, Layout, Live, Panel, Progress, RichText, Segment, SpinnerColumn, Style, Table, TaskProgressColumn, TextColumn, Tree, beat, frameAt, onBeat, regionRows, steppedInk, withCellWidth } = __richLibrary["@promptctl/rich-js"];
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
/**
* The chevrons after the name: one, two, three, one again, a second each,
* all drawn at one width, so the tagline never moves, and their ink stepping
* through three bright colours on the same beat, each kept readable on the
* bubble behind it. Frames and steps are seconds, so the gauge turns at the
* same pace however often the dashboard redraws. The name itself walks the
* hue wheel a step a second: a wheel that would take six seconds to turn,
* sampled once a second.
*/
var CHEVRONS = new FrameSequence([
	"›",
	"››",
	"›››"
].map((glyphs) => ({
	text: new RichText(glyphs, { style: Style.parse("bold #cdd6f4 on #313244") }),
	seconds: 1
})));
var SIGNAL = steppedInk([
	{
		color: new ColorRgba(255, 85, 85),
		seconds: 1
	},
	{
		color: new ColorRgba(241, 250, 140),
		seconds: 1
	},
	{
		color: new ColorRgba(80, 250, 123),
		seconds: 1
	}
]);
var WALK = onBeat(EFFECT_CATALOGUE.loops.wheel({ z: 0 }, {
	seconds: 6,
	ease: EASES.linear,
	swing: 0
}), beat([1]));
var CURSOR = new FrameSequence([{
	text: new RichText("▌", { style: Style.parse("dim") }),
	seconds: .5
}, {
	text: new RichText(" "),
	seconds: .5
}]);
var THEME = DEFAULT_TERMINAL_THEME;
/**
* A flash over an effect: for the first 0.3 s of every 10 s the ground
* lights up white and fades back over whatever \`effect\` draws, and the rest
* of the time \`effect\` draws alone. A composer of the dashboard's own, so it
* says itself when its frame next changes — every frame while lit, and while
* dark the sooner of the next flash and whatever \`effect\` answers for the
* frame it is drawing — and a host drawing it wakes for the flash and for
* the inner effect's steps, and rests between.
*/
var FLASH_BEAT = beat([.3, 9.7]);
function flashing(effect) {
	return (drawn) => {
		const inner = effect(drawn);
		return {
			at(t) {
				const under = inner.at(t);
				if (FLASH_BEAT.at(t) !== 0) return under;
				const left = 1 - (t - FLASH_BEAT.lastChange(t)) / FLASH_BEAT.holds[0];
				const toward = (channel) => Math.round(channel + (255 - channel) * left);
				return (look, cell) => {
					const moved = under(look, cell);
					return {
						...moved,
						bg: new ColorRgba(toward(moved.bg.red), toward(moved.bg.green), toward(moved.bg.blue))
					};
				};
			},
			nextChange: (t) => FLASH_BEAT.at(t) === 0 ? t : Math.min(FLASH_BEAT.nextChange(t), inner.nextChange(t)),
			lastChange: (t) => FLASH_BEAT.at(t) === 0 ? t : Math.max(FLASH_BEAT.lastChange(t), inner.lastChange(t))
		};
	};
}
var BRAND = flashing(WALK);
function heading(t) {
	const line = Table.grid({ padding: 0 });
	line.addColumn();
	line.addColumn();
	line.addColumn();
	line.addRow(new Effected(new RichText("rich-js ", {
		style: Style.parse("bold #1e1e2e on #cba6f7"),
		end: ""
	}), BRAND, {
		t,
		key: "brand",
		theme: THEME
	}), new Effected(new Frames(CHEVRONS, { t }), SIGNAL, {
		t,
		key: "effort",
		theme: THEME
	}), new RichText(" · beautiful terminal output for TypeScript ", {
		style: Style.parse("dim"),
		end: ""
	}).append(frameAt(CURSOR, t)));
	return line;
}
var root = new Layout(void 0, { name: "root" });
root.splitColumn(new Layout(void 0, {
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
function dashboardAt(t) {
	root.getByName("heading").update(new Panel(heading(t), {
		expand: true,
		borderStyle: "magenta"
	}));
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
var draw = () => live.update(dashboardAt((Date.now() - started) / 1e3), { refresh: true });
live.start();
draw();
setInterval(draw, 1e3 / FRAMES_PER_SECOND);
//#endregion
`;export{e as default};
