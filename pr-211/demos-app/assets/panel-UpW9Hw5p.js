import{A as e,B as t,D as n,Et as r,M as i,N as a,W as o,Y as s,c,j as l,jt as u,k as d,o as f,wt as p,xt as m,z as h}from"./console-CDfwWm_z.js";import{t as g}from"./measure-BpACcEP5.js";var _=8,v=4,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==_||t.some(e=>Array.from(e).length!==v)||t.some(e=>r(e)!==v))throw Error(`A box grid is ${_} lines of ${v} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${r(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=b(n[0]),this.headContent=x(n[1]),this.headSeparator=b(n[2]),this.bodyContent=x(n[3]),this.rowSeparator=b(n[4]),this.footSeparator=b(n[5]),this.footContent=x(n[6]),this.bottom=b(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=d(e,this,C,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=[];r&&i.push(new o(t.left,n));for(let r=0;r<e.length;r++)r>0&&i.push(new o(t.cross,n)),i.push(new o(t.horizontal.repeat(e[r]),n));return r&&i.push(new o(t.right,n)),i.push(o.line()),i}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),w=new S(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),T=new S(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),E=new S(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),D=new S(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),O=new S(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),k=new S(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),A=new S(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),j=new S(`    
    
 ── 
    
    
 ── 
    
    `),M=new S(`    
    
 ── 
    
    
    
    
    `),N=new S(`    
    
 ━━ 
    
    
 ━━ 
    
    `),P=new S(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),F=new S(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),I=new S(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),L=new S(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),R=new S(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),z=new S(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),B=new S(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),V=new S(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?p(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function W(e,t,n){let r=p(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),s=i(n);return{left:o,contentWidth:a+r,right:s}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=U(t);this.renderable=e,this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??s,this.expand=n?.expand!==!1}*render(t){let n=h(t,this),r=W(n.maxWidth,this.left,this.right),a={...n,maxWidth:r.contentWidth,height:i(n.height,this.top+this.bottom)},s=[...this.renderable.render(a)],c=e(o.splitLines(s),a.height),u=l(n,this.style),d=u.isNull?void 0:u,f=new o(` `.repeat(r.left),d),p=new o(` `.repeat(r.right),d),m=new o(` `.repeat(G(r)),d);for(let e=0;e<this.top;e++)yield m,yield o.line();for(let e of c)yield f,yield*o.adjustLineLength(e,r.contentWidth,d,this.expand),yield p,yield o.line();for(let e=0;e<this.bottom;e++)yield m,yield o.line()}measure(e){let n=t(e),r=W(n.maxWidth,this.left,this.right),i=r.left+r.right;if(a(this.renderable)){let e=g.get({...n,maxWidth:r.contentWidth},this.renderable),t=Math.min(n.maxWidth,e.maximum+i);return{minimum:Math.min(e.minimum+i,t),maximum:t}}return{minimum:i,maximum:n.maxWidth}}};function q(e,t){let[,n,,r]=t,i=p(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(1),c=a(1),l=a(r),u=a(n),d=c+i;return{left:o,right:s,padLeft:l,contentWidth:d,padRight:u,spanWidth:l+d+u}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e,t,n){return t===void 0?n:l(e,t)}var X=class d{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=f(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??s,this.borderStyle=t?.borderStyle??s,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(e){let t=h(e,this),n=this.box.substitute(t),r=l(t,this.borderStyle),i=l(t,this.style),a=r.isNull?void 0:r,o=i.isNull?void 0:i,s=q(this._getPanelWidth(t),this.padding),[c,,u]=this.padding,d=this._renderContent(t,s.contentWidth);yield*this._renderTopBorder(t,n,s,a);for(let e=0;e<c;e++)yield*this._renderRow(n,s,[],a,o);for(let e of d)yield*this._renderRow(n,s,e,a,o);for(let e=0;e<u;e++)yield*this._renderRow(n,s,[],a,o);yield*this._renderBottomBorder(t,n,s,a)}_renderContent(t,n){let[r,,a]=this.padding,s=i(t.height,2+r+a),c={...t,maxWidth:n,height:s},l=e(o.splitLines([...this.renderable.render(c)]),s);return n===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new o(a.left.repeat(t.left),r);let s=o.adjustLineLength(n,t.contentWidth,i,!1),c=[new o(` `.repeat(t.padLeft),i),...s];yield*o.adjustLineLength(c,t.spanWidth,i),yield new o(a.right.repeat(t.right),r),yield o.line()}measure(e){let n=t(e),r=this._declaredWidth;if(r!==void 0){let e=Math.min(n.maxWidth,r);return{minimum:e,maximum:e}}return this._fitRange(n)}_fitRange(e){let t=q(e.maxWidth,this.padding),n=J(t);if(a(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=g.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:p(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,n,r){let i=n.spanWidth,a=Y(e,this.titleStyle,r),s=c(this.title,e,a),l=o.getLineLength(s);if(l===0){yield new o(t.top.left.repeat(n.left),r),yield new o(t.top.horizontal.repeat(i),r),yield new o(t.top.right.repeat(n.right),r),yield o.line();return}if(yield new o(t.top.left.repeat(n.left),r),l>=i)yield*o.adjustLineLength(s,i,a);else{let e=Math.floor((i-l)/2),n=i-l-e;e>0&&(yield new o(t.top.horizontal.repeat(e),r)),yield*s,n>0&&(yield new o(t.top.horizontal.repeat(n),r))}yield new o(t.top.right.repeat(n.right),r),yield o.line()}*_renderBottomBorder(e,t,i,a){let l=i.spanWidth,d=this._resolveAccessory(this.bottomRightAccessory),f=d===void 0?``:typeof d==`string`?` ${d} `:` ${d.plain} `,p=r(f),h=d instanceof n?d.resolvedStyle(e):s,g=h.isNull?a:h;yield new o(t.bottom.left.repeat(i.left),a);let _=Math.max(0,l-p),v=Y(e,this.subtitleStyle,a),y=c(this.subtitle,e,v),b=o.getLineLength(y);if(b===0)_>0&&(yield new o(t.bottom.horizontal.repeat(_),a));else if(b>=_)yield*o.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),n=_-b-e;e>0&&(yield new o(t.bottom.horizontal.repeat(e),a)),yield*y,n>0&&(yield new o(t.bottom.horizontal.repeat(n),a))}if(p>0){let e=p>l?u(f,m(l)):f;yield new o(e,g)}yield new o(t.bottom.right.repeat(i.right),a),yield o.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new d(e,{...t,expand:!1})}};export{D as C,E as S,k as _,w as a,M as b,z as c,L as d,R as f,A as g,O as h,C as i,B as l,V as m,K as n,T as o,P as p,U as r,S as s,X as t,I as u,F as v,N as x,j as y};