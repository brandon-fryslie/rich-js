import{l as t}from"./16ae33625c7d76d2.FXdmdcvY.js";const e=t+`
const { Console, Status } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
new Console();
{
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const doWork = () => sleep(3e3);
	Array.from({ length: 20 }).reduce((inner) => [inner], "bottom");
	{
		const console = new Console();
		const status = new Status("Processing...", {
			console,
			spinner: "dots",
			style: "bold green"
		});
		status.start();
		await doWork();
		status.stop();
	}
}
//#endregion
`;export{e as default};
