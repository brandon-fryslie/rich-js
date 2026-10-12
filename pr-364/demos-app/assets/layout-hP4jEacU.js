import{$ as e,Ft as t,G as n,J as r,K as i,L as a,P as o,Qt as s,R as c,V as l,Vt as u,Xt as d,d as f,f as p,it as m,p as h,q as g,r as _,s as ee,t as te,u as ne,z as v,zt as y}from"./console-DtNiTupe.js";var re=(2**31-1)/1e3;function b(e){if(!(Number.isFinite(e)&&e>0&&1/e<=re))throw RangeError(`a frame rate is a positive, finite number of frames a second, at most ${re} s apart, not ${e}`);return{perSecond:e,interval:1/e}}function ie(){return{now:()=>performance.now()/1e3,every:(e,t)=>{let n=setInterval(t,e.interval*1e3);return()=>clearInterval(n)}}}var ae={alternate:{exact:!0,enter:`\x1B[?1049h`,leave:`\x1B[?1049l`,home:()=>`\x1B[H`,painted:e=>e,below:()=>``},inline:{exact:!1,enter:``,leave:``,home:e=>e>1?`\x1b[${e-1}A`:``,painted:(e,t,n)=>Math.max(e,Math.min(t,n)),below:e=>e>0?`
`:``}},oe=`\r\x1B[2K`,x=`\x1B[?2026h`,S=`\x1B[?2026l`,se=`\x1B[?25l`,C=(t,n)=>t.map(t=>e.adjustLineLength(t,n.cols,void 0,!1)),w=class{write;geometry;rows=0;constructor(e,t){this.write=t,this.geometry=ae[e]}height(e){return{rows:e,exact:this.geometry.exact}}take(){this.write(this.geometry.enter+se)}paint(e,t,n){let r=C(e(),t);return this.write(x+this.over(r,t,n)+S),r}around(e,t,n,r){let i=C(t(),n),a=this.over([],n,r),o=e.endsWith(`
`)?e:`${e}\n`;return x+a+o+this.over(i,n,r)+S}over(e,t,n){let r=this.geometry.painted(e.length,this.rows,t.rows),i=Array.from({length:r},(t,r)=>oe+ee(e[r]??[],n)).join(`
`),a=r-Math.max(e.length,1),o=a>0?`\x1b[${a}A`:``,s=this.geometry.home(this.rows)+i+o;return this.rows=e.length,s}handBack(){this.write(`\x1B[0m\x1B[?25h`+this.geometry.below(this.rows)+this.geometry.leave),this.rows=0}},ce=class{print;last=()=>[];constructor(e){this.print=e}height(e){return{rows:e,exact:!1}}take(){}paint(e){this.last=e}around(e){return e}handBack(){let e=this.last;this.last=()=>[],this.print(e())}},le=[`asciiOnly`,`theme`,`onStyleError`,`markup`,`highlight`,`highlighter`];function ue(e){let t={};return le.forEach(n=>{t[n]=e[n]}),t}var de=b(30),T={alternate:{on:`\x1B[?1006h\x1B[?1000h\x1B[?1003h`,off:`\x1B[?1003l\x1B[?1000l\x1B[?1006l`},inline:{on:``,off:``}},fe=class{host;surface;view;clock;_rate;animations=new Set;ticking=null;console;_phase=`idle`;_frame=[];painter;refreshQueued=!1;subscriptions=[];paintHandlers=new Set;settle=()=>{};constructor(e){this.host=e.host,this.surface=e.surface,this.painter=new w(e.surface,e=>this.host.write(e)),this.view=e.view,this.clock=e.clock??ie(),this._rate=e.rate??de,this.console=new te({...ue(e),environment:s(e.host)})}get phase(){return this._phase}get rate(){return this._rate}set rate(e){this._rate=e,this.tick()}get frame(){return this._frame}run(){return this._phase===`idle`?new Promise((e,t)=>{this.settle=n=>{switch(n.kind){case`stopped`:return e();case`failed`:return t(n.error);case`ended`:return}},this._phase=`running`,this.host.start(),this.subscriptions=[this.host.onResize(()=>this.refresh()),this.host.onExit(()=>this.end({kind:`ended`}))],this.enter(),this.paint(),this.tick()}):Promise.reject(Error(`App.run: an app runs once, and this one is ${this._phase}`))}refresh(){this.refreshQueued||(this.refreshQueued=!0,setTimeout(()=>{this.refreshQueued&&(this.refreshQueued=!1,this._phase===`running`&&this.paint())}))}animate(){let e={};return this.animations.add(e),this.tick(),this.refresh(),()=>{this.animations.delete(e),this.tick()}}async suspend(){this._phase===`running`&&(this._phase=`suspended`,this.tick(),this.leave(),await this.host.suspend(),this._phase===`suspended`&&(this._phase=`running`,this.enter(),this.paint(),this.tick()))}onPaint(e){return this.paintHandlers.add(e),()=>this.paintHandlers.delete(e)}stop(){this.end({kind:`stopped`})}fail(e){this.end({kind:`failed`,error:e})}enter(){this.host.setRawMode(!0),this.painter.take(),this.host.write(T[this.surface].on)}leave(){this.host.write(T[this.surface].off),this.painter.handBack(),this.host.setRawMode(!1)}end(e){let t=this._phase;if(t!==`idle`&&t!==`stopped`){this._phase=`stopped`,this.tick();for(let e of this.subscriptions)e();this.subscriptions=[],t===`running`&&this.leave(),this.host.stop(),this.settle(e)}}tick(){let e=this._phase===`running`&&this.animations.size>0;this.ticking!==null&&(!e||this.ticking.rate.perSecond!==this._rate.perSecond)&&(this.ticking.stop(),this.ticking=null),e&&this.ticking===null&&(this.ticking={rate:this._rate,stop:this.clock.every(this._rate,()=>this.paint())})}paint(){try{this.draw()}catch(e){this.end({kind:`failed`,error:e})}}draw(){this.refreshQueued=!1;let t=this.console.options,n=this.painter.height(t.height.rows),r=e.splitLines(this.view(this.clock.now()).render({...t,height:n})),i=this.painter.paint(()=>c(r.slice(0,n.rows),n),{rows:n.rows,cols:t.maxWidth},this.console.destination);this._frame=i;for(let e of[...this.paintHandlers])e(i)}},E=8,D=4,pe={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},O=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),k=e=>({left:e[0],vertical:e[2],right:e[3]}),A=class t{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==E||t.some(e=>Array.from(e).length!==D)||t.some(e=>u(e)!==D))throw Error(`A box grid is ${E} lines of ${D} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${u(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=O(n[0]),this.headContent=k(n[1]),this.headSeparator=O(n[2]),this.bodyContent=k(n[3]),this.rowSeparator=O(n[4]),this.footSeparator=O(n[5]),this.footContent=k(n[6]),this.bottom=O(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=a(e,this,j,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new t(Array.from(this.grid,e=>pe[e]??e).join(``))}plainHeaded(){return Ce.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(t,n,r,i){let a=t.map(e=>n.horizontal.repeat(e)).join(n.cross),o=i?n.left+a+n.right:a;return[new e(o,r),e.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},j=new A(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),M=new A(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),N=new A(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),P=new A(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),F=new A(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),I=new A(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),L=new A(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),R=new A(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),me=new A(`    
    
 ── 
    
    
 ── 
    
    `),he=new A(`    
    
 ── 
    
    
    
    
    `),ge=new A(`    
    
 ━━ 
    
    
 ━━ 
    
    `),_e=new A(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),z=new A(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),ve=new A(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),ye=new A(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),B=new A(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),be=new A(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),xe=new A(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),Se=new A(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),Ce=[[B,P],[F,P],[L,I],[R,I],[N,M]];function V(e){let t=e=>Number.isFinite(e)?y(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function H(e,t,n){let r=y(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),s=i(n);return{left:o,contentWidth:a+r,right:s}}function we(e){return e.left+e.contentWidth+e.right}var Te=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=V(t);this.renderable=p(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??m,this.expand=n?.expand!==!1}*render(t){let n=g(t,this),r=H(this.expand?n.maxWidth:_.get(n,this).maximum,this.left,this.right),i={...n,maxWidth:r.contentWidth,height:l(n.height,this.top+this.bottom)},a=v(n,this.style),o=a.isNull?void 0:a,s=[...e.applyStyle(this.renderable.render(i),o)],u=c(e.splitLines(s),i.height),d=new e(` `.repeat(r.left),o),f=new e(` `.repeat(r.right),o),p=new e(` `.repeat(we(r)),o);for(let t=0;t<this.top;t++)yield p,yield e.line();for(let t of u)yield d,yield*e.adjustLineLength(t,r.contentWidth,o),yield f,yield e.line();for(let t=0;t<this.bottom;t++)yield p,yield e.line()}measure(e){let t=r(e),n=H(t.maxWidth,this.left,this.right),i=n.left+n.right,a=_.get({...t,maxWidth:n.contentWidth},this.renderable),o=Math.min(t.maxWidth,a.maximum+i);return{minimum:Math.min(a.minimum+i,o),maximum:o}}};function U(e,t){let[,n,,r]=t,i=y(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(1),c=a(1),l=a(r),u=a(n),d=c+i;return{left:o,right:s,padLeft:l,contentWidth:d,padRight:u,spanWidth:l+d+u}}function W(e){return e.left+e.right+e.padLeft+e.padRight}function G(e){return{...e,markup:!0,highlight:!1}}function K(e,t){return e.text(G(t)).pad(1)}function q(e,t){return t.isNull?e:(e??m).add(t)}function J(t,n,r,i,o,s,c,l){let u=n.left.repeat(r.left);if(o===void 0||i<=2)return[new e(u+n.horizontal.repeat(i)+l,c)];let d=i-2,p=K(o,t);ne(p,d,p.overflow===`ellipsis`?a(t,`…`,`.`):``);let m=f(p,G(t),s),h=d-e.getLineLength(m),g=Math.floor(h/2);return[new e(u+n.horizontal,c),new e(n.horizontal.repeat(g),c),...m,new e(n.horizontal.repeat(h-g),c),new e(n.horizontal+l,c)]}var Ee=class n{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;_titleLabel;_subtitleLabel;constructor(e,t){this.renderable=p(e),this.box=t?.box??z,this.title=t?.title,this.subtitle=t?.subtitle,this._titleLabel=h(this.title),this._subtitleLabel=h(this.subtitle),this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??m,this.borderStyle=t?.borderStyle??m,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=V(t?.padding??[0,1,0,1])}*render(e){let t=g(e,this),n=this.box.substitute(t),r=v(t,this.style),i=r.add(v(t,this.borderStyle)),a=i.isNull?void 0:i,o=r.isNull?void 0:r,s=U(this._getPanelWidth(t),this.padding),[c,,l]=this.padding,u=this._renderContent(t,s.contentWidth,o);yield*this._renderTopBorder(t,n,s,a);for(let e=0;e<c;e++)yield*this._renderPaddingRow(n,s,a,o);for(let e of u)yield*this._renderRow(n,s,e,a,o);for(let e=0;e<l;e++)yield*this._renderPaddingRow(n,s,a,o);yield*this._renderBottomBorder(t,n,s,a)}_renderContent(t,n,r){let[i,,a]=this.padding,o=l(t.height,2+i+a),s={...t,highlight:!1,maxWidth:n,height:o},u=c(e.splitLines([...e.applyStyle(this.renderable.render(s),r)]),o);return n===0?[]:u}*_renderRow(t,n,r,i,a){let o=t.getContentChars(`row`);yield new e(o.left.repeat(n.left),i),yield new e(` `.repeat(n.padLeft),a),yield*e.adjustLineLength(r,n.contentWidth,a),yield new e(` `.repeat(n.padRight),a),yield new e(o.right.repeat(n.right),i),yield e.line()}*_renderPaddingRow(t,n,r,i){let a=t.getContentChars(`row`);yield new e(a.left.repeat(n.left),r),yield new e(` `.repeat(n.spanWidth),i),yield new e(a.right.repeat(n.right),r),yield e.line()}measure(e){let t=r(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}let i=this._contentRange(t),a=W(U(t.maxWidth,this.padding)),o=Math.min(t.maxWidth,Math.max(i.maximum,this._labelWidth(t)+a));return{minimum:Math.min(i.minimum,o),maximum:o}}_contentRange(e){let t=U(e.maxWidth,this.padding),n=W(t),r=_.get({...e,maxWidth:t.contentWidth},this.renderable);return{minimum:r.minimum+n,maximum:Math.min(e.maxWidth,r.maximum+n)}}_labelWidth(e){return this._titleLabel===void 0?0:K(this._titleLabel,e).cellLength}get _declaredWidth(){return this.width===void 0?void 0:y(this.width)}_getPanelWidth(e){let t=Math.min(e.maxWidth,this._declaredWidth??e.maxWidth),n=this.expand?t:this._contentRange({...e,maxWidth:t}).maximum,r=this._titleLabel===void 0?0:this._labelWidth(e)+4;return Math.min(e.maxWidth,Math.max(n,r))}*_renderTopBorder(t,n,r,i){let a=q(i,v(t,this.titleStyle??m));yield*J(t,n.top,r,r.spanWidth,this._titleLabel,a,i,n.top.right.repeat(r.right)),yield e.line()}*_renderBottomBorder(n,r,i,a){let s=this._resolveAccessory(this.bottomRightAccessory),c=s===void 0?``:typeof s==`string`?` ${s} `:` ${s.plain} `,l=d(c,t(Math.min(u(c),i.spanWidth))),f=s instanceof o?s.resolvedStyle(n):m,p=q(a,v(n,this.subtitleStyle??m)),h=r.bottom.right.repeat(i.right),[g,_]=l===``?[h,``]:[``,h];yield*J(n,r.bottom,i,i.spanWidth-u(l),this._subtitleLabel,p,a,g),yield new e(l,q(a,f)),yield new e(_,a),yield e.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new n(e,{...t,expand:!1})}};function De(e,t,n){let r=Q(n===void 0?t:t.map((e,t)=>n[t]>0?e:0)),i=r.reduce((e,t)=>e+t,0n),a=BigInt(e);return r.map((e,t)=>{let r=i>0n?Y(e*a,i):a,o=BigInt(n?.[t]??0),s=r>o?r:o;return i-=e,a-=s,Number(s)})}function Oe(e,t,n,r){let i=Q(t.map((e,t)=>n[t]>0?e:0)),a=i.reduce((e,t)=>e+t,0n),o=BigInt(e);return i.map((e,t)=>{if(e===0n)return r[t];let i=ke(e*o,a),s=BigInt(n[t]),c=i<s?i:s;return o-=c,a-=e,r[t]-Number(c)})}function ke(e,t){let n=e/t-(e%t<0n?1n:0n),r=2n*(e-n*t);return r>t||r===t&&n%2n!=0n?n+1n:n}function Y(e,t){let n=e/t;return e%t>0n?n+1n:n}function Ae(e){return Number.isFinite(e)&&e>0?e:0}var X=e=>e.size===void 0&&e.ratio!==0;function Z(e,t){let n=t.map(()=>0),r=e,i=(e,t)=>{n[e]=Math.min(t,r),r-=n[e]},a=[];t.forEach((e,t)=>{X(e)?a.push(t):i(t,e.size??e.minimumSize)});let o=Q(a.map(e=>t[e].ratio)),s=a.map((e,n)=>({index:e,weight:o[n],minimum:BigInt(t[e].minimumSize)})),c=s.reduce((e,{weight:t})=>e+t,0n),l=()=>s.find(({weight:e,minimum:t})=>BigInt(r)*e<=t*c);for(let e=l();e!==void 0;e=l())i(e.index,Number(e.minimum)),c-=e.weight,s=s.filter(t=>t!==e);let u=BigInt(r),d=0n,f=0n;for(let{index:e,weight:t}of s){let r=f;d+=t,f=u*d/c,n[e]=Number(f-r)}return n}function je(e,t){let n=e.flatMap((e,t)=>X(e)?[t]:[]),r=n.map(n=>Math.ceil(Math.max(e[n].minimumSize,t[n])));if(!r.every(Number.isFinite))return 1/0;let i=Q(n.map(t=>e[t].ratio)),a=i.reduce((e,t)=>e+t,0n),o=e.reduce((e,t)=>e+(X(t)?0:t.size??t.minimumSize),0),s=r.reduce((e,t,n)=>{let r=Y(BigInt(t)*a,i[n]);return r>e?r:e},0n);return o+Number(s)}function Q(e){let t=e.map(e=>{let[t=``,n=`0`]=String(e).split(`e`),[r=``,i=``]=t.split(`.`);return{mantissa:BigInt(r+i),exponent:i.length-Number(n)}}),n=t.reduce((e,{exponent:t})=>Math.max(e,t),0);return t.map(({mantissa:e,exponent:t})=>e*10n**BigInt(n-t))}function $(t,n,r){let a=r===void 0?i(n.height):{rows:r,exact:!0};return c(e.splitLines(t.render({...n,height:a})),a)}var Me=class{name;visible;_ratio;_size;_minimumSize;_renderable;_children;_splitDirection;constructor(e,t){e!==void 0&&(this._renderable=p(e)),this.name=t?.name,this.ratio=t?.ratio??1,this.size=t?.size,this.minimumSize=t?.minimumSize??1,this.visible=t?.visible!==!1,this._children=[],this._splitDirection=void 0}get ratio(){return this._ratio}set ratio(e){this._ratio=Ae(e)}get size(){return this._size}set size(e){this._size=e===void 0?void 0:y(e)}get minimumSize(){return this._minimumSize}set minimumSize(e){this._minimumSize=y(e)}get children(){return this._children}get _isLeaf(){return this._children.length===0}splitColumn(...e){this._children=e,this._splitDirection=`column`}splitRow(...e){this._children=e,this._splitDirection=`row`}update(e){this._renderable=p(e)}getByName(e){if(this.name===e)return this;for(let t of this._children){let n=t.getByName(e);if(n)return n}}*render(t){if(!this.visible)return;let n=g(t,this);if(this._isLeaf){if(this._renderable){let t=c(e.splitLines(this._renderable.render(n)),n.height);for(let r of t)yield*e.adjustLineLength(r,n.maxWidth),yield e.line()}return}let r=this._children.filter(e=>e.visible);r.length!==0&&(this._splitDirection===`row`?yield*this._renderRow(r,n):yield*this._renderColumn(r,n))}*_renderColumn(t,r){let i=n(r.height),a=i===void 0?t.map(e=>e.size):Z(i,t);for(let n=0;n<t.length;n++)for(let i of $(t[n],r,a[n]))yield*i,yield e.line()}*_renderRow(t,r){let i=Z(r.maxWidth,t),a=n(r.height),o=t.map((e,t)=>({width:i[t],lines:$(e,{...r,maxWidth:i[t]},a)}));yield*e.mergeHorizontal(o)}_naturalWidth(e){if(!this.visible)return 0;if(this._isLeaf)return this._renderable===void 0?0:_.get(e,this._renderable).maximum;let t=this._children.filter(e=>e.visible);if(t.length===0)return 0;let n=t.map(t=>t._naturalWidth(e));if(this._splitDirection===`row`)return je(t,n);let r=0;for(let e of n)r=Math.max(r,e);return r}measure(e){let t=r(e),n=Math.min(this._naturalWidth(t),t.maxWidth);return{minimum:Math.min(this.minimumSize,n),maximum:n}}};export{ce as A,z as C,P as D,ge as E,b as M,ie as N,F as O,L as S,he as T,B as _,Ee as a,I as b,V as c,N as d,A as f,ye as g,ve as h,Oe as i,w as j,fe as k,j as l,xe as m,Q as n,Te as o,be as p,De as r,H as s,Me as t,M as u,_e as v,me as w,R as x,Se as y};