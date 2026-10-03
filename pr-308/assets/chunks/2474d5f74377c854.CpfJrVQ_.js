import{l as t}from"./ba8906b729b9cbb8.2ciWUAIW.js";const e=t+`
const { Console, Live, Panel } = __richLibrary["@promptctl/rich-js"];
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
		const counter = new Panel("", {
			expand: false,
			borderStyle: "magenta"
		});
		const live = new Live(counter, {
			autoRefresh: false,
			console
		});
		live.start();
		try {
			for (let n = 1; n <= 50; n++) {
				live.update(new Panel(\`frame [bold magenta]\${n}[/] of 50\`, {
					expand: false,
					borderStyle: "magenta"
				}), { refresh: true });
				await sleep(100);
			}
		} finally {
			live.stop();
		}
	}
}
//#endregion
`;export{e as default};
