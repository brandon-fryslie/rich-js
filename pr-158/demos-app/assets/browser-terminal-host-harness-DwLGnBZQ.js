import{t as e}from"./terminal-host-Dm3X2nc1.js";function t(t){let n=new e({terminal:t});n.start(),n.setRawMode(!0);let r=n.size();n.write(`\x1B[2J\x1B[H`),n.write(`rich-js · BrowserTerminalHost harness\r
`),n.write(`size: ${r.cols}x${r.rows} · isTTY=${n.isTTY}\r\n`),n.write(`type to echo, Enter for newline, Ctrl-D to detach\r
\r
> `);let i=!1,a=e=>{let t=typeof e==`string`?e:new TextDecoder().decode(e);for(let e of t){let t=e.charCodeAt(0);if(t===4){n.write(`\r
[detached]\r
`),s(),c(),i=!0;return}if(t===13){n.write(`\r
> `);continue}if(t===127){n.write(`\b \b`);continue}n.write(e)}},o=e=>{n.write(`\r\n[resize: ${e.cols}x${e.rows}]\r\n> `)},s=n.onData(a),c=n.onResize(o);return{host:n,stop(){i||(s(),c(),n.stop())}}}function n(e){let t=document.getElementById(e);if(t===null)throw Error(`rich-js mount: missing required element #${e} in the page shell.`);return t}var r=n(`status`),i=(e,t)=>{r.textContent=e,r.className=t??``};try{let e=new Terminal({cols:100,rows:30,cursorBlink:!0,theme:{background:`#1e1e1e`}});e.open(n(`term`)),e.focus();let r=t(e);window.__handle=r,i(`ready · first frame rendered`,`ok`)}catch(e){i(`boot error: `+(e?.message??String(e)),`err`),console.error(e)}