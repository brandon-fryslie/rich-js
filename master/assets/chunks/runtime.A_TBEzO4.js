const e=`//#region docs/.vitepress/simulated-process.ts
/**
* A terminal we supply, standing in for Node's \`process\`, so an example's own
* \`new Console()\` — written the way a reader will copy it, with no
* \`environment:\` or \`file:\` — writes to that terminal at its size and colour
* depth.
*
* It needs no library change. \`Console\` given no environment reads the bare
* name \`process\` (\`ambientEnvironment\` in src/core/console.ts) and takes its
* size, TTY and colour depth from that, so whatever \`process\` resolves to
* where the library's code runs is the host it talks to.
*
* [LAW:no-shared-mutable-globals] That resolution is made lexical, never
* global. \`runInTerminal\` evaluates the program as the body of a function whose
* one parameter is named \`process\`, so every free \`process\` in the program —
* the library bundled into it included — binds to the stand-in, while
* \`globalThis.process\` is never read, written or replaced. Swapping the global
* for the length of a run was the alternative, and it loses three ways: a
* \`Progress\` example keeps running on timers after the swap is undone, two live
* examples on one page would each overwrite the other's terminal, and in the
* Node build the replaced object would be the build's own \`process\`.
*
* The cost of that choice is the program's shape: it has to be one
* self-contained script with every import bundled in, and with every
* \`process\` left as the free name it was written as. A bundler that
* substitutes \`process.env\` at build time (vite does unless told
* \`keepProcessEnv\`) cuts those reads off from the stand-in. A program that
* still carries an \`import\` or \`export\` declaration is refused with a
* SyntaxError, which is the loud failure it should be. Top-level \`await\` is
* allowed; the body is an async function's.
*
* The stand-in is also enough of Node's \`process\` for a program that reads
* keys: \`stdin\` emits what is typed at the terminal as \`data\`, which is all
* \`NodeTerminalHost\` asks of it, so a widget example written against a real
* TTY runs unchanged in a live terminal on a page. And it is enough for one
* that runs an \`App\`, which listens on \`process\` for the program ending: the
* program's own \`process.exit\` raises \`exit\` as Node's does, and no signal is
* ever raised, because nothing outside the page can send one. \`kill\` sends
* nothing — the suspend it carries goes to a job no shell controls, which
* Node's kernel would discard too.
*/
var AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
/**
* The part of a Node stream's event interface a terminal program uses:
* \`on\` and \`off\`, returning the stream. An event the terminal never raises
* (\`resize\` on a fixed-size terminal, \`end\` on one that never closes) can be
* subscribed to, and never fires.
*/
var Events = class {
	listeners = /* @__PURE__ */ new Map();
	on(event, listener) {
		this.listeners.set(event, (this.listeners.get(event) ?? /* @__PURE__ */ new Set()).add(listener));
		return this;
	}
	prependListener(event, listener) {
		this.listeners.set(event, /* @__PURE__ */ new Set([listener, ...this.listeners.get(event) ?? []]));
		return this;
	}
	listenerCount(event) {
		return this.listeners.get(event)?.size ?? 0;
	}
	off(event, listener) {
		this.listeners.get(event)?.delete(listener);
		return this;
	}
	emit(event, ...args) {
		for (const listener of [...this.listeners.get(event) ?? []]) listener(...args);
	}
};
/** The terminal's output side, as a program's \`process.stdout\`. */
var Output = class extends Events {
	terminal;
	columns;
	rows;
	isTTY;
	constructor(terminal) {
		super();
		this.terminal = terminal;
		this.columns = terminal.columns;
		this.rows = terminal.rows;
		this.isTTY = terminal.isTTY;
	}
	write(chunk) {
		this.terminal.write(chunk);
		return true;
	}
};
/**
* The terminal's input side, as a program's \`process.stdin\`. Raw mode, pause
* and resume answer and change nothing: the terminal delivers every key as it
* is typed, which is what raw mode asks for.
*/
var Input = class extends Events {
	isTTY;
	constructor(isTTY) {
		super();
		this.isTTY = isTTY;
	}
	setRawMode(_raw) {
		return this;
	}
	resume() {
		return this;
	}
	pause() {
		return this;
	}
};
/**
* What the program sees as \`process\`: the terminal on both standard streams —
* a real terminal shows stderr where it shows stdout — its keyboard on stdin,
* a copy of its environment, the events it ends on, and \`exit\`.
*/
var SimulatedProcess = class extends Events {
	terminal;
	env;
	stdin;
	pid = 1;
	stdout;
	stderr;
	constructor(terminal, env, stdin) {
		super();
		this.terminal = terminal;
		this.env = env;
		this.stdin = stdin;
		this.stdout = new Output(terminal);
		this.stderr = this.stdout;
	}
	exit(code = 0) {
		this.emit("exit", code);
		this.terminal.exit(code);
	}
	kill(_pid, _signal) {
		return true;
	}
};
/**
* Run a bundled program with \`process\` bound to a stand-in for \`terminal\`.
* Settles when the program's body does. Every failure rejects, one that stops
* the program compiling included.
*/
async function runInTerminal(program, terminal) {
	const body = new AsyncFunction("process", \`"use strict";\\n\${program}\`);
	const stdin = new Input(terminal.isTTY);
	terminal.onInput((chunk) => stdin.emit("data", chunk));
	await body(new SimulatedProcess(terminal, { ...terminal.env }, stdin));
}
//#endregion
//#region docs/.vitepress/theme/live-worker.ts
/**
* The worker a live terminal runs one program in: it is that program's
* process. Its first message is the program and its terminal; every later one
* is a key typed at the terminal, or a mark it answers at once. Removing the
* sandboxed frame that made the worker is how the page stops the program.
* live-terminal.ts owns why a worker, and why in a frame.
*
* It reaches the page as text (\`LIVE_RUNTIME_MODULE\` in example-runner.ts): one
* classic script whose only statement is a call of \`serve\`, so nothing here may
* use \`import.meta\`. Importing this module does nothing, as package.json's
* \`"sideEffects": false\` promises; a bundle of a bare import of it is empty.
*/
/**
* How a thrown value reads on the terminal, as Node reports an uncaught one:
* an error's stack, which names the line of each frame it was thrown through,
* led by its name and message; anything else as a string. Some engines' stacks
* carry no such lead, and get one.
*/
function describe(error) {
	if (!(error instanceof Error) || error.stack === void 0) return String(error);
	const lead = String(error);
	return error.stack.startsWith(lead) ? error.stack : \`\${lead}\\n\${error.stack}\`;
}
/** Make this worker the process of the program its first message carries. */
function serve() {
	const scope = globalThis;
	const post = (message) => scope.postMessage(message);
	const crash = (error) => post({
		kind: "crashed",
		report: \`Uncaught \${describe(error)}\`
	});
	scope.addEventListener("unhandledrejection", (event) => {
		event.preventDefault();
		crash(event.reason);
	});
	scope.addEventListener("error", (event) => {
		event.preventDefault();
		crash(event.error);
	});
	let deliver = () => {};
	scope.onmessage = ({ data }) => {
		switch (data.kind) {
			case "input": return deliver(data.chunk);
			case "mark": return post({ kind: "mark" });
			case "run":
				runInTerminal(data.script, {
					...data.terminal,
					write: (chunk) => post({
						kind: "output",
						chunk
					}),
					onInput: (to) => {
						deliver = to;
					},
					exit: (code) => {
						post({
							kind: "exit",
							code
						});
						scope.close();
					}
				}).then(() => void setTimeout(() => post({ kind: "settled" }), 0), crash);
				return;
		}
	};
}
//#endregion
//#region docs/__docs-example__.ts
serve();
//#endregion
`;export{e as default};
