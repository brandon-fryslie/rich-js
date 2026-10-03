import{l as n}from"./b059aef360219400.DeeVAqYE.js";const e=n+`
const { BarColumn, Console, Progress, SpinnerColumn, TaskProgressColumn, TextColumn, TimeRemainingColumn } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
new Console();
{
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	new Progress();
	[
		"alpha",
		"beta",
		"gamma"
	].map((name) => ({
		name,
		items: Array.from({ length: 20 }, (_, i) => i)
	}));
	{
		const progress = new Progress(new SpinnerColumn(), new TextColumn("{task.description}"), new BarColumn(), new TaskProgressColumn(), new TimeRemainingColumn());
		progress.start();
		const task = progress.addTask("Rendering...", { total: 100 });
		for (let i = 0; i < 100; i++) {
			await sleep(40);
			progress.updateTask(task, { advance: 1 });
		}
		progress.stop();
	}
}
//#endregion
`;export{e as default};
