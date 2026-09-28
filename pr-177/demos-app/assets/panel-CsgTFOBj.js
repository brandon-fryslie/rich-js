import{H as e,W as t,Y as n,c as r,m as i,z as a}from"./render-B0rzRb2R.js";import{C as o,_ as s,g as c,m as l,r as u,t as d,v as f,w as p,y as m}from"./embed-7pqrACmE.js";var h=8,g=4,_=/^[\x00-\x7F]*$/,v={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},y=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),b=e=>({left:e[0],vertical:e[2],right:e[3]}),x=class e{top;bottom;grid;ascii;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let n=e.split(`
`);if(n.length!==h||n.some(e=>Array.from(e).length!==g)||n.some(e=>t(e)!==g))throw Error(`A box grid is ${h} lines of ${g} single-cell characters; got ${n.length} line(s) measuring `+n.map(e=>`${Array.from(e).length}/${t(e)}`).join(`, `)+` characters/cells`);let r=n.map(e=>Array.from(e));this.grid=e,this.ascii=_.test(e),this.top=y(r[0]),this.headContent=b(r[1]),this.headSeparator=y(r[2]),this.bodyContent=b(r[3]),this.rowSeparator=y(r[4]),this.footSeparator=y(r[5]),this.footContent=b(r[6]),this.bottom=y(r[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){return e.asciiOnly&&!this.ascii?S:e.safe?this.safeSubstitute():this}safeSubstitute(){return new e(Array.from(this.grid,e=>v[e]??e).join(``))}plainHeaded(){return V.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,i){let a=[];i&&a.push(new r(t.left,n));for(let i=0;i<e.length;i++)i>0&&a.push(new r(t.cross,n)),a.push(new r(t.horizontal.repeat(e[i]),n));return i&&a.push(new r(t.right,n)),a.push(r.line()),a}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},S=new x(`+--+
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
    `),V=[[L,T],[E,T],[O,D],[k,D],[w,C]],H=class e{minimum;maximum;constructor(e,t){this.minimum=e,this.maximum=t}get span(){return this.maximum-this.minimum}normalize(){let t=e=>Number.isNaN(e)?0:e,n=Math.max(0,Math.min(t(this.minimum),t(this.maximum))),r=Math.max(0,t(this.maximum));return new e(n,r)}withMaximum(t){return new e(Math.min(this.minimum,t),Math.min(this.maximum,t))}withMinimum(t){let n=Math.max(this.minimum,t),r=Math.max(this.maximum,n);return new e(n,r)}clamp(t,n){return new e(Math.min(Math.max(this.minimum,t),n),Math.min(Math.max(this.maximum,t),n))}static get(t,n){if(t.maxWidth<1)return new e(0,0);let{minimum:r,maximum:i}=n.measure(t);return new e(r,Math.min(i,t.maxWidth)).normalize()}};function U(e,t){if(t.length===0)return new H(0,0);let n=0,r=0;for(let i of t){let t=H.get(e,i);n=Math.max(n,t.minimum),r=Math.max(r,t.maximum)}return new H(n,r)}function W(t){let n=t=>Number.isFinite(t)?e(t):0,r=typeof t==`number`?[t,t,t,t]:t.length===2?[t[0],t[1],t[0],t[1]]:t;return[n(r[0]),n(r[1]),n(r[2]),n(r[3])]}function G(t,n,r){let i=e(t),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(n),c=a(r);return{left:s,contentWidth:o+i,right:c}}function K(e){return e.left+e.contentWidth+e.right}var q=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,a,o,s]=W(t);this.renderable=e,this.top=r,this.right=a,this.bottom=o,this.left=s,this.style=n?.style??i,this.expand=n?.expand!==!1}*render(e){let t=o(e,this),n=G(t.maxWidth,this.left,this.right),i={...t,maxWidth:n.contentWidth,height:f(t.height,this.top+this.bottom)},a=[...this.renderable.render(i)],l=c(r.splitLines(a),i.height),u=s(t,this.style),d=u.isNull?void 0:u,p=new r(` `.repeat(n.left),d),m=new r(` `.repeat(n.right),d),h=new r(` `.repeat(K(n)),d);for(let e=0;e<this.top;e++)yield h,yield r.line();for(let e of l)yield p,yield*r.adjustLineLength(e,n.contentWidth,d,this.expand),yield m,yield r.line();for(let e=0;e<this.bottom;e++)yield h,yield r.line()}measure(e){let t=p(e),n=G(t.maxWidth,this.left,this.right),r=n.left+n.right;if(m(this.renderable)){let e=H.get({...t,maxWidth:n.contentWidth},this.renderable),i=Math.min(t.maxWidth,e.maximum+r);return{minimum:Math.min(e.minimum+r,i),maximum:i}}return{minimum:r,maximum:t.maxWidth}}};function J(t,n){let[,r,,i]=n,a=e(t),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(r),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function Y(e){return e.left+e.right+e.padLeft+e.padRight}function X(e,t,n){return t===void 0?n:s(e,t)}var Z=class h{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=d(e),this.box=t?.box??P,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??i,this.borderStyle=t?.borderStyle??i,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=W(t?.padding??[0,1,0,1])}*render(e){let t=o(e,this),n=t.asciiOnly?this.box.substitute({asciiOnly:!0}):this.box,r=s(t,this.borderStyle),i=s(t,this.style),a=r.isNull?void 0:r,c=i.isNull?void 0:i,l=J(this._getPanelWidth(t),this.padding),[u,,d]=this.padding,f=this._renderContent(t,l.contentWidth);yield*this._renderTopBorder(t,n,l,a);for(let e=0;e<u;e++)yield*this._renderRow(n,l,[],a,c);for(let e of f)yield*this._renderRow(n,l,e,a,c);for(let e=0;e<d;e++)yield*this._renderRow(n,l,[],a,c);yield*this._renderBottomBorder(t,n,l,a)}_renderContent(e,t){let[n,,i]=this.padding,a=f(e.height,2+n+i),o={...e,maxWidth:t,height:a},s=c(r.splitLines([...this.renderable.render(o)]),a);return t===0?[]:s}*_renderRow(e,t,n,i,a){let o=e.getContentChars(`row`);yield new r(o.left.repeat(t.left),i);let s=r.adjustLineLength(n,t.contentWidth,a,!1),c=[new r(` `.repeat(t.padLeft),a),...s];yield*r.adjustLineLength(c,t.spanWidth,a),yield new r(o.right.repeat(t.right),i),yield r.line()}measure(e){let t=p(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=J(e.maxWidth,this.padding),n=Y(t);if(m(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=H.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:e(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,n,i){let a=n.spanWidth,o=X(e,this.titleStyle,i),s=u(this.title,e,o),c=r.getLineLength(s);if(c===0){yield new r(t.top.left.repeat(n.left),i),yield new r(t.top.horizontal.repeat(a),i),yield new r(t.top.right.repeat(n.right),i),yield r.line();return}if(yield new r(t.top.left.repeat(n.left),i),c>=a)yield*r.adjustLineLength(s,a,o);else{let e=Math.floor((a-c)/2),n=a-c-e;e>0&&(yield new r(t.top.horizontal.repeat(e),i)),yield*s,n>0&&(yield new r(t.top.horizontal.repeat(n),i))}yield new r(t.top.right.repeat(n.right),i),yield r.line()}*_renderBottomBorder(e,o,s,c){let d=s.spanWidth,f=this._resolveAccessory(this.bottomRightAccessory),p=f===void 0?``:typeof f==`string`?` ${f} `:` ${f.plain} `,m=t(p),h=f instanceof l?f.resolvedStyle(e):i,g=h.isNull?c:h;yield new r(o.bottom.left.repeat(s.left),c);let _=Math.max(0,d-m),v=X(e,this.subtitleStyle,c),y=u(this.subtitle,e,v),b=r.getLineLength(y);if(b===0)_>0&&(yield new r(o.bottom.horizontal.repeat(_),c));else if(b>=_)yield*r.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new r(o.bottom.horizontal.repeat(e),c)),yield*y,t>0&&(yield new r(o.bottom.horizontal.repeat(t),c))}if(m>0){let e=m>d?n(p,a(d)):p;yield new r(e,g)}yield new r(o.bottom.right.repeat(s.right),c),yield r.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new h(e,{...t,expand:!1})}};export{M as C,j as S,E as T,D as _,U as a,P as b,w as c,z as d,F as f,B as g,N as h,H as i,x as l,L as m,q as n,S as o,I as p,W as r,C as s,Z as t,R as u,k as v,T as w,A as x,O as y};