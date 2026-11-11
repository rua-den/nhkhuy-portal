'use strict';
const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/,HOSTS=new Set(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be','youtube-nocookie.com','www.youtube-nocookie.com']);
function parseUrl(value){try{const url=new URL(String(value).trim());return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url:null}catch{return null}}
function youtubeVideoId(value){const url=parseUrl(value);if(!url||!HOSTS.has(url.hostname.toLowerCase()))return null;let id=null,host=url.hostname.toLowerCase();if(host.endsWith('youtu.be'))id=url.pathname.split('/').filter(Boolean)[0];else if(url.pathname==='/watch')id=url.searchParams.get('v');else{const match=url.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/);if(match)id=match[1]}return id&&VIDEO_ID.test(id)?id:null}
function parseMediaEmbed(value){const input=String(value).trim(),tag=input.match(/^\s*<iframe\b([^>]*)>/i);let src=input,width,height;if(tag){const attrs=tag[1],source=attrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);if(!source)return null;src=source[2];const numeric=name=>{const match=attrs.match(new RegExp("\\b"+name+"\\s*=\\s*[\"']?(\\d{1,4})[\"']?","i"));return match&&Number(match[1])>0?Number(match[1]):null};width=numeric('width');height=numeric('height')}const url=parseUrl(src);if(!url)return null;const id=youtubeVideoId(url.href);return {src:id?`https://www.youtube-nocookie.com/embed/${id}`:url.href,ratio:width&&height?width+'/'+height:'16/9'} }
function appendEmbed(clips,embed){return clips.length<9?[...clips,embed]:clips}
function savedEmbed(value){if(!value||typeof value!=='object'||typeof value.src!=='string')return null;const parsed=parseMediaEmbed(value.src);if(!parsed)return null;const ratio=typeof value.ratio==='string'&&/^[1-9]\d{0,3}\/[1-9]\d{0,3}$/.test(value.ratio)?value.ratio:parsed.ratio;return {src:parsed.src,ratio}}
function addSaved(list,embed){return list.some(item=>item.src===embed.src)?list:[...list,embed]}
function removeSaved(list,src){return list.filter(item=>item.src!==src)}
function replaceActiveFrames(cells,clips,makeIframe){cells.forEach((cell,index)=>{if(cell.querySelector('iframe'))cell.replaceChildren(makeIframe(clips[index],index+1))})}
const EMBED_RELOAD_MS=30000;
if(typeof module!=='undefined'&&module.exports)module.exports={youtubeVideoId,parseMediaEmbed,appendEmbed,savedEmbed,addSaved,removeSaved,replaceActiveFrames,EMBED_RELOAD_MS};
