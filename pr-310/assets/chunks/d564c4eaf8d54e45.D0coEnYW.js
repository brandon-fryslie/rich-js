import{l as t}from"./068823385f770d70.DTu8cY-X.js";const e=t+`
const { Console, Layout, Live, Panel, Table } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
new Console();
{
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const running = true;
	let tick = 0;
	const buildBodyContent = () => {
		tick += 1;
		const table = new Table({ expand: true });
		table.addColumn("service");
		table.addColumn("cpu", { justify: "right" });
		table.addColumn("load");
		for (const [i, name] of [
			"api",
			"auth",
			"worker",
			"queue",
			"cache",
			"search",
			"mail",
			"db"
		].entries()) {
			const cpu = Math.round(50 + 45 * Math.sin(tick / 6 + i * 1.7));
			const colour = cpu > 80 ? "red" : cpu > 50 ? "yellow" : "green";
			table.addRow(name, \`\${cpu}%\`, \`[\${colour}]\${"█".repeat(Math.round(cpu / 4))}[/]\`);
		}
		return new Panel(table, {
			title: "services",
			expand: true,
			borderStyle: "blue"
		});
	};
	{
		const layout = new Layout();
		layout.splitColumn(new Layout(void 0, {
			name: "header",
			size: 3
		}), new Layout(void 0, { name: "body" }));
		const live = new Live(layout, { altScreen: true });
		live.start();
		try {
			layout.getByName("header").update(new Panel("[bold magenta]My App[/]", {
				expand: true,
				borderStyle: "magenta"
			}));
			while (running) {
				layout.getByName("body").update(buildBodyContent());
				await sleep(250);
			}
		} finally {
			live.stop();
		}
	}
}
//#endregion
`;export{e as default};
