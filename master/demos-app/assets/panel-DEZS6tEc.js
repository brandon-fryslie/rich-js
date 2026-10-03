import{F as e,I as t,L as n,M as r,Mt as i,Ot as a,P as o,Pt as s,R as c,U as l,Vt as u,W as d,Y as f,d as p,et as m,r as h,u as g}from"./console-CXgdRLn2.js";var _=8,v=4,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==_||t.some(e=>Array.from(e).length!==v)||t.some(e=>s(e)!==v))throw Error(`A box grid is ${_} lines of ${v} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${s(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=b(n[0]),this.headContent=x(n[1]),this.headSeparator=b(n[2]),this.bodyContent=x(n[3]),this.rowSeparator=b(n[4]),this.footSeparator=b(n[5]),this.footContent=x(n[6]),this.bottom=b(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=o(e,this,C,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new f(a,n),f.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
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
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?i(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function W(e,t,n){let r=i(e),a=e=>{let t=Math.min(e,r);return r-=t,t},o=a(1),s=a(t),c=a(n);return{left:s,contentWidth:o+r,right:c}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=U(t);this.renderable=g(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??m,this.expand=n?.expand!==!1}*render(r){let i=l(r,this),a=W(this.expand?i.maxWidth:h.get(i,this).maximum,this.left,this.right),o={...i,maxWidth:a.contentWidth,height:n(i.height,this.top+this.bottom)},s=t(i,this.style),c=s.isNull?void 0:s,u=[...f.applyStyle(this.renderable.render(o),c)],d=e(f.splitLines(u),o.height),p=new f(` `.repeat(a.left),c),m=new f(` `.repeat(a.right),c),g=new f(` `.repeat(G(a)),c);for(let e=0;e<this.top;e++)yield g,yield f.line();for(let e of d)yield p,yield*f.adjustLineLength(e,a.contentWidth,c),yield m,yield f.line();for(let e=0;e<this.bottom;e++)yield g,yield f.line()}measure(e){let t=d(e),n=W(t.maxWidth,this.left,this.right),r=n.left+n.right;if(c(this.renderable)){let e=h.get({...t,maxWidth:n.contentWidth},this.renderable),i=Math.min(t.maxWidth,e.maximum+r);return{minimum:Math.min(e.minimum+r,i),maximum:i}}return{minimum:r,maximum:t.maxWidth}}};function q(e,t){let[,n,,r]=t,a=i(e),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(r),d=o(n),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e){return{...e,markup:!0,highlighter:void 0}}function X(e,t){return t.isNull?e:(e??m).add(t)}var Z=class o{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=g(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??m,this.borderStyle=t?.borderStyle??m,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(e){let n=l(e,this),r=this.box.substitute(n),i=t(n,this.style),a=i.add(t(n,this.borderStyle)),o=a.isNull?void 0:a,s=i.isNull?void 0:i,c=q(this._getPanelWidth(n),this.padding),[u,,d]=this.padding,f=this._renderContent(n,c.contentWidth,s);yield*this._renderTopBorder(n,r,c,o);for(let e=0;e<u;e++)yield*this._renderRow(r,c,[],o,s);for(let e of f)yield*this._renderRow(r,c,e,o,s);for(let e=0;e<d;e++)yield*this._renderRow(r,c,[],o,s);yield*this._renderBottomBorder(n,r,c,o)}_renderContent(t,r,i){let[a,,o]=this.padding,s=n(t.height,2+a+o),c={...t,highlighter:void 0,maxWidth:r,height:s},l=e(f.splitLines([...f.applyStyle(this.renderable.render(c),i)]),s);return r===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new f(a.left.repeat(t.left),r);let o=f.adjustLineLength(n,t.contentWidth,i,!1),s=[new f(` `.repeat(t.padLeft),i),...o];yield*f.adjustLineLength(s,t.spanWidth,i),yield new f(a.right.repeat(t.right),r),yield f.line()}measure(e){let t=d(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=q(e.maxWidth,this.padding),n=J(t);if(c(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=h.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:i(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,n,r,i){let a=r.spanWidth,o=X(i,t(e,this.titleStyle??m)),s=p(this.title,Y(e),o),c=f.getLineLength(s);if(c===0){yield new f(n.top.left.repeat(r.left),i),yield new f(n.top.horizontal.repeat(a),i),yield new f(n.top.right.repeat(r.right),i),yield f.line();return}if(yield new f(n.top.left.repeat(r.left),i),c>=a)yield*f.adjustLineLength(s,a,o);else{let e=Math.floor((a-c)/2),t=a-c-e;e>0&&(yield new f(n.top.horizontal.repeat(e),i)),yield*s,t>0&&(yield new f(n.top.horizontal.repeat(t),i))}yield new f(n.top.right.repeat(r.right),i),yield f.line()}*_renderBottomBorder(e,n,i,o){let c=i.spanWidth,l=this._resolveAccessory(this.bottomRightAccessory),d=l===void 0?``:typeof l==`string`?` ${l} `:` ${l.plain} `,h=s(d),g=X(o,l instanceof r?l.resolvedStyle(e):m);yield new f(n.bottom.left.repeat(i.left),o);let _=Math.max(0,c-h),v=X(o,t(e,this.subtitleStyle??m)),y=p(this.subtitle,Y(e),v),b=f.getLineLength(y);if(b===0)_>0&&(yield new f(n.bottom.horizontal.repeat(_),o));else if(b>=_)yield*f.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new f(n.bottom.horizontal.repeat(e),o)),yield*y,t>0&&(yield new f(n.bottom.horizontal.repeat(t),o))}if(h>0){let e=h>c?u(d,a(c)):d;yield new f(e,g)}yield new f(n.bottom.right.repeat(i.right),o),yield f.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new o(e,{...t,expand:!1})}};export{E as C,N as S,A as _,C as a,j as b,S as c,I as d,L as f,O as g,V as h,U as i,z as l,P as m,K as n,w as o,R as p,W as r,T as s,Z as t,B as u,k as v,D as w,M as x,F as y};