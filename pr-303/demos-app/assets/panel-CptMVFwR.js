import{B as e,I as t,It as n,K as r,L as i,Mt as a,N as o,Q as s,R as c,Rt as l,d as u,q as d,qt as f,r as p,rt as m,u as h}from"./console-B7-Qo-3H.js";var g=8,_=4,v={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},y=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),b=e=>({left:e[0],vertical:e[2],right:e[3]}),x=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==g||t.some(e=>Array.from(e).length!==_)||t.some(e=>l(e)!==_))throw Error(`A box grid is ${g} lines of ${_} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${l(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=y(n[0]),this.headContent=b(n[1]),this.headSeparator=y(n[2]),this.bodyContent=b(n[3]),this.rowSeparator=y(n[4]),this.footSeparator=y(n[5]),this.footContent=b(n[6]),this.bottom=y(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let n=t(e,this,S,e=>e.grid);return n===this&&e.safe===!0?this.safeSubstitute():n}safeSubstitute(){return new e(Array.from(this.grid,e=>v[e]??e).join(``))}plainHeaded(){return V.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new s(a,n),s.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},S=new x(`+--+
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
    `),V=[[L,T],[E,T],[O,D],[k,D],[w,C]];function H(e){let t=e=>Number.isFinite(e)?n(e):0,r=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(r[0]),t(r[1]),t(r[2]),t(r[3])]}function U(e,t,r){let i=n(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(t),c=a(r);return{left:s,contentWidth:o+i,right:c}}function W(e){return e.left+e.contentWidth+e.right}var G=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=H(t);this.renderable=h(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??m,this.expand=n?.expand!==!1}*render(t){let n=r(t,this),a=U(this.expand?n.maxWidth:p.get(n,this).maximum,this.left,this.right),o={...n,maxWidth:a.contentWidth,height:e(n.height,this.top+this.bottom)},l=c(n,this.style),u=l.isNull?void 0:l,d=[...s.applyStyle(this.renderable.render(o),u)],f=i(s.splitLines(d),o.height),m=new s(` `.repeat(a.left),u),h=new s(` `.repeat(a.right),u),g=new s(` `.repeat(W(a)),u);for(let e=0;e<this.top;e++)yield g,yield s.line();for(let e of f)yield m,yield*s.adjustLineLength(e,a.contentWidth,u),yield h,yield s.line();for(let e=0;e<this.bottom;e++)yield g,yield s.line()}measure(e){let t=d(e),n=U(t.maxWidth,this.left,this.right),r=n.left+n.right,i=p.get({...t,maxWidth:n.contentWidth},this.renderable),a=Math.min(t.maxWidth,i.maximum+r);return{minimum:Math.min(i.minimum+r,a),maximum:a}}};function K(e,t){let[,r,,i]=t,a=n(e),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(r),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function q(e){return e.left+e.right+e.padLeft+e.padRight}function J(e){return{...e,markup:!0,highlight:!1}}function Y(e,t){return t.isNull?e:(e??m).add(t)}var X=class t{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=h(e),this.box=t?.box??P,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??m,this.borderStyle=t?.borderStyle??m,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=H(t?.padding??[0,1,0,1])}*render(e){let t=r(e,this),n=this.box.substitute(t),i=c(t,this.style),a=i.add(c(t,this.borderStyle)),o=a.isNull?void 0:a,s=i.isNull?void 0:i,l=K(this._getPanelWidth(t),this.padding),[u,,d]=this.padding,f=this._renderContent(t,l.contentWidth,s);yield*this._renderTopBorder(t,n,l,o);for(let e=0;e<u;e++)yield*this._renderRow(n,l,[],o,s);for(let e of f)yield*this._renderRow(n,l,e,o,s);for(let e=0;e<d;e++)yield*this._renderRow(n,l,[],o,s);yield*this._renderBottomBorder(t,n,l,o)}_renderContent(t,n,r){let[a,,o]=this.padding,c=e(t.height,2+a+o),l={...t,highlight:!1,maxWidth:n,height:c},u=i(s.splitLines([...s.applyStyle(this.renderable.render(l),r)]),c);return n===0?[]:u}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new s(a.left.repeat(t.left),r);let o=s.adjustLineLength(n,t.contentWidth,i,!1),c=[new s(` `.repeat(t.padLeft),i),...o];yield*s.adjustLineLength(c,t.spanWidth,i),yield new s(a.right.repeat(t.right),r),yield s.line()}measure(e){let t=d(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=K(e.maxWidth,this.padding),n=q(t),r=p.get({...e,maxWidth:t.contentWidth},this.renderable),i=Math.min(e.maxWidth,r.maximum+n);return{minimum:Math.min(r.minimum+n,i),maximum:i}}get _declaredWidth(){return this.width===void 0?void 0:n(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,n,r){let i=n.spanWidth,a=Y(r,c(e,this.titleStyle??m)),o=u(this.title,J(e),a),l=s.getLineLength(o);if(l===0){yield new s(t.top.left.repeat(n.left),r),yield new s(t.top.horizontal.repeat(i),r),yield new s(t.top.right.repeat(n.right),r),yield s.line();return}if(yield new s(t.top.left.repeat(n.left),r),l>=i)yield*s.adjustLineLength(o,i,a);else{let e=Math.floor((i-l)/2),n=i-l-e;e>0&&(yield new s(t.top.horizontal.repeat(e),r)),yield*o,n>0&&(yield new s(t.top.horizontal.repeat(n),r))}yield new s(t.top.right.repeat(n.right),r),yield s.line()}*_renderBottomBorder(e,t,n,r){let i=n.spanWidth,d=this._resolveAccessory(this.bottomRightAccessory),p=d===void 0?``:typeof d==`string`?` ${d} `:` ${d.plain} `,h=l(p),g=Y(r,d instanceof o?d.resolvedStyle(e):m);yield new s(t.bottom.left.repeat(n.left),r);let _=Math.max(0,i-h),v=Y(r,c(e,this.subtitleStyle??m)),y=u(this.subtitle,J(e),v),b=s.getLineLength(y);if(b===0)_>0&&(yield new s(t.bottom.horizontal.repeat(_),r));else if(b>=_)yield*s.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),n=_-b-e;e>0&&(yield new s(t.bottom.horizontal.repeat(e),r)),yield*y,n>0&&(yield new s(t.bottom.horizontal.repeat(n),r))}if(h>0){let e=h>i?f(p,a(i)):p;yield new s(e,g)}yield new s(t.bottom.right.repeat(n.right),r),yield s.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,n){return new t(e,{...n,expand:!1})}};export{T as C,M as S,k as _,S as a,A as b,x as c,F as d,I as f,D as g,B as h,H as i,R as l,N as m,G as n,C as o,L as p,U as r,w as s,X as t,z as u,O as v,E as w,j as x,P as y};