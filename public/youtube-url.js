'use strict';
const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/,HOSTS=new Set(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be','youtube-nocookie.com','www.youtube-nocookie.com']);
function youtubeVideoId(value){try{const url=new URL(String(value).trim()),host=url.hostname.toLowerCase();if(!['https:','http:'].includes(url.protocol)||!HOSTS.has(host))return null;let id=null;if(host.endsWith('youtu.be'))id=url.pathname.split('/').filter(Boolean)[0];else if(url.pathname==='/watch')id=url.searchParams.get('v');else{const match=url.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/);if(match)id=match[1]}return id&&VIDEO_ID.test(id)?id:null}catch{return null}}
if(typeof module!=='undefined'&&module.exports)module.exports={youtubeVideoId};
