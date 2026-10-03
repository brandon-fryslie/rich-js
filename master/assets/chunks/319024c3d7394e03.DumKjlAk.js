import{l as o}from"./173245d0fe91c2b0.DQ3IAB3c.js";const n=o+`
const { Console, FloatPrompt, IntPrompt } = __richLibrary["@promptctl/rich-js"];
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const port = await IntPrompt.ask("Port number", nodeAsk, { default: 3e3 });
	const threshold = await FloatPrompt.ask("Threshold (0.0–1.0)", nodeAsk);
	console.print({
		port,
		threshold
	});
}
//#endregion
`;export{n as default};
