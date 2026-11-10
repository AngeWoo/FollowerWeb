// 簡易密碼閘門（前端驗證，只存雜湊值）。更換密碼：
//   printf '新密碼' | shasum -a 256   把結果貼到下面 HASH
const HASH = "0a93e35bd80e112fb28157d3c43574ab534b4b6d667c096b6914663b32599ba9";
function sha256(s){const K=[];let p=2;while(K.length<64){let ok=1;for(let i=2;i*i<=p;i++)if(p%i==0){ok=0;break}if(ok)K.push((Math.cbrt(p)%1)*4294967296|0);p++}
 const b=unescape(encodeURIComponent(s)),w=[];for(let i=0;i<b.length;i++)w[i>>2]|=b.charCodeAt(i)<<(24-(i%4)*8);
 const L=b.length*8;w[L>>5]|=0x80<<(24-L%32);w[((L+64>>9)<<4)+15]=L;
 let H=[],q=2,n=0;while(n<8){let ok=1;for(let i=2;i*i<=q;i++)if(q%i==0){ok=0;break}if(ok){H.push((Math.sqrt(q)%1)*4294967296|0);n++}q++}
 const r=(x,n)=>x>>>n|x<<(32-n);
 for(let o=0;o<w.length;o+=16){const a=H.slice(),m=[];
  for(let t=0;t<64;t++){if(t<16)m[t]=w[o+t]|0;else{const x=m[t-15],y=m[t-2];m[t]=(m[t-16]+(r(x,7)^r(x,18)^x>>>3)+m[t-7]+(r(y,17)^r(y,19)^y>>>10))|0}
   const t1=(a[7]+(r(a[4],6)^r(a[4],11)^r(a[4],25))+((a[4]&a[5])^(~a[4]&a[6]))+K[t]+m[t])|0;
   const t2=((r(a[0],2)^r(a[0],13)^r(a[0],22))+((a[0]&a[1])^(a[0]&a[2])^(a[1]&a[2])))|0;
   a.pop();a.unshift((t1+t2)|0);a[4]=(a[4]+t1)|0}
  for(let i=0;i<8;i++)H[i]=(H[i]+a[i])|0}
 return H.map(x=>(x>>>0).toString(16).padStart(8,"0")).join("")}
const ok = () => { document.body.classList.remove("locked"); window.scrollTo(0, 0); };
try { if (sessionStorage.getItem("ok") === HASH) ok(); } catch (e) {}
document.getElementById("gform").addEventListener("submit", e => {
  e.preventDefault();
  if (sha256(document.getElementById("gpw").value.trim()) === HASH) {
    try { sessionStorage.setItem("ok", HASH); } catch (e) {}
    ok();
  } else {
    document.getElementById("gerr").textContent = "密碼錯誤，請再試一次";
    document.getElementById("gpw").value = ""; document.getElementById("gpw").focus();
  }
});
