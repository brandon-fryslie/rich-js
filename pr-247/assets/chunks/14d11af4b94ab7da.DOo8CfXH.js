import{l as t}from"./97b943df9798acfa.CiBPg8ZN.js";const n=t+`
const { Console, Progress, track } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
new Console();
{
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const doStep = (_step) => sleep(20);
	new Progress();
	[
		"alpha",
		"beta",
		"gamma"
	].map((name) => ({
		name,
		items: Array.from({ length: 20 }, (_, i) => i)
	}));
	for (const step of track(Array.from({ length: 100 }), { description: "Processing..." })) await doStep(step);
}
//#endregion
`;export{n as default};
