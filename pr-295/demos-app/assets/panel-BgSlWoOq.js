import{F as e,I as t,L as n,M as r,Mt as i,Ot as a,P as o,Pt as s,U as c,Ut as l,W as u,Y as d,d as f,et as p,r as m,u as h}from"./console-DiOlSDQ0.js";var g=8,_=4,v={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},y=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),b=e=>({left:e[0],vertical:e[2],right:e[3]}),x=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==g||t.some(e=>Array.from(e).length!==_)||t.some(e=>s(e)!==_))throw Error(`A box grid is ${g} lines of ${_} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${s(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=y(n[0]),this.headContent=b(n[1]),this.headSeparator=y(n[2]),this.bodyContent=b(n[3]),this.rowSeparator=y(n[4]),this.footSeparator=y(n[5]),this.footContent=b(n[6]),this.bottom=y(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=o(e,this,S,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>v[e]??e).join(``))}plainHeaded(){return V.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new d(a,n),d.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},S=new x(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),C=new x(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),w=new x(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),T=new x(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),E=new x(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),D=new x(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),O=new x(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),k=new x(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),A=new x(`    
    
 ── 
    
    
 ── 
    
    `),j=new x(`    
    
 ── 
    
    
    
    
    `),M=new x(`    
    
 ━━ 
    
    
 ━━ 
    
    `),N=new x(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),P=new x(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),F=new x(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),I=new x(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),L=new x(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),R=new x(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),z=new x(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),B=new x(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),V=[[L,T],[E,T],[O,D],[k,D],[w,C]];function H(e){let t=e=>Number.isFinite(e)?i(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function U(e,t,n){let r=i(e),a=e=>{let t=Math.min(e,r);return r-=t,t},o=a(1),s=a(t),c=a(n);return{left:s,contentWidth:o+r,right:c}}function W(e){return e.left+e.contentWidth+e.right}var G=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=H(t);this.renderable=h(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??p,this.expand=n?.expand!==!1}*render(r){let i=c(r,this),a=U(this.expand?i.maxWidth:m.get(i,this).maximum,this.left,this.right),o={...i,maxWidth:a.contentWidth,height:n(i.height,this.top+this.bottom)},s=t(i,this.style),l=s.isNull?void 0:s,u=[...d.applyStyle(this.renderable.render(o),l)],f=e(d.splitLines(u),o.height),p=new d(` `.repeat(a.left),l),h=new d(` `.repeat(a.right),l),g=new d(` `.repeat(W(a)),l);for(let e=0;e<this.top;e++)yield g,yield d.line();for(let e of f)yield p,yield*d.adjustLineLength(e,a.contentWidth,l),yield h,yield d.line();for(let e=0;e<this.bottom;e++)yield g,yield d.line()}measure(e){let t=u(e),n=U(t.maxWidth,this.left,this.right),r=n.left+n.right,i=m.get({...t,maxWidth:n.contentWidth},this.renderable),a=Math.min(t.maxWidth,i.maximum+r);return{minimum:Math.min(i.minimum+r,a),maximum:a}}};function K(e,t){let[,n,,r]=t,a=i(e),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(r),d=o(n),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function q(e){return e.left+e.right+e.padLeft+e.padRight}function J(e){return{...e,markup:!0,highlighter:void 0}}function Y(e,t){return t.isNull?e:(e??p).add(t)}var X=class o{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=h(e),this.box=t?.box??P,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??p,this.borderStyle=t?.borderStyle??p,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=H(t?.padding??[0,1,0,1])}*render(e){let n=c(e,this),r=this.box.substitute(n),i=t(n,this.style),a=i.add(t(n,this.borderStyle)),o=a.isNull?void 0:a,s=i.isNull?void 0:i,l=K(this._getPanelWidth(n),this.padding),[u,,d]=this.padding,f=this._renderContent(n,l.contentWidth,s);yield*this._renderTopBorder(n,r,l,o);for(let e=0;e<u;e++)yield*this._renderRow(r,l,[],o,s);for(let e of f)yield*this._renderRow(r,l,e,o,s);for(let e=0;e<d;e++)yield*this._renderRow(r,l,[],o,s);yield*this._renderBottomBorder(n,r,l,o)}_renderContent(t,r,i){let[a,,o]=this.padding,s=n(t.height,2+a+o),c={...t,highlighter:void 0,maxWidth:r,height:s},l=e(d.splitLines([...d.applyStyle(this.renderable.render(c),i)]),s);return r===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new d(a.left.repeat(t.left),r);let o=d.adjustLineLength(n,t.contentWidth,i,!1),s=[new d(` `.repeat(t.padLeft),i),...o];yield*d.adjustLineLength(s,t.spanWidth,i),yield new d(a.right.repeat(t.right),r),yield d.line()}measure(e){let t=u(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=K(e.maxWidth,this.padding),n=q(t),r=m.get({...e,maxWidth:t.contentWidth},this.renderable),i=Math.min(e.maxWidth,r.maximum+n);return{minimum:Math.min(r.minimum+n,i),maximum:i}}get _declaredWidth(){return this.width===void 0?void 0:i(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,n,r,i){let a=r.spanWidth,o=Y(i,t(e,this.titleStyle??p)),s=f(this.title,J(e),o),c=d.getLineLength(s);if(c===0){yield new d(n.top.left.repeat(r.left),i),yield new d(n.top.horizontal.repeat(a),i),yield new d(n.top.right.repeat(r.right),i),yield d.line();return}if(yield new d(n.top.left.repeat(r.left),i),c>=a)yield*d.adjustLineLength(s,a,o);else{let e=Math.floor((a-c)/2),t=a-c-e;e>0&&(yield new d(n.top.horizontal.repeat(e),i)),yield*s,t>0&&(yield new d(n.top.horizontal.repeat(t),i))}yield new d(n.top.right.repeat(r.right),i),yield d.line()}*_renderBottomBorder(e,n,i,o){let c=i.spanWidth,u=this._resolveAccessory(this.bottomRightAccessory),m=u===void 0?``:typeof u==`string`?` ${u} `:` ${u.plain} `,h=s(m),g=Y(o,u instanceof r?u.resolvedStyle(e):p);yield new d(n.bottom.left.repeat(i.left),o);let _=Math.max(0,c-h),v=Y(o,t(e,this.subtitleStyle??p)),y=f(this.subtitle,J(e),v),b=d.getLineLength(y);if(b===0)_>0&&(yield new d(n.bottom.horizontal.repeat(_),o));else if(b>=_)yield*d.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new d(n.bottom.horizontal.repeat(e),o)),yield*y,t>0&&(yield new d(n.bottom.horizontal.repeat(t),o))}if(h>0){let e=h>c?l(m,a(c)):m;yield new d(e,g)}yield new d(n.bottom.right.repeat(i.right),o),yield d.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new o(e,{...t,expand:!1})}};export{T as C,M as S,k as _,S as a,A as b,x as c,F as d,I as f,D as g,B as h,H as i,R as l,N as m,G as n,C as o,L as p,U as r,w as s,X as t,z as u,O as v,E as w,j as x,P as y};