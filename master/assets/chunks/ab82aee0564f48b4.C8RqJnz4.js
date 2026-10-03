import{l as t}from"./6485db7151a90e4e.Jyx6ivJm.js";const s=t+`
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
		const progress = new Progress();
		progress.start();
		try {
			const task = progress.addTask("Downloading...", { total: 100 });
			for (let i = 0; i < 100; i++) {
				await sleep(20);
				progress.updateTask(task, { advance: 1 });
			}
		} finally {
			progress.stop();
		}
	}
}
//#endregion
`;export{s as default};
