import{l as t}from"./995bae79dec1786d.DI2aHJ5o.js";const e=t+`
const { Console, Live, Panel, ROUNDED, Table } = __richLibrary["@promptctl/rich-js"];
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
	const services = [
		"api",
		"web",
		"worker",
		"cron"
	];
	const fetchData = async () => services.map((name) => ({
		name,
		load: Math.round(Math.random() * 100)
	}));
	const buildTable = (rows) => {
		const table = new Table({
			box: ROUNDED,
			borderStyle: "blue"
		});
		table.addColumn("Service");
		table.addColumn("Load", { justify: "right" });
		for (const { name, load } of rows) {
			const color = load > 80 ? "red" : load > 50 ? "yellow" : "green";
			table.addRow(\`[bold]\${name}[/]\`, \`[\${color}]\${load}%[/]\`);
		}
		return table;
	};
	new Panel("[bold]status[/]");
	{
		const live = new Live(buildTable(await fetchData()), { console });
		live.start();
		try {
			for (let i = 0; i < 20; i++) {
				const freshData = await fetchData();
				live.update(buildTable(freshData));
				await sleep(500);
			}
		} finally {
			live.stop();
		}
	}
}
//#endregion
`;export{e as default};
