import{l as t}from"./adf17b8f40efcff4.C3Zr6Tex.js";const s=t+`
const { Console, Progress } = __richLibrary["@promptctl/rich-js"];
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
		const progress = new Progress({ autoRefresh: false });
		const task = progress.addTask("Stepping...", { total: 5 });
		progress.start();
		for (let step = 0; step < 5; step++) {
			await sleep(500);
			progress.updateTask(task, { advance: 1 });
			progress.refresh();
		}
		progress.stop();
	}
}
//#endregion
`;export{s as default};
