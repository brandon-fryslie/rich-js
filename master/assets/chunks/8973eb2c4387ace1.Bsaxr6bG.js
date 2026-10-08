import{l as t}from"./164122d0914b7327.68XUuyrw.js";const n=t+`
const { Console, Layout, Live, Panel } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	[
		"lint",
		"test",
		"build",
		"package",
		"deploy"
	].map((name) => ({ name }));
	new Panel("[bold]status[/]");
	{
		const layout = new Layout(void 0, { name: "root" });
		layout.splitColumn(new Layout(new Panel("[bold magenta]deploy[/] [dim]·[/] production", {
			expand: true,
			borderStyle: "magenta"
		}), { size: 3 }), new Layout(void 0, { name: "body" }));
		const live = new Live(layout, {
			altScreen: true,
			console
		});
		live.start();
		try {
			for (let left = 5; left > 0; left--) {
				layout.getByName("body").update(new Panel(\`[bold]Fullscreen[/] — back to the page in [yellow]\${left}[/]\`, {
					expand: true,
					borderStyle: "cyan"
				}));
				live.refresh();
				await sleep(1e3);
			}
		} finally {
			live.stop();
		}
		console.print("[green]:check_mark:[/] back on the main screen, where the page's output was");
	}
}
//#endregion
`;export{n as default};
