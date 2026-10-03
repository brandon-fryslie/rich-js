import{At as e,F as t,G as n,Gt as r,It as i,L as a,M as o,P as s,Pt as c,R as l,W as u,X as d,d as f,r as p,tt as m,u as h}from"./console-BHmItlYP.js";var g=8,_=4,v={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},y=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),b=e=>({left:e[0],vertical:e[2],right:e[3]}),x=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==g||t.some(e=>Array.from(e).length!==_)||t.some(e=>i(e)!==_))throw Error(`A box grid is ${g} lines of ${_} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${i(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=y(n[0]),this.headContent=b(n[1]),this.headSeparator=y(n[2]),this.bodyContent=b(n[3]),this.rowSeparator=y(n[4]),this.footSeparator=y(n[5]),this.footContent=b(n[6]),this.bottom=y(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=s(e,this,S,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>v[e]??e).join(``))}plainHeaded(){return V.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new d(a,n),d.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},S=new x(`+--+
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
    `),V=[[L,T],[E,T],[O,D],[k,D],[w,C]];function H(e){let t=e=>Number.isFinite(e)?c(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function U(e,t,n){let r=c(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),s=i(n);return{left:o,contentWidth:a+r,right:s}}function W(e){return e.left+e.contentWidth+e.right}var G=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=H(t);this.renderable=h(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??m,this.expand=n?.expand!==!1}*render(e){let n=u(e,this),r=U(this.expand?n.maxWidth:p.get(n,this).maximum,this.left,this.right),i={...n,maxWidth:r.contentWidth,height:l(n.height,this.top+this.bottom)},o=a(n,this.style),s=o.isNull?void 0:o,c=[...d.applyStyle(this.renderable.render(i),s)],f=t(d.splitLines(c),i.height),m=new d(` `.repeat(r.left),s),h=new d(` `.repeat(r.right),s),g=new d(` `.repeat(W(r)),s);for(let e=0;e<this.top;e++)yield g,yield d.line();for(let e of f)yield m,yield*d.adjustLineLength(e,r.contentWidth,s),yield h,yield d.line();for(let e=0;e<this.bottom;e++)yield g,yield d.line()}measure(e){let t=n(e),r=U(t.maxWidth,this.left,this.right),i=r.left+r.right,a=p.get({...t,maxWidth:r.contentWidth},this.renderable),o=Math.min(t.maxWidth,a.maximum+i);return{minimum:Math.min(a.minimum+i,o),maximum:o}}};function K(e,t){let[,n,,r]=t,i=c(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(1),l=a(1),u=a(r),d=a(n),f=l+i;return{left:o,right:s,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function q(e){return e.left+e.right+e.padLeft+e.padRight}function J(e){return{...e,markup:!0,highlight:!1}}function Y(e,t){return t.isNull?e:(e??m).add(t)}var X=class s{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=h(e),this.box=t?.box??P,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??m,this.borderStyle=t?.borderStyle??m,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=H(t?.padding??[0,1,0,1])}*render(e){let t=u(e,this),n=this.box.substitute(t),r=a(t,this.style),i=r.add(a(t,this.borderStyle)),o=i.isNull?void 0:i,s=r.isNull?void 0:r,c=K(this._getPanelWidth(t),this.padding),[l,,d]=this.padding,f=this._renderContent(t,c.contentWidth,s);yield*this._renderTopBorder(t,n,c,o);for(let e=0;e<l;e++)yield*this._renderRow(n,c,[],o,s);for(let e of f)yield*this._renderRow(n,c,e,o,s);for(let e=0;e<d;e++)yield*this._renderRow(n,c,[],o,s);yield*this._renderBottomBorder(t,n,c,o)}_renderContent(e,n,r){let[i,,a]=this.padding,o=l(e.height,2+i+a),s={...e,highlight:!1,maxWidth:n,height:o},c=t(d.splitLines([...d.applyStyle(this.renderable.render(s),r)]),o);return n===0?[]:c}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new d(a.left.repeat(t.left),r);let o=d.adjustLineLength(n,t.contentWidth,i,!1),s=[new d(` `.repeat(t.padLeft),i),...o];yield*d.adjustLineLength(s,t.spanWidth,i),yield new d(a.right.repeat(t.right),r),yield d.line()}measure(e){let t=n(e),r=this._declaredWidth;if(r!==void 0){let e=Math.min(t.maxWidth,r);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=K(e.maxWidth,this.padding),n=q(t),r=p.get({...e,maxWidth:t.contentWidth},this.renderable),i=Math.min(e.maxWidth,r.maximum+n);return{minimum:Math.min(r.minimum+n,i),maximum:i}}get _declaredWidth(){return this.width===void 0?void 0:c(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,n,r){let i=n.spanWidth,o=Y(r,a(e,this.titleStyle??m)),s=f(this.title,J(e),o),c=d.getLineLength(s);if(c===0){yield new d(t.top.left.repeat(n.left),r),yield new d(t.top.horizontal.repeat(i),r),yield new d(t.top.right.repeat(n.right),r),yield d.line();return}if(yield new d(t.top.left.repeat(n.left),r),c>=i)yield*d.adjustLineLength(s,i,o);else{let e=Math.floor((i-c)/2),n=i-c-e;e>0&&(yield new d(t.top.horizontal.repeat(e),r)),yield*s,n>0&&(yield new d(t.top.horizontal.repeat(n),r))}yield new d(t.top.right.repeat(n.right),r),yield d.line()}*_renderBottomBorder(t,n,s,c){let l=s.spanWidth,u=this._resolveAccessory(this.bottomRightAccessory),p=u===void 0?``:typeof u==`string`?` ${u} `:` ${u.plain} `,h=i(p),g=Y(c,u instanceof o?u.resolvedStyle(t):m);yield new d(n.bottom.left.repeat(s.left),c);let _=Math.max(0,l-h),v=Y(c,a(t,this.subtitleStyle??m)),y=f(this.subtitle,J(t),v),b=d.getLineLength(y);if(b===0)_>0&&(yield new d(n.bottom.horizontal.repeat(_),c));else if(b>=_)yield*d.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new d(n.bottom.horizontal.repeat(e),c)),yield*y,t>0&&(yield new d(n.bottom.horizontal.repeat(t),c))}if(h>0){let t=h>l?r(p,e(l)):p;yield new d(t,g)}yield new d(n.bottom.right.repeat(s.right),c),yield d.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new s(e,{...t,expand:!1})}};export{T as C,M as S,k as _,S as a,A as b,x as c,F as d,I as f,D as g,B as h,H as i,R as l,N as m,G as n,C as o,L as p,U as r,w as s,X as t,z as u,O as v,E as w,j as x,P as y};