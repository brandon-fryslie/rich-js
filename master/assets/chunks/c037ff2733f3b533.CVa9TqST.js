import{l as t}from"./51749a7369ed3b2c.BujBoMDP.js";const s=t+`
const { Console, Group, Live, Panel, Progress } = __richLibrary["@promptctl/rich-js"];
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
	const doWork = async (progress) => {
		const task = progress.addTask("Migrating...", { total: 40 });
		for (let i = 0; i < 40; i++) {
			await sleep(60);
			progress.updateTask(task, { advance: 1 });
		}
	};
	new Panel("[bold]status[/]");
	{
		const status = new Panel("[bold]Starting[/]", { borderStyle: "cyan" });
		const progress = new Progress();
		const live = new Live(new Group(status, progress), { console });
		live.start();
		try {
			await doWork(progress);
		} finally {
			live.stop();
		}
	}
}
//#endregion
`;export{s as default};
