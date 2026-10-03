import{l as t}from"./fe92410c0200b20a.Da5DqG5n.js";const s=t+`
const { Console, Status } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
new Console();
{
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const doWork = () => sleep(3e3);
	Array.from({ length: 20 }).reduce((inner) => [inner], "bottom");
	{
		const console = new Console();
		const status = new Status("[bold]Processing[/]...", {
			console,
			spinner: "dots",
			spinnerStyle: "cyan"
		});
		status.start();
		await doWork();
		status.stop();
	}
}
//#endregion
`;export{s as default};
