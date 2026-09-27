import{J as e,R as t,U as n,V as r,c as i,p as a}from"./render-B_CnH2P8.js";import{a as o,c as s,i as c,l,r as u,t as d}from"./text-CCqQo64J.js";var f=8,p=4,m=/^[\x00-\x7F]*$/,h={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},g=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),_=e=>({left:e[0],vertical:e[2],right:e[3]}),v=class e{top;bottom;grid;ascii;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==f||t.some(e=>Array.from(e).length!==p)||t.some(e=>n(e)!==p))throw Error(`A box grid is ${f} lines of ${p} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${n(e)}`).join(`, `)+` characters/cells`);let r=t.map(e=>Array.from(e));this.grid=e,this.ascii=m.test(e),this.top=g(r[0]),this.headContent=_(r[1]),this.headSeparator=g(r[2]),this.bodyContent=_(r[3]),this.rowSeparator=g(r[4]),this.footSeparator=g(r[5]),this.footContent=_(r[6]),this.bottom=g(r[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){return e.asciiOnly&&!this.ascii?y:e.safe?this.safeSubstitute():this}safeSubstitute(){return new e(Array.from(this.grid,e=>h[e]??e).join(``))}plainHeaded(){return R.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let a=[];r&&a.push(new i(t.left,n));for(let r=0;r<e.length;r++)r>0&&a.push(new i(t.cross,n)),a.push(new i(t.horizontal.repeat(e[r]),n));return r&&a.push(new i(t.right,n)),a.push(i.line()),a}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},y=new v(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),b=new v(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),x=new v(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),S=new v(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),C=new v(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),w=new v(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),T=new v(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),E=new v(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),D=new v(`    
    
 ── 
    
    
 ── 
    
    `),O=new v(`    
    
 ── 
    
    
    
    
    `),k=new v(`    
    
 ━━ 
    
    
 ━━ 
    
    `),A=new v(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),j=new v(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),M=new v(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),N=new v(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),P=new v(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),F=new v(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),I=new v(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),L=new v(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),R=[[P,S],[C,S],[T,w],[E,w],[x,b]],z=class e{minimum;maximum;constructor(e,t){this.minimum=e,this.maximum=t}get span(){return this.maximum-this.minimum}normalize(){let t=e=>Number.isNaN(e)?0:e,n=Math.max(0,Math.min(t(this.minimum),t(this.maximum))),r=Math.max(0,t(this.maximum));return new e(n,r)}withMaximum(t){return new e(Math.min(this.minimum,t),Math.min(this.maximum,t))}withMinimum(t){let n=Math.max(this.minimum,t),r=Math.max(this.maximum,n);return new e(n,r)}clamp(t,n){return new e(Math.min(Math.max(this.minimum,t),n),Math.min(Math.max(this.maximum,t),n))}static get(t,n){if(t.maxWidth<1)return new e(0,0);let{minimum:r,maximum:i}=n.measure(t);return new e(r,Math.min(i,t.maxWidth)).normalize()}};function B(e,t){if(t.length===0)return new z(0,0);let n=0,r=0;for(let i of t){let t=z.get(e,i);n=Math.max(n,t.minimum),r=Math.max(r,t.maximum)}return new z(n,r)}function V(e){let t=e=>Number.isFinite(e)?r(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function H(e,t,n){let i=r(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(t),c=a(n);return{left:s,contentWidth:o+i,right:c}}function U(e){return e.left+e.contentWidth+e.right}var W=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,o,s]=V(t);this.renderable=e,this.top=r,this.right=i,this.bottom=o,this.left=s,this.style=n?.style??a,this.expand=n?.expand!==!1}*render(e){let t=s(e,this),n=H(t.maxWidth,this.left,this.right),r={...t,maxWidth:n.contentWidth,height:c(t.height,this.top+this.bottom)},a=[...this.renderable.render(r)],o=i.splitLines(a),l=u(t,this.style),d=l.isNull?void 0:l,f=new i(` `.repeat(n.left),d),p=new i(` `.repeat(n.right),d),m=new i(` `.repeat(U(n)),d);for(let e=0;e<this.top;e++)yield m,yield i.line();for(let e of o)yield f,yield*i.adjustLineLength(e,n.contentWidth,d,this.expand),yield p,yield i.line();for(let e=0;e<this.bottom;e++)yield m,yield i.line()}measure(e){let t=l(e),n=H(t.maxWidth,this.left,this.right),r=n.left+n.right;if(o(this.renderable)){let e=z.get({...t,maxWidth:n.contentWidth},this.renderable),i=Math.min(t.maxWidth,e.maximum+r);return{minimum:Math.min(e.minimum+r,i),maximum:i}}return{minimum:r,maximum:t.maxWidth}}};function G(e,t){let[,n,,i]=t,a=r(e),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(n),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function K(e){return e.left+e.right+e.padLeft+e.padRight}function q(e,t,n){return t===void 0?n:u(e,t)}function J(e){if(typeof e==`string`)return new d(e,{end:``});if(e instanceof d){let t=e.copy();return t.end=``,t}return e}var Y=class f{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=J(e),this.box=t?.box??j,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??a,this.borderStyle=t?.borderStyle??a,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=V(t?.padding??[0,1,0,1])}*render(e){let t=s(e,this),n=t.asciiOnly?this.box.substitute({asciiOnly:!0}):this.box,r=u(t,this.borderStyle),i=u(t,this.style),a=r.isNull?void 0:r,o=i.isNull?void 0:i,c=G(this._getPanelWidth(t),this.padding),[l,,d]=this.padding,f=this._renderContent(t,c.contentWidth);yield*this._renderTopBorder(t,n,c,a);for(let e=0;e<l;e++)yield*this._renderRow(n,c,[],a,o);for(let e of f)yield*this._renderRow(n,c,e,a,o);for(let e=0;e<d;e++)yield*this._renderRow(n,c,[],a,o);yield*this._renderBottomBorder(t,n,c,a)}_renderContent(e,t){let[n,,r]=this.padding,a={...e,maxWidth:t,height:c(e.height,2+n+r)},o=i.splitLines([...this.renderable.render(a)]);return t===0?[]:o}*_renderRow(e,t,n,r,a){let o=e.getContentChars(`row`);yield new i(o.left.repeat(t.left),r);let s=i.adjustLineLength(n,t.contentWidth,a,!1),c=[new i(` `.repeat(t.padLeft),a),...s];yield*i.adjustLineLength(c,t.spanWidth,a),yield new i(o.right.repeat(t.right),r),yield i.line()}measure(e){let t=l(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=G(e.maxWidth,this.padding),n=K(t);if(o(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=z.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:r(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(r,a,o,s){let c=o.spanWidth;if(!this.title){yield new i(a.top.left.repeat(o.left),s),yield new i(a.top.horizontal.repeat(c),s),yield new i(a.top.right.repeat(o.right),s),yield i.line();return}let l=` ${typeof this.title==`string`?this.title:this.title.plain} `,u=n(l),d=q(r,this.titleStyle,s);if(yield new i(a.top.left.repeat(o.left),s),u>=c)yield new i(e(l,t(c)),d);else{let e=Math.floor((c-u)/2),t=c-u-e;e>0&&(yield new i(a.top.horizontal.repeat(e),s)),yield new i(l,d),t>0&&(yield new i(a.top.horizontal.repeat(t),s))}yield new i(a.top.right.repeat(o.right),s),yield i.line()}*_renderBottomBorder(r,o,s,c){let l=s.spanWidth,u=this._resolveAccessory(this.bottomRightAccessory),f=u===void 0?``:typeof u==`string`?` ${u} `:` ${u.plain} `,p=n(f),m=u instanceof d?u.resolvedStyle(r):a,h=m.isNull?c:m;yield new i(o.bottom.left.repeat(s.left),c);let g=Math.max(0,l-p);if(!this.subtitle)g>0&&(yield new i(o.bottom.horizontal.repeat(g),c));else{let a=` ${typeof this.subtitle==`string`?this.subtitle:this.subtitle.plain} `,s=n(a),l=q(r,this.subtitleStyle,c);if(s>=g)yield new i(e(a,t(g)),l);else{let e=Math.floor((g-s)/2),t=g-s-e;e>0&&(yield new i(o.bottom.horizontal.repeat(e),c)),yield new i(a,l),t>0&&(yield new i(o.bottom.horizontal.repeat(t),c))}}if(p>0){let n=p>l?e(f,t(l)):f;yield new i(n,h)}yield new i(o.bottom.right.repeat(s.right),c),yield i.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new f(e,{...t,expand:!1})}};export{k as C,O as S,C as T,w as _,B as a,j as b,x as c,I as d,M as f,L as g,A as h,z as i,v as l,P as m,W as n,y as o,N as p,V as r,b as s,Y as t,F as u,E as v,S as w,D as x,T as y};