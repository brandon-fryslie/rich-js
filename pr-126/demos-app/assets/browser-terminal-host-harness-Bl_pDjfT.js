import{B as x}from"./terminal-host-KVPFYHDC.js";function b(t){const r={terminal:t},e=new x(r);e.start(),e.setRawMode(!0);const s=e.size();e.write("\x1B[2J\x1B[H"),e.write(`rich-js · BrowserTerminalHost harness\r
`),e.write(`size: ${s.cols}x${s.rows} · isTTY=${e.isTTY}\r
`),e.write(`type to echo, Enter for newline, Ctrl-D to detach\r
\r
> `);let i=!1;const f=n=>{const h=typeof n=="string"?n:new TextDecoder().decode(n);for(const l of h){const o=l.charCodeAt(0);if(o===4){e.write(`\r
[detached]\r
`),c(),a(),i=!0;return}if(o===13){e.write(`\r
> `);continue}if(o===127){e.write("\b \b");continue}e.write(l)}},m=n=>{e.write(`\r
[resize: ${n.cols}x${n.rows}]\r
> `)},c=e.onData(f),a=e.onResize(m);return{host:e,stop(){i||(c(),a(),e.stop())}}}function w(t){const r=document.getElementById(t);if(r===null)throw new Error(`rich-js mount: missing required element #${t} in the page shell.`);return r}const d=w("status"),u=(t,r)=>{d.textContent=t,d.className=r??""};try{const t=new Terminal({cols:100,rows:30,cursorBlink:!0,theme:{background:"#1e1e1e"}});t.open(w("term")),t.focus();const r=b(t);window.__handle=r,u("ready · first frame rendered","ok")}catch(t){u("boot error: "+(t?.message??String(t)),"err"),console.error(t)}
