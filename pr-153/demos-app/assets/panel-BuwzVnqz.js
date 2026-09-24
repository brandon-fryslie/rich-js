import{I as e,N as t,R as n,U as r,a as i,u as a}from"./render-JFVmkDYr.js";import{i as o,o as s,r as c,s as l,t as u}from"./text-DBNwfvLw.js";var d=8,f=4,p=/^[\x00-\x7F]*$/,m={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},h=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),g=e=>({left:e[0],vertical:e[2],right:e[3]}),_=class e{top;bottom;grid;ascii;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==d||t.some(e=>Array.from(e).length!==f)||t.some(e=>n(e)!==f))throw Error(`A box grid is ${d} lines of ${f} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${n(e)}`).join(`, `)+` characters/cells`);let r=t.map(e=>Array.from(e));this.grid=e,this.ascii=p.test(e),this.top=h(r[0]),this.headContent=g(r[1]),this.headSeparator=h(r[2]),this.bodyContent=g(r[3]),this.rowSeparator=h(r[4]),this.footSeparator=h(r[5]),this.footContent=g(r[6]),this.bottom=h(r[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){return e.asciiOnly&&!this.ascii?v:e.safe?this.safeSubstitute():this}safeSubstitute(){return new e(Array.from(this.grid,e=>m[e]??e).join(``))}plainHeaded(){return L.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let a=[];r&&a.push(new i(t.left,n));for(let r=0;r<e.length;r++)r>0&&a.push(new i(t.cross,n)),a.push(new i(t.horizontal.repeat(e[r]),n));return r&&a.push(new i(t.right,n)),a.push(i.line()),a}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},v=new _(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),y=new _(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),b=new _(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),x=new _(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),S=new _(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),C=new _(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),w=new _(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),T=new _(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),E=new _(`    
    
 ── 
    
    
 ── 
    
    `),D=new _(`    
    
 ── 
    
    
    
    
    `),O=new _(`    
    
 ━━ 
    
    
 ━━ 
    
    `),k=new _(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),A=new _(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),j=new _(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),M=new _(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),N=new _(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),P=new _(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),F=new _(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),I=new _(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),L=[[N,x],[S,x],[w,C],[T,C],[b,y]],R=class e{minimum;maximum;constructor(e,t){this.minimum=e,this.maximum=t}get span(){return this.maximum-this.minimum}normalize(){let t=e=>Number.isNaN(e)?0:e,n=Math.max(0,Math.min(t(this.minimum),t(this.maximum))),r=Math.max(0,t(this.maximum));return new e(n,r)}withMaximum(t){return new e(Math.min(this.minimum,t),Math.min(this.maximum,t))}withMinimum(t){let n=Math.max(this.minimum,t),r=Math.max(this.maximum,n);return new e(n,r)}clamp(t,n){return new e(Math.min(Math.max(this.minimum,t),n),Math.min(Math.max(this.maximum,t),n))}static get(t,n){if(t.maxWidth<1)return new e(0,0);let{minimum:r,maximum:i}=n.measure(t);return new e(r,Math.min(i,t.maxWidth)).normalize()}};function z(e,t){if(t.length===0)return new R(0,0);let n=0,r=0;for(let i of t){let t=R.get(e,i);n=Math.max(n,t.minimum),r=Math.max(r,t.maximum)}return new R(n,r)}function B(t){let n=t=>Number.isFinite(t)?e(t):0,r=typeof t==`number`?[t,t,t,t]:t.length===2?[t[0],t[1],t[0],t[1]]:t;return[n(r[0]),n(r[1]),n(r[2]),n(r[3])]}function V(t,n,r){let i=e(t),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(n),c=a(r);return{left:s,contentWidth:o+i,right:c}}function H(e){return e.left+e.contentWidth+e.right}var U=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,o,s]=B(t);this.renderable=e,this.top=r,this.right=i,this.bottom=o,this.left=s,this.style=n?.style??a,this.expand=n?.expand!==!1}*render(e){let t=s(e,this),n=V(t.maxWidth,this.left,this.right),r={...t,maxWidth:n.contentWidth},a=[...this.renderable.render(r)],o=i.splitLines(a),l=c(t,this.style),u=l.isNull?void 0:l,d=new i(` `.repeat(n.left),u),f=new i(` `.repeat(n.right),u),p=new i(` `.repeat(H(n)),u);for(let e=0;e<this.top;e++)yield p,yield i.line();for(let e of o)yield d,yield*i.adjustLineLength(e,n.contentWidth,u,this.expand),yield f,yield i.line();for(let e=0;e<this.bottom;e++)yield p,yield i.line()}measure(e){let t=l(e),n=V(t.maxWidth,this.left,this.right),r=n.left+n.right;if(o(this.renderable)){let e=R.get({...t,maxWidth:n.contentWidth},this.renderable),i=Math.min(t.maxWidth,e.maximum+r);return{minimum:Math.min(e.minimum+r,i),maximum:i}}return{minimum:r,maximum:t.maxWidth}}};function W(t,n){let[,r,,i]=n,a=e(t),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(r),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function G(e){return e.left+e.right+e.padLeft+e.padRight}function K(e,t,n){return t===void 0?n:c(e,t)}function q(e){if(typeof e==`string`)return new u(e,{end:``});if(e instanceof u){let t=e.copy();return t.end=``,t}return e}var J=class d{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=q(e),this.box=t?.box??A,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??a,this.borderStyle=t?.borderStyle??a,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=B(t?.padding??[0,1,0,1])}*render(e){let t=s(e,this),n=t.asciiOnly?this.box.substitute({asciiOnly:!0}):this.box,r=c(t,this.borderStyle),i=c(t,this.style),a=r.isNull?void 0:r,o=i.isNull?void 0:i,l=W(this._getPanelWidth(t),this.padding),[u,,d]=this.padding,f=this._renderContent(t,l.contentWidth);yield*this._renderTopBorder(t,n,l,a);for(let e=0;e<u;e++)yield*this._renderRow(n,l,[],a,o);for(let e of f)yield*this._renderRow(n,l,e,a,o);for(let e=0;e<d;e++)yield*this._renderRow(n,l,[],a,o);yield*this._renderBottomBorder(t,n,l,a)}_renderContent(e,t){let n={...e,maxWidth:t},r=i.splitLines([...this.renderable.render(n)]);return t===0?[]:r}*_renderRow(e,t,n,r,a){let o=e.getContentChars(`row`);yield new i(o.left.repeat(t.left),r);let s=i.adjustLineLength(n,t.contentWidth,a,!1),c=[new i(` `.repeat(t.padLeft),a),...s];yield*i.adjustLineLength(c,t.spanWidth,a),yield new i(o.right.repeat(t.right),r),yield i.line()}measure(e){let t=l(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=W(e.maxWidth,this.padding),n=G(t);if(o(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=R.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:e(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,a,o,s){let c=o.spanWidth;if(!this.title){yield new i(a.top.left.repeat(o.left),s),yield new i(a.top.horizontal.repeat(c),s),yield new i(a.top.right.repeat(o.right),s),yield i.line();return}let l=` ${typeof this.title==`string`?this.title:this.title.plain} `,u=n(l),d=K(e,this.titleStyle,s);if(yield new i(a.top.left.repeat(o.left),s),u>=c)yield new i(r(l,t(c)),d);else{let e=Math.floor((c-u)/2),t=c-u-e;e>0&&(yield new i(a.top.horizontal.repeat(e),s)),yield new i(l,d),t>0&&(yield new i(a.top.horizontal.repeat(t),s))}yield new i(a.top.right.repeat(o.right),s),yield i.line()}*_renderBottomBorder(e,o,s,c){let l=s.spanWidth,d=this._resolveAccessory(this.bottomRightAccessory),f=d===void 0?``:typeof d==`string`?` ${d} `:` ${d.plain} `,p=n(f),m=d instanceof u?d.resolvedStyle(e):a,h=m.isNull?c:m;yield new i(o.bottom.left.repeat(s.left),c);let g=Math.max(0,l-p);if(!this.subtitle)g>0&&(yield new i(o.bottom.horizontal.repeat(g),c));else{let a=` ${typeof this.subtitle==`string`?this.subtitle:this.subtitle.plain} `,s=n(a),l=K(e,this.subtitleStyle,c);if(s>=g)yield new i(r(a,t(g)),l);else{let e=Math.floor((g-s)/2),t=g-s-e;e>0&&(yield new i(o.bottom.horizontal.repeat(e),c)),yield new i(a,l),t>0&&(yield new i(o.bottom.horizontal.repeat(t),c))}}if(p>0){let e=p>l?r(f,t(l)):f;yield new i(e,h)}yield new i(o.bottom.right.repeat(s.right),c),yield i.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new d(e,{...t,expand:!1})}};export{O as C,D as S,S as T,C as _,z as a,A as b,b as c,F as d,j as f,I as g,k as h,R as i,_ as l,N as m,U as n,v as o,M as p,B as r,y as s,J as t,P as u,T as v,x as w,E as x,w as y};