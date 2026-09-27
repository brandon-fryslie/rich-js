import{H as e,W as t,Y as n,c as r,m as i,z as a}from"./render-B0rzRb2R.js";import{a as o,d as s,i as c,o as l,r as u,t as d,u as f}from"./text-992TMWPQ.js";var p=8,m=4,h=/^[\x00-\x7F]*$/,g={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},_=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),v=e=>({left:e[0],vertical:e[2],right:e[3]}),y=class e{top;bottom;grid;ascii;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let n=e.split(`
`);if(n.length!==p||n.some(e=>Array.from(e).length!==m)||n.some(e=>t(e)!==m))throw Error(`A box grid is ${p} lines of ${m} single-cell characters; got ${n.length} line(s) measuring `+n.map(e=>`${Array.from(e).length}/${t(e)}`).join(`, `)+` characters/cells`);let r=n.map(e=>Array.from(e));this.grid=e,this.ascii=h.test(e),this.top=_(r[0]),this.headContent=v(r[1]),this.headSeparator=_(r[2]),this.bodyContent=v(r[3]),this.rowSeparator=_(r[4]),this.footSeparator=_(r[5]),this.footContent=v(r[6]),this.bottom=_(r[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){return e.asciiOnly&&!this.ascii?b:e.safe?this.safeSubstitute():this}safeSubstitute(){return new e(Array.from(this.grid,e=>g[e]??e).join(``))}plainHeaded(){return z.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,i){let a=[];i&&a.push(new r(t.left,n));for(let i=0;i<e.length;i++)i>0&&a.push(new r(t.cross,n)),a.push(new r(t.horizontal.repeat(e[i]),n));return i&&a.push(new r(t.right,n)),a.push(r.line()),a}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},b=new y(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),x=new y(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),S=new y(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),C=new y(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),w=new y(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),T=new y(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),E=new y(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),D=new y(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),O=new y(`    
    
 ── 
    
    
 ── 
    
    `),k=new y(`    
    
 ── 
    
    
    
    
    `),A=new y(`    
    
 ━━ 
    
    
 ━━ 
    
    `),j=new y(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),M=new y(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),N=new y(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),P=new y(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),F=new y(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),I=new y(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),L=new y(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),R=new y(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),z=[[F,C],[w,C],[E,T],[D,T],[S,x]],B=class e{minimum;maximum;constructor(e,t){this.minimum=e,this.maximum=t}get span(){return this.maximum-this.minimum}normalize(){let t=e=>Number.isNaN(e)?0:e,n=Math.max(0,Math.min(t(this.minimum),t(this.maximum))),r=Math.max(0,t(this.maximum));return new e(n,r)}withMaximum(t){return new e(Math.min(this.minimum,t),Math.min(this.maximum,t))}withMinimum(t){let n=Math.max(this.minimum,t),r=Math.max(this.maximum,n);return new e(n,r)}clamp(t,n){return new e(Math.min(Math.max(this.minimum,t),n),Math.min(Math.max(this.maximum,t),n))}static get(t,n){if(t.maxWidth<1)return new e(0,0);let{minimum:r,maximum:i}=n.measure(t);return new e(r,Math.min(i,t.maxWidth)).normalize()}};function V(e,t){if(t.length===0)return new B(0,0);let n=0,r=0;for(let i of t){let t=B.get(e,i);n=Math.max(n,t.minimum),r=Math.max(r,t.maximum)}return new B(n,r)}function H(t){let n=t=>Number.isFinite(t)?e(t):0,r=typeof t==`number`?[t,t,t,t]:t.length===2?[t[0],t[1],t[0],t[1]]:t;return[n(r[0]),n(r[1]),n(r[2]),n(r[3])]}function U(t,n,r){let i=e(t),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(n),c=a(r);return{left:s,contentWidth:o+i,right:c}}function W(e){return e.left+e.contentWidth+e.right}var G=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,a,o,s]=H(t);this.renderable=e,this.top=r,this.right=a,this.bottom=o,this.left=s,this.style=n?.style??i,this.expand=n?.expand!==!1}*render(e){let t=f(e,this),n=U(t.maxWidth,this.left,this.right),i={...t,maxWidth:n.contentWidth,height:o(t.height,this.top+this.bottom)},a=[...this.renderable.render(i)],s=u(r.splitLines(a),i.height),l=c(t,this.style),d=l.isNull?void 0:l,p=new r(` `.repeat(n.left),d),m=new r(` `.repeat(n.right),d),h=new r(` `.repeat(W(n)),d);for(let e=0;e<this.top;e++)yield h,yield r.line();for(let e of s)yield p,yield*r.adjustLineLength(e,n.contentWidth,d,this.expand),yield m,yield r.line();for(let e=0;e<this.bottom;e++)yield h,yield r.line()}measure(e){let t=s(e),n=U(t.maxWidth,this.left,this.right),r=n.left+n.right;if(l(this.renderable)){let e=B.get({...t,maxWidth:n.contentWidth},this.renderable),i=Math.min(t.maxWidth,e.maximum+r);return{minimum:Math.min(e.minimum+r,i),maximum:i}}return{minimum:r,maximum:t.maxWidth}}};function K(t,n){let[,r,,i]=n,a=e(t),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(r),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function q(e){return e.left+e.right+e.padLeft+e.padRight}function J(e,t,n){return t===void 0?n:c(e,t)}function Y(e){if(typeof e==`string`)return new d(e,{end:``});if(e instanceof d){let t=e.copy();return t.end=``,t}return e}var X=class p{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=Y(e),this.box=t?.box??M,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??i,this.borderStyle=t?.borderStyle??i,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=H(t?.padding??[0,1,0,1])}*render(e){let t=f(e,this),n=t.asciiOnly?this.box.substitute({asciiOnly:!0}):this.box,r=c(t,this.borderStyle),i=c(t,this.style),a=r.isNull?void 0:r,o=i.isNull?void 0:i,s=K(this._getPanelWidth(t),this.padding),[l,,u]=this.padding,d=this._renderContent(t,s.contentWidth);yield*this._renderTopBorder(t,n,s,a);for(let e=0;e<l;e++)yield*this._renderRow(n,s,[],a,o);for(let e of d)yield*this._renderRow(n,s,e,a,o);for(let e=0;e<u;e++)yield*this._renderRow(n,s,[],a,o);yield*this._renderBottomBorder(t,n,s,a)}_renderContent(e,t){let[n,,i]=this.padding,a=o(e.height,2+n+i),s={...e,maxWidth:t,height:a},c=u(r.splitLines([...this.renderable.render(s)]),a);return t===0?[]:c}*_renderRow(e,t,n,i,a){let o=e.getContentChars(`row`);yield new r(o.left.repeat(t.left),i);let s=r.adjustLineLength(n,t.contentWidth,a,!1),c=[new r(` `.repeat(t.padLeft),a),...s];yield*r.adjustLineLength(c,t.spanWidth,a),yield new r(o.right.repeat(t.right),i),yield r.line()}measure(e){let t=s(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=K(e.maxWidth,this.padding),n=q(t);if(l(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=B.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:e(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,i,o,s){let c=o.spanWidth;if(!this.title){yield new r(i.top.left.repeat(o.left),s),yield new r(i.top.horizontal.repeat(c),s),yield new r(i.top.right.repeat(o.right),s),yield r.line();return}let l=` ${typeof this.title==`string`?this.title:this.title.plain} `,u=t(l),d=J(e,this.titleStyle,s);if(yield new r(i.top.left.repeat(o.left),s),u>=c)yield new r(n(l,a(c)),d);else{let e=Math.floor((c-u)/2),t=c-u-e;e>0&&(yield new r(i.top.horizontal.repeat(e),s)),yield new r(l,d),t>0&&(yield new r(i.top.horizontal.repeat(t),s))}yield new r(i.top.right.repeat(o.right),s),yield r.line()}*_renderBottomBorder(e,o,s,c){let l=s.spanWidth,u=this._resolveAccessory(this.bottomRightAccessory),f=u===void 0?``:typeof u==`string`?` ${u} `:` ${u.plain} `,p=t(f),m=u instanceof d?u.resolvedStyle(e):i,h=m.isNull?c:m;yield new r(o.bottom.left.repeat(s.left),c);let g=Math.max(0,l-p);if(!this.subtitle)g>0&&(yield new r(o.bottom.horizontal.repeat(g),c));else{let i=` ${typeof this.subtitle==`string`?this.subtitle:this.subtitle.plain} `,s=t(i),l=J(e,this.subtitleStyle,c);if(s>=g)yield new r(n(i,a(g)),l);else{let e=Math.floor((g-s)/2),t=g-s-e;e>0&&(yield new r(o.bottom.horizontal.repeat(e),c)),yield new r(i,l),t>0&&(yield new r(o.bottom.horizontal.repeat(t),c))}}if(p>0){let e=p>l?n(f,a(l)):f;yield new r(e,h)}yield new r(o.bottom.right.repeat(s.right),c),yield r.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new p(e,{...t,expand:!1})}};export{A as C,k as S,w as T,T as _,V as a,M as b,S as c,L as d,N as f,R as g,j as h,B as i,y as l,F as m,G as n,b as o,P as p,H as r,x as s,X as t,I as u,D as v,C as w,O as x,E as y};