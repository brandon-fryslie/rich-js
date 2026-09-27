import{H as e,W as t,Y as n,c as r,m as i,z as a}from"./render-B0rzRb2R.js";import{b as o,d as s,g as c,h as l,m as u,o as d,p as f,x as p}from"./markup-DYQjoILc.js";var m=8,h=4,g=/^[\x00-\x7F]*$/,_={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},v=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),y=e=>({left:e[0],vertical:e[2],right:e[3]}),b=class e{top;bottom;grid;ascii;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let n=e.split(`
`);if(n.length!==m||n.some(e=>Array.from(e).length!==h)||n.some(e=>t(e)!==h))throw Error(`A box grid is ${m} lines of ${h} single-cell characters; got ${n.length} line(s) measuring `+n.map(e=>`${Array.from(e).length}/${t(e)}`).join(`, `)+` characters/cells`);let r=n.map(e=>Array.from(e));this.grid=e,this.ascii=g.test(e),this.top=v(r[0]),this.headContent=y(r[1]),this.headSeparator=v(r[2]),this.bodyContent=y(r[3]),this.rowSeparator=v(r[4]),this.footSeparator=v(r[5]),this.footContent=y(r[6]),this.bottom=v(r[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){return e.asciiOnly&&!this.ascii?x:e.safe?this.safeSubstitute():this}safeSubstitute(){return new e(Array.from(this.grid,e=>_[e]??e).join(``))}plainHeaded(){return B.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,i){let a=[];i&&a.push(new r(t.left,n));for(let i=0;i<e.length;i++)i>0&&a.push(new r(t.cross,n)),a.push(new r(t.horizontal.repeat(e[i]),n));return i&&a.push(new r(t.right,n)),a.push(r.line()),a}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},x=new b(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),S=new b(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),C=new b(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),w=new b(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),T=new b(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),E=new b(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),D=new b(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),O=new b(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),k=new b(`    
    
 ── 
    
    
 ── 
    
    `),A=new b(`    
    
 ── 
    
    
    
    
    `),j=new b(`    
    
 ━━ 
    
    
 ━━ 
    
    `),M=new b(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),N=new b(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),P=new b(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),F=new b(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),I=new b(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),L=new b(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),R=new b(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),z=new b(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),B=[[I,w],[T,w],[D,E],[O,E],[C,S]],V=class e{minimum;maximum;constructor(e,t){this.minimum=e,this.maximum=t}get span(){return this.maximum-this.minimum}normalize(){let t=e=>Number.isNaN(e)?0:e,n=Math.max(0,Math.min(t(this.minimum),t(this.maximum))),r=Math.max(0,t(this.maximum));return new e(n,r)}withMaximum(t){return new e(Math.min(this.minimum,t),Math.min(this.maximum,t))}withMinimum(t){let n=Math.max(this.minimum,t),r=Math.max(this.maximum,n);return new e(n,r)}clamp(t,n){return new e(Math.min(Math.max(this.minimum,t),n),Math.min(Math.max(this.maximum,t),n))}static get(t,n){if(t.maxWidth<1)return new e(0,0);let{minimum:r,maximum:i}=n.measure(t);return new e(r,Math.min(i,t.maxWidth)).normalize()}};function H(e,t){if(t.length===0)return new V(0,0);let n=0,r=0;for(let i of t){let t=V.get(e,i);n=Math.max(n,t.minimum),r=Math.max(r,t.maximum)}return new V(n,r)}function U(t){let n=t=>Number.isFinite(t)?e(t):0,r=typeof t==`number`?[t,t,t,t]:t.length===2?[t[0],t[1],t[0],t[1]]:t;return[n(r[0]),n(r[1]),n(r[2]),n(r[3])]}function W(t,n,r){let i=e(t),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(n),c=a(r);return{left:s,contentWidth:o+i,right:c}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,a,o,s]=U(t);this.renderable=e,this.top=r,this.right=a,this.bottom=o,this.left=s,this.style=n?.style??i,this.expand=n?.expand!==!1}*render(e){let t=o(e,this),n=W(t.maxWidth,this.left,this.right),i={...t,maxWidth:n.contentWidth,height:l(t.height,this.top+this.bottom)},a=[...this.renderable.render(i)],s=f(r.splitLines(a),i.height),c=u(t,this.style),d=c.isNull?void 0:c,p=new r(` `.repeat(n.left),d),m=new r(` `.repeat(n.right),d),h=new r(` `.repeat(G(n)),d);for(let e=0;e<this.top;e++)yield h,yield r.line();for(let e of s)yield p,yield*r.adjustLineLength(e,n.contentWidth,d,this.expand),yield m,yield r.line();for(let e=0;e<this.bottom;e++)yield h,yield r.line()}measure(e){let t=p(e),n=W(t.maxWidth,this.left,this.right),r=n.left+n.right;if(c(this.renderable)){let e=V.get({...t,maxWidth:n.contentWidth},this.renderable),i=Math.min(t.maxWidth,e.maximum+r);return{minimum:Math.min(e.minimum+r,i),maximum:i}}return{minimum:r,maximum:t.maxWidth}}};function q(e){let t=e instanceof s?e.copy():d(String(e??``));return t.end=``,t}function J(e){return!(e instanceof s)&&typeof e==`object`&&e&&`render`in e?e:q(e)}function Y(t,n){let[,r,,i]=n,a=e(t),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(r),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function X(e){return e.left+e.right+e.padLeft+e.padRight}function Z(e,t,n){return t===void 0?n:u(e,t)}var Q=class d{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=J(e),this.box=t?.box??N,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??i,this.borderStyle=t?.borderStyle??i,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(e){let t=o(e,this),n=t.asciiOnly?this.box.substitute({asciiOnly:!0}):this.box,r=u(t,this.borderStyle),i=u(t,this.style),a=r.isNull?void 0:r,s=i.isNull?void 0:i,c=Y(this._getPanelWidth(t),this.padding),[l,,d]=this.padding,f=this._renderContent(t,c.contentWidth);yield*this._renderTopBorder(t,n,c,a);for(let e=0;e<l;e++)yield*this._renderRow(n,c,[],a,s);for(let e of f)yield*this._renderRow(n,c,e,a,s);for(let e=0;e<d;e++)yield*this._renderRow(n,c,[],a,s);yield*this._renderBottomBorder(t,n,c,a)}_renderContent(e,t){let[n,,i]=this.padding,a=l(e.height,2+n+i),o={...e,maxWidth:t,height:a},s=f(r.splitLines([...this.renderable.render(o)]),a);return t===0?[]:s}*_renderRow(e,t,n,i,a){let o=e.getContentChars(`row`);yield new r(o.left.repeat(t.left),i);let s=r.adjustLineLength(n,t.contentWidth,a,!1),c=[new r(` `.repeat(t.padLeft),a),...s];yield*r.adjustLineLength(c,t.spanWidth,a),yield new r(o.right.repeat(t.right),i),yield r.line()}measure(e){let t=p(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=Y(e.maxWidth,this.padding),n=X(t);if(c(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=V.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:e(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,i,o,s){let c=o.spanWidth;if(!this.title){yield new r(i.top.left.repeat(o.left),s),yield new r(i.top.horizontal.repeat(c),s),yield new r(i.top.right.repeat(o.right),s),yield r.line();return}let l=` ${typeof this.title==`string`?this.title:this.title.plain} `,u=t(l),d=Z(e,this.titleStyle,s);if(yield new r(i.top.left.repeat(o.left),s),u>=c)yield new r(n(l,a(c)),d);else{let e=Math.floor((c-u)/2),t=c-u-e;e>0&&(yield new r(i.top.horizontal.repeat(e),s)),yield new r(l,d),t>0&&(yield new r(i.top.horizontal.repeat(t),s))}yield new r(i.top.right.repeat(o.right),s),yield r.line()}*_renderBottomBorder(e,o,c,l){let u=c.spanWidth,d=this._resolveAccessory(this.bottomRightAccessory),f=d===void 0?``:typeof d==`string`?` ${d} `:` ${d.plain} `,p=t(f),m=d instanceof s?d.resolvedStyle(e):i,h=m.isNull?l:m;yield new r(o.bottom.left.repeat(c.left),l);let g=Math.max(0,u-p);if(!this.subtitle)g>0&&(yield new r(o.bottom.horizontal.repeat(g),l));else{let i=` ${typeof this.subtitle==`string`?this.subtitle:this.subtitle.plain} `,s=t(i),c=Z(e,this.subtitleStyle,l);if(s>=g)yield new r(n(i,a(g)),c);else{let e=Math.floor((g-s)/2),t=g-s-e;e>0&&(yield new r(o.bottom.horizontal.repeat(e),l)),yield new r(i,c),t>0&&(yield new r(o.bottom.horizontal.repeat(t),l))}}if(p>0){let e=p>u?n(f,a(u)):f;yield new r(e,h)}yield new r(o.bottom.right.repeat(c.right),l),yield r.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new d(e,{...t,expand:!1})}};export{k as C,T as D,w as E,N as S,j as T,M as _,U as a,O as b,x as c,b as d,L as f,I as g,F as h,K as i,S as l,P as m,J as n,V as o,R as p,q as r,H as s,Q as t,C as u,z as v,A as w,D as x,E as y};