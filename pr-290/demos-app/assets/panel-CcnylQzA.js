import{$ as e,At as t,Dt as n,F as r,H as i,I as a,J as o,L as s,Mt as c,N as l,P as u,Rt as d,U as f,d as p,j as m,r as h,u as g}from"./console-pye4BYm3.js";var _=8,v=4,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==_||t.some(e=>Array.from(e).length!==v)||t.some(e=>c(e)!==v))throw Error(`A box grid is ${_} lines of ${v} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${c(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=b(n[0]),this.headContent=x(n[1]),this.headSeparator=b(n[2]),this.bodyContent=x(n[3]),this.rowSeparator=b(n[4]),this.footSeparator=b(n[5]),this.footContent=x(n[6]),this.bottom=b(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=l(e,this,C,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new o(a,n),o.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
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
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let n=e=>Number.isFinite(e)?t(e):0,r=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[n(r[0]),n(r[1]),n(r[2]),n(r[3])]}function W(e,n,r){let i=t(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(n),c=a(r);return{left:s,contentWidth:o+i,right:c}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(t,n,r){let[i,a,o,s]=U(n);this.renderable=g(t),this.top=i,this.right=a,this.bottom=o,this.left=s,this.style=r?.style??e,this.expand=r?.expand!==!1}*render(e){let t=i(e,this),n=W(this.expand?t.maxWidth:h.get(t,this).maximum,this.left,this.right),s={...t,maxWidth:n.contentWidth,height:a(t.height,this.top+this.bottom)},c=r(t,this.style),l=c.isNull?void 0:c,d=[...o.applyStyle(this.renderable.render(s),l)],f=u(o.splitLines(d),s.height),p=new o(` `.repeat(n.left),l),m=new o(` `.repeat(n.right),l),g=new o(` `.repeat(G(n)),l);for(let e=0;e<this.top;e++)yield g,yield o.line();for(let e of f)yield p,yield*o.adjustLineLength(e,n.contentWidth,l),yield m,yield o.line();for(let e=0;e<this.bottom;e++)yield g,yield o.line()}measure(e){let t=f(e),n=W(t.maxWidth,this.left,this.right),r=n.left+n.right;if(s(this.renderable)){let e=h.get({...t,maxWidth:n.contentWidth},this.renderable),i=Math.min(t.maxWidth,e.maximum+r);return{minimum:Math.min(e.minimum+r,i),maximum:i}}return{minimum:r,maximum:t.maxWidth}}};function q(e,n){let[,r,,i]=n,a=t(e),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(r),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e){return{...e,markup:!0,highlighter:void 0}}function X(t,n){return n.isNull?t:(t??e).add(n)}var Z=class l{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(t,n){this.renderable=g(t),this.box=n?.box??F,this.title=n?.title,this.subtitle=n?.subtitle,this.bottomRightAccessory=n?.bottomRightAccessory,this.expand=n?.expand!==!1,this.style=n?.style??e,this.borderStyle=n?.borderStyle??e,this.titleStyle=n?.titleStyle,this.subtitleStyle=n?.subtitleStyle,this.width=n?.width,this.padding=U(n?.padding??[0,1,0,1])}*render(e){let t=i(e,this),n=this.box.substitute(t),a=r(t,this.style),o=a.add(r(t,this.borderStyle)),s=o.isNull?void 0:o,c=a.isNull?void 0:a,l=q(this._getPanelWidth(t),this.padding),[u,,d]=this.padding,f=this._renderContent(t,l.contentWidth,c);yield*this._renderTopBorder(t,n,l,s);for(let e=0;e<u;e++)yield*this._renderRow(n,l,[],s,c);for(let e of f)yield*this._renderRow(n,l,e,s,c);for(let e=0;e<d;e++)yield*this._renderRow(n,l,[],s,c);yield*this._renderBottomBorder(t,n,l,s)}_renderContent(e,t,n){let[r,,i]=this.padding,s=a(e.height,2+r+i),c={...e,highlighter:void 0,maxWidth:t,height:s},l=u(o.splitLines([...o.applyStyle(this.renderable.render(c),n)]),s);return t===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new o(a.left.repeat(t.left),r);let s=o.adjustLineLength(n,t.contentWidth,i,!1),c=[new o(` `.repeat(t.padLeft),i),...s];yield*o.adjustLineLength(c,t.spanWidth,i),yield new o(a.right.repeat(t.right),r),yield o.line()}measure(e){let t=f(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=q(e.maxWidth,this.padding),n=J(t);if(s(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=h.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:t(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(t,n,i,a){let s=i.spanWidth,c=X(a,r(t,this.titleStyle??e)),l=p(this.title,Y(t),c),u=o.getLineLength(l);if(u===0){yield new o(n.top.left.repeat(i.left),a),yield new o(n.top.horizontal.repeat(s),a),yield new o(n.top.right.repeat(i.right),a),yield o.line();return}if(yield new o(n.top.left.repeat(i.left),a),u>=s)yield*o.adjustLineLength(l,s,c);else{let e=Math.floor((s-u)/2),t=s-u-e;e>0&&(yield new o(n.top.horizontal.repeat(e),a)),yield*l,t>0&&(yield new o(n.top.horizontal.repeat(t),a))}yield new o(n.top.right.repeat(i.right),a),yield o.line()}*_renderBottomBorder(t,i,a,s){let l=a.spanWidth,u=this._resolveAccessory(this.bottomRightAccessory),f=u===void 0?``:typeof u==`string`?` ${u} `:` ${u.plain} `,h=c(f),g=X(s,u instanceof m?u.resolvedStyle(t):e);yield new o(i.bottom.left.repeat(a.left),s);let _=Math.max(0,l-h),v=X(s,r(t,this.subtitleStyle??e)),y=p(this.subtitle,Y(t),v),b=o.getLineLength(y);if(b===0)_>0&&(yield new o(i.bottom.horizontal.repeat(_),s));else if(b>=_)yield*o.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new o(i.bottom.horizontal.repeat(e),s)),yield*y,t>0&&(yield new o(i.bottom.horizontal.repeat(t),s))}if(h>0){let e=h>l?d(f,n(l)):f;yield new o(e,g)}yield new o(i.bottom.right.repeat(a.right),s),yield o.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new l(e,{...t,expand:!1})}};export{E as C,N as S,A as _,C as a,j as b,S as c,I as d,L as f,O as g,V as h,U as i,z as l,P as m,K as n,w as o,R as p,W as r,T as s,Z as t,B as u,k as v,D as w,M as x,F as y};