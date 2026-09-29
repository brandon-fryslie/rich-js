import{l as t}from"./6a9afaf340bfcfd4.hCe68Ew1.js";const e=t+`
const { Console, Live, Panel, Table } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
new Console();
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
		const console = new Console();
		const table = new Table();
		table.addColumn("Job");
		table.addColumn("Status");
		const live = new Live(table, { console });
		live.start();
		try {
			for (const job of jobs) {
				await runJob(job);
				table.addRow(job.name, "[green]done[/green]");
			}
		} finally {
			live.stop();
		}
	}
}
//#endregion
`;export{e as default};
