import{l as t}from"./536d2be807a46bbc.sWqaYrMv.js";const n=t+`
const { BarColumn, Console, Group, Live, Progress, TextColumn } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
new Console();
{
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	new Progress();
	const batches = [
		"alpha",
		"beta",
		"gamma"
	].map((name) => ({
		name,
		items: Array.from({ length: 20 }, (_, i) => i)
	}));
	const handleItem = (_item) => sleep(30);
	{
		const overallProgress = new Progress(new TextColumn("{task.description}"), new BarColumn());
		const batchProgress = new Progress(new TextColumn("{task.description}"), new BarColumn());
		const live = new Live(new Group(overallProgress, batchProgress));
		live.start();
		try {
			const overallTask = overallProgress.addTask("Overall", { total: batches.length });
			const batchTask = batchProgress.addTask("Starting", { total: 100 });
			for (const batch of batches) {
				batchProgress.updateTask(batchTask, {
					description: batch.name,
					completed: 0
				});
				for (const [index, item] of batch.items.entries()) {
					await handleItem(item);
					batchProgress.updateTask(batchTask, { completed: Math.round((index + 1) / batch.items.length * 100) });
				}
				overallProgress.updateTask(overallTask, { advance: 1 });
			}
		} finally {
			live.stop();
		}
	}
}
//#endregion
`;export{n as default};
