import{l as t}from"./4a77f5df320f378c.BJvjsT1R.js";const s=t+`
const { Console, Progress } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
new Console();
{
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const progress = new Progress();
	[
		"alpha",
		"beta",
		"gamma"
	].map((name) => ({
		name,
		items: Array.from({ length: 20 }, (_, i) => i)
	}));
	progress.start();
	try {
		const task = progress.addTask("Work", { total: 10 });
		for (let i = 0; i < 10; i++) {
			progress.console.print(\`Step \${i} done\`);
			progress.updateTask(task, { advance: 1 });
			await sleep(100);
		}
	} finally {
		progress.stop();
	}
}
//#endregion
`;export{s as default};
