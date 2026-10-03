import{l as o}from"./dbbb16276dda7ac2.Cg8Zc2As.js";const t=o+`
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
const { Console, Prompt } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const host = await Prompt.ask("Host", nodeAsk, { default: "localhost" });
	console.print(\`Connecting to [bold cyan]\${host}[/]…\`);
}
//#endregion
`;export{t as default};
