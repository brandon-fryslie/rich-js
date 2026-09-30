import{At as e,F as t,Ft as n,H as r,I as i,L as a,N as o,Ot as s,P as c,Q as l,Tt as u,U as d,d as f,j as p,q as m,r as h,u as g}from"./console-W4hLe3fU.js";var _=8,v=4,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class t{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(t){let n=t.split(`
`);if(n.length!==_||n.some(e=>Array.from(e).length!==v)||n.some(t=>e(t)!==v))throw Error(`A box grid is ${_} lines of ${v} single-cell characters; got ${n.length} line(s) measuring `+n.map(t=>`${Array.from(t).length}/${e(t)}`).join(`, `)+` characters/cells`);let r=n.map(e=>Array.from(e));this.grid=t,this.top=b(r[0]),this.headContent=x(r[1]),this.headSeparator=b(r[2]),this.bodyContent=x(r[3]),this.rowSeparator=b(r[4]),this.footSeparator=b(r[5]),this.footContent=x(r[6]),this.bottom=b(r[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=o(e,this,C,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new t(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=[];r&&i.push(new m(t.left,n));for(let r=0;r<e.length;r++)r>0&&i.push(new m(t.cross,n)),i.push(new m(t.horizontal.repeat(e[r]),n));return r&&i.push(new m(t.right,n)),i.push(m.line()),i}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
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
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?s(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function W(e,t,n){let r=s(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),c=i(n);return{left:o,contentWidth:a+r,right:c}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=U(t);this.renderable=e,this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??l,this.expand=n?.expand!==!1}*render(e){let n=r(e,this),a=W(n.maxWidth,this.left,this.right),o={...n,maxWidth:a.contentWidth,height:i(n.height,this.top+this.bottom)},s=[...this.renderable.render(o)],l=c(m.splitLines(s),o.height),u=t(n,this.style),d=u.isNull?void 0:u,f=new m(` `.repeat(a.left),d),p=new m(` `.repeat(a.right),d),h=new m(` `.repeat(G(a)),d);for(let e=0;e<this.top;e++)yield h,yield m.line();for(let e of l)yield f,yield*m.adjustLineLength(e,a.contentWidth,d,this.expand),yield p,yield m.line();for(let e=0;e<this.bottom;e++)yield h,yield m.line()}measure(e){let t=d(e),n=W(t.maxWidth,this.left,this.right),r=n.left+n.right;if(a(this.renderable)){let e=h.get({...t,maxWidth:n.contentWidth},this.renderable),i=Math.min(t.maxWidth,e.maximum+r);return{minimum:Math.min(e.minimum+r,i),maximum:i}}return{minimum:r,maximum:t.maxWidth}}};function q(e,t){let[,n,,r]=t,i=s(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),c=a(1),l=a(1),u=a(r),d=a(n),f=l+i;return{left:o,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e){return{...e,markup:!0,highlighter:void 0}}function X(e,n,r){return n===void 0?r:t(e,n)}var Z=class o{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=g(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??l,this.borderStyle=t?.borderStyle??l,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(e){let n=r(e,this),i=this.box.substitute(n),a=t(n,this.borderStyle),o=t(n,this.style),s=a.isNull?void 0:a,c=o.isNull?void 0:o,l=q(this._getPanelWidth(n),this.padding),[u,,d]=this.padding,f=this._renderContent(n,l.contentWidth);yield*this._renderTopBorder(n,i,l,s);for(let e=0;e<u;e++)yield*this._renderRow(i,l,[],s,c);for(let e of f)yield*this._renderRow(i,l,e,s,c);for(let e=0;e<d;e++)yield*this._renderRow(i,l,[],s,c);yield*this._renderBottomBorder(n,i,l,s)}_renderContent(e,t){let[n,,r]=this.padding,a=i(e.height,2+n+r),o={...e,highlighter:void 0,maxWidth:t,height:a},s=c(m.splitLines([...this.renderable.render(o)]),a);return t===0?[]:s}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new m(a.left.repeat(t.left),r);let o=m.adjustLineLength(n,t.contentWidth,i,!1),s=[new m(` `.repeat(t.padLeft),i),...o];yield*m.adjustLineLength(s,t.spanWidth,i),yield new m(a.right.repeat(t.right),r),yield m.line()}measure(e){let t=d(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=q(e.maxWidth,this.padding),n=J(t);if(a(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=h.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:s(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,n,r){let i=n.spanWidth,a=X(e,this.titleStyle,r),o=f(this.title,Y(e),a),s=m.getLineLength(o);if(s===0){yield new m(t.top.left.repeat(n.left),r),yield new m(t.top.horizontal.repeat(i),r),yield new m(t.top.right.repeat(n.right),r),yield m.line();return}if(yield new m(t.top.left.repeat(n.left),r),s>=i)yield*m.adjustLineLength(o,i,a);else{let e=Math.floor((i-s)/2),n=i-s-e;e>0&&(yield new m(t.top.horizontal.repeat(e),r)),yield*o,n>0&&(yield new m(t.top.horizontal.repeat(n),r))}yield new m(t.top.right.repeat(n.right),r),yield m.line()}*_renderBottomBorder(t,r,i,a){let o=i.spanWidth,s=this._resolveAccessory(this.bottomRightAccessory),c=s===void 0?``:typeof s==`string`?` ${s} `:` ${s.plain} `,d=e(c),h=s instanceof p?s.resolvedStyle(t):l,g=h.isNull?a:h;yield new m(r.bottom.left.repeat(i.left),a);let _=Math.max(0,o-d),v=X(t,this.subtitleStyle,a),y=f(this.subtitle,Y(t),v),b=m.getLineLength(y);if(b===0)_>0&&(yield new m(r.bottom.horizontal.repeat(_),a));else if(b>=_)yield*m.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new m(r.bottom.horizontal.repeat(e),a)),yield*y,t>0&&(yield new m(r.bottom.horizontal.repeat(t),a))}if(d>0){let e=d>o?n(c,u(o)):c;yield new m(e,g)}yield new m(r.bottom.right.repeat(i.right),a),yield m.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new o(e,{...t,expand:!1})}};export{D as C,E as S,k as _,w as a,M as b,z as c,L as d,R as f,A as g,O as h,C as i,B as l,V as m,K as n,T as o,P as p,U as r,S as s,Z as t,I as u,F as v,N as x,j as y};