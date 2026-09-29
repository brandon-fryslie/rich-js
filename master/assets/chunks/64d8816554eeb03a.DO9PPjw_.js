import{l as t}from"./fb8fe0184dbf3467.DnBnWm7A.js";const e=t+`
const { BarColumn, Console, Group, Live, MofNCompleteColumn, Progress, TimeRemainingColumn } = __richLibrary["@promptctl/rich-js"];
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
		const downloadProgress = new Progress(new BarColumn(), new MofNCompleteColumn());
		const processProgress = new Progress(new BarColumn(), new TimeRemainingColumn());
		const live = new Live(new Group(downloadProgress, processProgress));
		live.start();
		try {
			const files = downloadProgress.addTask("files", { total: 40 });
			const seconds = processProgress.addTask("video", { total: 40 });
			for (let i = 0; i < 40; i++) {
				await sleep(50);
				downloadProgress.updateTask(files, { advance: 1 });
				processProgress.updateTask(seconds, { advance: i % 2 });
			}
		} finally {
			live.stop();
		}
	}
}
//#endregion
`;export{e as default};
