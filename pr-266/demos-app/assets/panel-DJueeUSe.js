import{Et as e,F as t,H as n,I as r,It as i,L as a,N as o,P as s,Q as c,U as l,d as u,j as d,jt as f,kt as p,q as m,r as h,u as g}from"./console-DcLv8fdX.js";var _=8,v=4,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==_||t.some(e=>Array.from(e).length!==v)||t.some(e=>f(e)!==v))throw Error(`A box grid is ${_} lines of ${v} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${f(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=b(n[0]),this.headContent=x(n[1]),this.headSeparator=b(n[2]),this.bodyContent=x(n[3]),this.rowSeparator=b(n[4]),this.footSeparator=b(n[5]),this.footContent=x(n[6]),this.bottom=b(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=o(e,this,C,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=[];r&&i.push(new m(t.left,n));for(let r=0;r<e.length;r++)r>0&&i.push(new m(t.cross,n)),i.push(new m(t.horizontal.repeat(e[r]),n));return r&&i.push(new m(t.right,n)),i.push(m.line()),i}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
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
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?p(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function W(e,t,n){let r=p(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),s=i(n);return{left:o,contentWidth:a+r,right:s}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=U(t);this.renderable=g(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??c,this.expand=n?.expand!==!1}*render(e){let i=n(e,this),a=W(this.expand?i.maxWidth:h.get(i,this).maximum,this.left,this.right),o={...i,maxWidth:a.contentWidth,height:r(i.height,this.top+this.bottom)},c=t(i,this.style),l=c.isNull?void 0:c,u=[...m.applyStyle(this.renderable.render(o),l)],d=s(m.splitLines(u),o.height),f=new m(` `.repeat(a.left),l),p=new m(` `.repeat(a.right),l),g=new m(` `.repeat(G(a)),l);for(let e=0;e<this.top;e++)yield g,yield m.line();for(let e of d)yield f,yield*m.adjustLineLength(e,a.contentWidth,l),yield p,yield m.line();for(let e=0;e<this.bottom;e++)yield g,yield m.line()}measure(e){let t=l(e),n=W(t.maxWidth,this.left,this.right),r=n.left+n.right;if(a(this.renderable)){let e=h.get({...t,maxWidth:n.contentWidth},this.renderable),i=Math.min(t.maxWidth,e.maximum+r);return{minimum:Math.min(e.minimum+r,i),maximum:i}}return{minimum:r,maximum:t.maxWidth}}};function q(e,t){let[,n,,r]=t,i=p(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(1),c=a(1),l=a(r),u=a(n),d=c+i;return{left:o,right:s,padLeft:l,contentWidth:d,padRight:u,spanWidth:l+d+u}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e){return{...e,markup:!0,highlighter:void 0}}function X(e,t){return t.isNull?e:(e??c).add(t)}var Z=class o{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=g(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??c,this.borderStyle=t?.borderStyle??c,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(e){let r=n(e,this),i=this.box.substitute(r),a=t(r,this.style),o=a.add(t(r,this.borderStyle)),s=o.isNull?void 0:o,c=a.isNull?void 0:a,l=q(this._getPanelWidth(r),this.padding),[u,,d]=this.padding,f=this._renderContent(r,l.contentWidth,c);yield*this._renderTopBorder(r,i,l,s);for(let e=0;e<u;e++)yield*this._renderRow(i,l,[],s,c);for(let e of f)yield*this._renderRow(i,l,e,s,c);for(let e=0;e<d;e++)yield*this._renderRow(i,l,[],s,c);yield*this._renderBottomBorder(r,i,l,s)}_renderContent(e,t,n){let[i,,a]=this.padding,o=r(e.height,2+i+a),c={...e,highlighter:void 0,maxWidth:t,height:o},l=s(m.splitLines([...m.applyStyle(this.renderable.render(c),n)]),o);return t===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new m(a.left.repeat(t.left),r);let o=m.adjustLineLength(n,t.contentWidth,i,!1),s=[new m(` `.repeat(t.padLeft),i),...o];yield*m.adjustLineLength(s,t.spanWidth,i),yield new m(a.right.repeat(t.right),r),yield m.line()}measure(e){let t=l(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=q(e.maxWidth,this.padding),n=J(t);if(a(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=h.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:p(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,n,r,i){let a=r.spanWidth,o=X(i,t(e,this.titleStyle??c)),s=u(this.title,Y(e),o),l=m.getLineLength(s);if(l===0){yield new m(n.top.left.repeat(r.left),i),yield new m(n.top.horizontal.repeat(a),i),yield new m(n.top.right.repeat(r.right),i),yield m.line();return}if(yield new m(n.top.left.repeat(r.left),i),l>=a)yield*m.adjustLineLength(s,a,o);else{let e=Math.floor((a-l)/2),t=a-l-e;e>0&&(yield new m(n.top.horizontal.repeat(e),i)),yield*s,t>0&&(yield new m(n.top.horizontal.repeat(t),i))}yield new m(n.top.right.repeat(r.right),i),yield m.line()}*_renderBottomBorder(n,r,a,o){let s=a.spanWidth,l=this._resolveAccessory(this.bottomRightAccessory),p=l===void 0?``:typeof l==`string`?` ${l} `:` ${l.plain} `,h=f(p),g=X(o,l instanceof d?l.resolvedStyle(n):c);yield new m(r.bottom.left.repeat(a.left),o);let _=Math.max(0,s-h),v=X(o,t(n,this.subtitleStyle??c)),y=u(this.subtitle,Y(n),v),b=m.getLineLength(y);if(b===0)_>0&&(yield new m(r.bottom.horizontal.repeat(_),o));else if(b>=_)yield*m.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new m(r.bottom.horizontal.repeat(e),o)),yield*y,t>0&&(yield new m(r.bottom.horizontal.repeat(t),o))}if(h>0){let t=h>s?i(p,e(s)):p;yield new m(t,g)}yield new m(r.bottom.right.repeat(a.right),o),yield m.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new o(e,{...t,expand:!1})}};export{D as C,E as S,k as _,w as a,M as b,z as c,L as d,R as f,A as g,O as h,C as i,B as l,V as m,K as n,T as o,P as p,U as r,S as s,Z as t,I as u,F as v,N as x,j as y};