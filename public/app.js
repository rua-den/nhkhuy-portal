const glyphs = {workflow:"⌘",heart:"♡",code:"〈/〉",gamepad:"▣",globe:"◎",app:"↗"};
async function loadServices(){
 const root=document.querySelector("#services"), count=document.querySelector("#service-count");
 try{
  const res=await fetch("/api/services",{cache:"no-store"}); if(!res.ok) throw new Error("API unavailable");
  const services=await res.json(); count.textContent=`${services.length} ACTIVE SERVICES`;
  if(!services.length){root.innerHTML='<div class="empty">No services registered yet.</div>';return;}
  root.innerHTML=services.map(s=>`<a class="service" href="${escapeAttr(s.url)}" target="_blank" rel="noopener noreferrer"><div class="service-top"><span class="glyph">${glyphs[s.icon]||glyphs.app}</span><span class="arrow">↗</span></div><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.description||"Open service")}</p><span class="category">${escapeHtml(s.category||"Apps")}</span></a>`).join("");
 }catch(e){count.textContent="SERVICE REGISTRY OFFLINE";root.innerHTML='<div class="empty">Could not load services. Please try again later.</div>';}
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function escapeAttr(s){try{const u=new URL(s);return ["https:","http:"].includes(u.protocol)?escapeHtml(u.href):"#"}catch{return "#"}}
loadServices();
