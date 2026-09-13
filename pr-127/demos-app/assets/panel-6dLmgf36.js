import{c as w,S as o,f as b,N as x,s as M,d as E}from"./render-mNyGdj8d.js";import{w as U,g as S,a as z,i as P,R as L}from"./text-CwChYNcN.js";const D=8,R=4,j=/^[\x00-\x7F]*$/,Y={"╭":"┌","╮":"┐","╰":"└","╯":"┘"},p=r=>({left:r[0],horizontal:r[1],cross:r[2],right:r[3]}),C=r=>({left:r[0],vertical:r[2],right:r[3]});class d{top;bottom;grid;ascii;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(n){const t=n.split(`
`);if(t.length!==D||t.some(s=>Array.from(s).length!==R)||t.some(s=>w(s)!==R))throw new Error(`A box grid is ${D} lines of ${R} single-cell characters; got ${t.length} line(s) measuring `+t.map(s=>`${Array.from(s).length}/${w(s)}`).join(", ")+" characters/cells");const i=t.map(s=>Array.from(s));this.grid=n,this.ascii=j.test(n),this.top=p(i[0]),this.headContent=C(i[1]),this.headSeparator=p(i[2]),this.bodyContent=C(i[3]),this.rowSeparator=p(i[4]),this.footSeparator=p(i[5]),this.footContent=C(i[6]),this.bottom=p(i[7])}getTop(n,t,e=!0){return this.getEdge(n,this.top,t,e)}getRow(n,t,e,i=!0){return this.getEdge(n,this.getRowChars(t),e,i)}getContentChars(n){switch(n){case"head":return this.headContent;case"row":case"mid":return this.bodyContent;case"foot":return this.footContent}}getBottom(n,t,e=!0){return this.getEdge(n,this.bottom,t,e)}substitute(n={}){return n.asciiOnly&&!this.ascii?G:n.safe?this.safeSubstitute():this}safeSubstitute(){return new d(Array.from(this.grid,n=>Y[n]??n).join(""))}plainHeaded(){return J.find(([n])=>n.grid===this.grid)?.[1]??this}getEdge(n,t,e,i){const s=[];i&&s.push(new o(t.left,e));for(let a=0;a<n.length;a++)a>0&&s.push(new o(t.cross,e)),s.push(new o(t.horizontal.repeat(n[a]),e));return i&&s.push(new o(t.right,e)),s.push(o.line()),s}getRowChars(n){switch(n){case"head":return this.headSeparator;case"row":return this.rowSeparator;case"foot":return this.footSeparator;case"mid":return{left:this.bodyContent.left,horizontal:" ",cross:this.bodyContent.vertical,right:this.bodyContent.right}}}}const G=new d(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),V=new d(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),k=new d(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),O=new d(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),F=new d(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),N=new d(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),Q=new d(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),q=new d(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),st=new d(`    
    
 ── 
    
    
 ── 
    
    `),rt=new d(`    
    
 ── 
    
    
    
    
    `),ot=new d(`    
    
 ━━ 
    
    
 ━━ 
    
    `),at=new d(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),K=new d(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),ht=new d(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),lt=new d(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),Z=new d(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),dt=new d(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),ct=new d(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),mt=new d(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),J=[[Z,O],[F,O],[Q,N],[q,N],[k,V]];class y{minimum;maximum;constructor(n,t){this.minimum=n,this.maximum=t}get span(){return this.maximum-this.minimum}normalize(){const n=i=>Number.isNaN(i)?0:i,t=Math.max(0,Math.min(n(this.minimum),n(this.maximum))),e=Math.max(0,n(this.maximum));return new y(t,e)}withMaximum(n){return new y(Math.min(this.minimum,n),Math.min(this.maximum,n))}withMinimum(n){const t=Math.max(this.minimum,n),e=Math.max(this.maximum,t);return new y(t,e)}clamp(n,t){return new y(Math.min(Math.max(this.minimum,n),t),Math.min(Math.max(this.maximum,n),t))}static get(n,t){if(n.maxWidth<1)return new y(0,0);const{minimum:e,maximum:i}=t.measure(n);return new y(e,Math.min(i,n.maxWidth)).normalize()}}function ut(r,n){if(n.length===0)return new y(0,0);let t=0,e=0;for(const i of n){const s=y.get(r,i);t=Math.max(t,s.minimum),e=Math.max(e,s.maximum)}return new y(t,e)}function $(r){const n=e=>Number.isFinite(e)?b(e):0,t=typeof r=="number"?[r,r,r,r]:r.length===2?[r[0],r[1],r[0],r[1]]:r;return[n(t[0]),n(t[1]),n(t[2]),n(t[3])]}function B(r,n,t){let e=b(r);const i=h=>{const u=Math.min(h,e);return e-=u,u},s=i(1),a=i(n),l=i(t);return{left:a,contentWidth:s+e,right:l}}function X(r){return r.left+r.contentWidth+r.right}class ft{renderable;top;right;bottom;left;style;expand;constructor(n,t,e){const[i,s,a,l]=$(t);this.renderable=n,this.top=i,this.right=s,this.bottom=a,this.left=l,this.style=e?.style??x,this.expand=e?.expand!==!1}*render(n){const t=U(n,this),e=B(t.maxWidth,this.left,this.right),i={...t,maxWidth:e.contentWidth},s=[...this.renderable.render(i)],a=o.splitLines(s),l=S(t,this.style),h=l.isNull?void 0:l,u=new o(" ".repeat(e.left),h),f=new o(" ".repeat(e.right),h),m=new o(" ".repeat(X(e)),h);for(let c=0;c<this.top;c++)yield m,yield o.line();for(const c of a)yield u,yield*o.adjustLineLength(c,e.contentWidth,h,this.expand),yield f,yield o.line();for(let c=0;c<this.bottom;c++)yield m,yield o.line()}measure(n){const t=z(n),e=B(t.maxWidth,this.left,this.right),i=e.left+e.right;if(P(this.renderable)){const s=y.get({...t,maxWidth:e.contentWidth},this.renderable),a=Math.min(t.maxWidth,s.maximum+i);return{minimum:Math.min(s.minimum+i,a),maximum:a}}return{minimum:i,maximum:t.maxWidth}}}function T(r,n){const[,t,,e]=n;let i=b(r);const s=c=>{const g=Math.min(c,i);return i-=g,g},a=s(1),l=s(1),h=s(1),u=s(e),f=s(t),m=h+i;return{left:a,right:l,padLeft:u,contentWidth:m,padRight:f,spanWidth:u+m+f}}function tt(r){return r.left+r.right+r.padLeft+r.padRight}function H(r,n,t){return n===void 0?t:S(r,n)}function nt(r){return typeof r=="string"?new L(r):(r instanceof L,r)}class v{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(n,t){this.renderable=nt(n),this.box=t?.box??K,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??x,this.borderStyle=t?.borderStyle??x,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=$(t?.padding??[0,1,0,1])}*render(n){const t=U(n,this),e=t.asciiOnly?this.box.substitute({asciiOnly:!0}):this.box,i=S(t,this.borderStyle),s=S(t,this.style),a=i.isNull?void 0:i,l=s.isNull?void 0:s,h=T(this._getPanelWidth(t),this.padding),[u,,f]=this.padding,m=this._renderContent(t,h.contentWidth);yield*this._renderTopBorder(t,e,h,a);for(let c=0;c<u;c++)yield*this._renderRow(e,h,[],a,l);for(const c of m)yield*this._renderRow(e,h,c,a,l);for(let c=0;c<f;c++)yield*this._renderRow(e,h,[],a,l);yield*this._renderBottomBorder(t,e,h,a)}_renderContent(n,t){const e={...n,maxWidth:t},i=o.splitLines([...this.renderable.render(e)]);return t===0?[]:i}*_renderRow(n,t,e,i,s){const a=n.getContentChars("row");yield new o(a.left.repeat(t.left),i);const l=o.adjustLineLength(e,t.contentWidth,s,!1),h=[new o(" ".repeat(t.padLeft),s),...l];yield*o.adjustLineLength(h,t.spanWidth,s),yield new o(a.right.repeat(t.right),i),yield o.line()}measure(n){const t=z(n),e=this._declaredWidth;if(e!==void 0){const i=Math.min(t.maxWidth,e);return{minimum:i,maximum:i}}return this._fitRange(t)}_fitRange(n){const t=T(n.maxWidth,this.padding),e=tt(t);if(P(this.renderable)){const i={...n,maxWidth:t.contentWidth},s=y.get(i,this.renderable),a=Math.min(n.maxWidth,s.maximum+e);return{minimum:Math.min(s.minimum+e,a),maximum:a}}return{minimum:Math.min(e,n.maxWidth),maximum:n.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:b(this.width)}_getPanelWidth(n){const t=this._declaredWidth;return t!==void 0?Math.min(t,n.maxWidth):this.expand?n.maxWidth:this._fitRange(n).maximum}*_renderTopBorder(n,t,e,i){const s=e.spanWidth;if(!this.title){yield new o(t.top.left.repeat(e.left),i),yield new o(t.top.horizontal.repeat(s),i),yield new o(t.top.right.repeat(e.right),i),yield o.line();return}const l=` ${typeof this.title=="string"?this.title:this.title.plain} `,h=w(l),u=H(n,this.titleStyle,i);if(yield new o(t.top.left.repeat(e.left),i),h>=s)yield new o(M(l,E(s)),u);else{const f=Math.floor((s-h)/2),m=s-h-f;f>0&&(yield new o(t.top.horizontal.repeat(f),i)),yield new o(l,u),m>0&&(yield new o(t.top.horizontal.repeat(m),i))}yield new o(t.top.right.repeat(e.right),i),yield o.line()}*_renderBottomBorder(n,t,e,i){const s=e.spanWidth,a=this._resolveAccessory(this.bottomRightAccessory),l=a===void 0?"":typeof a=="string"?` ${a} `:` ${a.plain} `,h=w(l),u=a instanceof L?a.resolvedStyle(n):x,f=u.isNull?i:u;yield new o(t.bottom.left.repeat(e.left),i);const m=Math.max(0,s-h);if(!this.subtitle)m>0&&(yield new o(t.bottom.horizontal.repeat(m),i));else{const g=` ${typeof this.subtitle=="string"?this.subtitle:this.subtitle.plain} `,W=w(g),_=H(n,this.subtitleStyle,i);if(W>=m)yield new o(M(g,E(m)),_);else{const A=Math.floor((m-W)/2),I=m-W-A;A>0&&(yield new o(t.bottom.horizontal.repeat(A),i)),yield new o(g,_),I>0&&(yield new o(t.bottom.horizontal.repeat(I),i))}}if(h>0){const c=h>s?M(l,E(s)):l;yield new o(c,f)}yield new o(t.bottom.right.repeat(e.right),i),yield o.line()}_resolveAccessory(n){if(n!==void 0)return typeof n=="function"?n():n}static fit(n,t){return new v(n,{...t,expand:!1})}}export{G as A,d as B,dt as D,at as H,y as M,v as P,K as R,O as S,ft as a,V as b,k as c,F as d,N as e,Q as f,q as g,st as h,rt as i,ot as j,ht as k,lt as l,Z as m,ct as n,mt as o,ut as p,$ as q};
