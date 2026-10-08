import{l as t}from"./164122d0914b7327.68XUuyrw.js";const e=t+`
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
	new Panel("[bold]status[/]");
	{
		const tall = new Table({ box: ROUNDED });
		tall.addColumn("Line");
		const live = new Live(tall, {
			verticalOverflow: "ellipsis",
			console
		});
		live.start();
		try {
			for (let i = 1; i <= 40; i++) {
				tall.addRow(\`[cyan]row \${i}[/]\`);
				await sleep(80);
			}
		} finally {
			live.stop();
		}
	}
}
//#endregion
`;export{e as default};
