import{l as t}from"./22a9f372ff675304.C9kYMrhP.js";const e=t+`
const { Console, Live, Panel } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const jobs = [
		"lint",
		"test",
		"build",
		"package",
		"deploy"
	].map((name) => ({ name }));
	const runJob = (_job) => sleep(700);
	new Panel("[bold]status[/]");
	{
		const progress = new Panel("[yellow]working…[/]", { expand: false });
		const live = new Live(progress, { console });
		live.start();
		try {
			for (const job of jobs) {
				await runJob(job);
				live.console.print(\`[green]:check_mark:[/] \${job.name} complete\`);
			}
		} finally {
			live.stop();
		}
	}
}
//#endregion
`;export{e as default};
