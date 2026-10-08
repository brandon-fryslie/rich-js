import{l as t}from"./17b53148e9bff380.BH1fMOZ6.js";const e=t+`
const { Console, Live, Panel, ROUNDED, Table } = __richLibrary["@promptctl/rich-js"];
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
		const table = new Table({
			box: ROUNDED,
			borderStyle: "cyan"
		});
		table.addColumn("Job");
		table.addColumn("Status");
		const live = new Live(table, {
			transient: true,
			console
		});
		live.start();
		try {
			for (const job of jobs) {
				await runJob(job);
				table.addRow(job.name, "[green]done[/]");
			}
		} finally {
			live.stop();
		}
		console.print(\`[bold green]:check_mark: \${jobs.length} jobs done[/]\`);
	}
}
//#endregion
`;export{e as default};
