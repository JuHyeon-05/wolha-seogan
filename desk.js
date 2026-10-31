'use strict';
const $=id=>document.getElementById(id);
const STORAGE='wolha-seogan-v2';
const defaults={penName:'',siteName:'월하서간',headline:'다시 만날 수 없는\n그대에게.',intro:'시월의 마지막 밤, 그리운 이름을 불러 봅니다.\n기록의 신 무명이, 끝내 닿지 못한 마음을 서고에 남깁니다.',theme:'day',fontSize:16,spacing:2.3};
const seasonNames={spring:'봄',summer:'여름',autumn:'가을',winter:'겨울'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const idPattern=/^[a-zA-Z0-9_-]{1,100}$/;
function settingsFrom(value={}){const s={...defaults};if(!value||typeof value!=='object')return s;for(const [key,max] of Object.entries({penName:40,siteName:20,headline:80,intro:240})){if(typeof value[key]==='string'&&(key==='penName'||value[key].trim()))s[key]=(key==='headline'&&value[key]==='그대에게,\n아직 닿지 못한 말.'?defaults.headline:key==='intro'&&value[key]==='계절이 몇 번을 지나도 바래지 않는 마음이 있습니다.\n오래된 서고 한켠, 접어 둔 그리움을 펼쳐 봅니다.'?defaults.intro:value[key]).slice(0,max)}if(['day','night','system'].includes(value.theme))s.theme=value.theme;if([14,16,18,20].includes(Number(value.fontSize)))s.fontSize=Number(value.fontSize);if([1.9,2.3,2.7].includes(Number(value.spacing)))s.spacing=Number(value.spacing);return s}
function recordFrom(value,draft=false){if(!value||typeof value!=='object'||typeof value.id!=='string'||typeof value.threadId!=='string'||!idPattern.test(value.id)||!idPattern.test(value.threadId))throw new Error('편지 번호가 올바르지 않습니다.');const limits={title:80,sender:40,recipient:40,body:6000};const record={id:value.id,threadId:value.threadId};for(const [key,max] of Object.entries(limits)){if(typeof value[key]!=='string'||value[key].length>max||(!draft&&!value[key].trim()))throw new Error('편지의 제목, 이름 또는 내용이 올바르지 않습니다.');record[key]=value[key]}if(!Object.hasOwn(seasonNames,value.season))throw new Error('편지의 계절을 확인해 주세요.');record.season=value.season;if(typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt)))throw new Error('편지의 날짜가 올바르지 않습니다.');record.createdAt=value.createdAt;record.updatedAt=typeof value.updatedAt==='string'&&Number.isFinite(Date.parse(value.updatedAt))?value.updatedAt:value.createdAt;if(value.parentId){if(typeof value.parentId!=='string'||!idPattern.test(value.parentId))throw new Error('앞선 편지의 번호가 올바르지 않습니다.');record.parentId=value.parentId;record.parentTitle=typeof value.parentTitle==='string'?value.parentTitle.slice(0,80):''}record.revision=Number.isSafeInteger(value.revision)&&value.revision>=0?value.revision:0;
 if(draft&&value.editingId){if(typeof value.editingId!=='string'||!idPattern.test(value.editingId))throw new Error('수정 중인 편지 번호가 올바르지 않습니다.');record.editingId=value.editingId;record.baseRevision=Number.isSafeInteger(value.baseRevision)&&value.baseRevision>=0?value.baseRevision:0}
 if(typeof value.entrustedAt==='string'&&Number.isFinite(Date.parse(value.entrustedAt)))record.entrustedAt=value.entrustedAt;
 return record}
function readStored(){let old={};try{old=JSON.parse(localStorage.getItem('wolha-seogan-v1')||'{}')||{}}catch{}let result={version:2,editKeys:{},settings:{...defaults,theme:old.night?'night':'day'},mail:[],drafts:[],saved:Array.isArray(old.saved)?old.saved:[],progress:old.progress&&typeof old.progress==='object'?old.progress:{}};try{const data=JSON.parse(localStorage.getItem(STORAGE)||'null');if(data&&data.version===2){result.settings=settingsFrom(data.settings);if(data.editKeys&&typeof data.editKeys==='object')for(const [id,key] of Object.entries(data.editKeys)){if(idPattern.test(id)&&typeof key==='string'&&/^[a-f0-9]{64}$/.test(key))result.editKeys[id]=key}for(const kind of ['mail','drafts']){if(Array.isArray(data[kind]))for(const value of data[kind]){try{const record=recordFrom(value,kind==='drafts');if(kind==='mail')record.direction=value.direction==='received'?'received':'written';if(!result[kind].some(l=>l.id===record.id))result[kind].push(record)}catch{}}}result.saved=Array.isArray(data.saved)?data.saved.filter(id=>typeof id==='string'&&idPattern.test(id)):[];result.progress=data.progress&&typeof data.progress==='object'?data.progress:{}}}catch{}return result}
let state=readStored();let filter='all',season='all',current=null,page=0,opener=null,composing=null,draftTimer,toastTimer,sharing=false,sealing=false,pendingDeletion=null;
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));return true}catch{return false}}
function commit(change){const previous=structuredClone(state);change();if(persist())return true;state=previous;toast('브라우저에 저장하지 못했습니다. 여유 공간과 저장 허용을 확인해 주세요.');return false}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3400)}
function syncScroll(){document.body.style.overflow=document.querySelector('dialog[open]')?'hidden':''}
function showDialog(dialog){if(!dialog.open)dialog.showModal();syncScroll()}
function shortDate(date){return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric'}).format(new Date(date))}
function pagesFor(body){const output=[];for(const manual of body.split(/\n[ \t]*---[ \t]*\n/)){let buffer='';for(const paragraph of manual.trim().split(/\n\s*\n/)){if(!paragraph.trim())continue;const chars=Array.from(paragraph);if(chars.length>650){if(buffer){output.push(buffer);buffer=''}for(let i=0;i<chars.length;i+=650)output.push(chars.slice(i,i+650).join(''));continue}if(buffer&&buffer.length+paragraph.length>650){output.push(buffer);buffer=''}buffer+=(buffer?'\n\n':'')+paragraph}if(buffer)output.push(buffer)}return output.length?output:['']}
function asLetter(record){return {...record,pages:pagesFor(record.body),to:record.recipient+'에게.',from:shortDate(record.createdAt)+'\n'+record.sender+' 씀',date:shortDate(record.createdAt),seasonName:seasonNames[record.season],excerpt:record.body.replace(/\n[ \t]*---[ \t]*\n/g,' ').replace(/\s+/g,' ').slice(0,65)}}
function letters(){return mailRecords().map(asLetter)}
function selectFilter(next){filter=next;document.querySelectorAll('.filter').forEach(b=>{b.classList.toggle('active',b.dataset.filter===next);b.setAttribute('aria-pressed',String(b.dataset.filter===next))});renderCards()}
function renderCards(){
 const personal=mailRecords().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(asLetter);
 let list=filter==='drafts'?[...state.drafts].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(l=>({...asLetter(l),draft:true})):filter==='received'?personal.filter(l=>l._public&&l.direction==='received'):filter==='written'?personal.filter(l=>l.direction==='written'):filter==='private'?personal.filter(l=>!l._public):filter==='saved'?personal:personal.filter(l=>l._public);
 if(filter==='saved')list=list.filter(l=>state.saved.includes(l.id));
 if(season!=='all')list=list.filter(l=>l.season===season);
 $('received-count').textContent=mailRecords().filter(l=>l._public&&l.direction==='received').length;
 $('written-count').textContent=mailRecords().filter(l=>l.direction==='written').length;
 $('draft-count').textContent=state.drafts.length;$('private-filter').classList.toggle('hidden',!state.mail.length);
 $('letters').replaceChildren();$('empty').replaceChildren();$('empty').classList.toggle('hidden',list.length>0);
 if(!list.length){
  const message=document.createElement('span');
  message.textContent=season!=='all'?'이 계절에는 아직 편지가 놓이지 않았습니다.':filter==='received'?'아직 도착한 서간이 없습니다. 누군가 전한 편지 링크를 열어 이곳에 간직할 수 있습니다.':filter==='saved'?'아직 책갈피를 끼운 편지가 없습니다. 간직하고 싶은 편지에 책갈피를 남겨 보세요.':filter==='drafts'?'쓰다가 접어 둔 편지가 없습니다. 마음이 가는 이에게 첫 문장을 적어 보세요.':'아직 이 서고에 놓인 편지가 없습니다. 그리운 이름에 첫 마음을 남겨 주세요.';
  $('empty').append(message,document.createElement('br'));
  const action=document.createElement('button');action.textContent='편지 한 통 쓰기 ↗';action.addEventListener('click',()=>openCompose());$('empty').append(action);
 }
 for(const letter of list){
  const item=document.createElement('article');item.className='letter-item';
  const card=document.createElement('button');card.className='letter-card'+(letter.draft?' draft-card':'');
  card.setAttribute('aria-label',(letter.title||'제목 없는 편지')+(letter.draft?' 이어 쓰기':' 편지 펼치기'));
  const caption=letter.draft?(letter.editingId?'수정 중인 편지':'쓰던 편지'):!letter._public?'기존 개인 편지':letter.direction==='received'?'공개 서간':letter.entrustedAt?'무명에게 맡긴 편지':'쓴 편지';
  card.innerHTML=`<div class="letter-art" aria-hidden="true"><svg class="art-sprig" viewBox="0 0 100 120"><use href="#sprig"/></svg><div class="envelope"><span class="env-title">${esc((letter.title||'제목 없는 편지').slice(0,14))}</span><span class="env-seal">${letter.draft?'草':letter.entrustedAt?'記':'緘'}</span></div></div><div class="card-top"><span>${caption} · ${esc(letter.seasonName)}</span><span>${state.saved.includes(letter.id)?'책갈피 ◆':esc(shortDate(letter.updatedAt))}</span></div><h3 class="card-title">${esc(letter.title||'제목 없는 편지')}</h3><p class="card-excerpt">${esc(letter.excerpt||'아직 적지 못한 마음이 기다립니다.')}</p><div class="card-bottom"><span>${esc(letter.sender||'이름 없는 이')} → ${esc(letter.recipient||'그대')}</span><span>${letter.draft?'이어서 쓰기':Number.isInteger(state.progress[letter.id])?'이어서 읽기':'편지 읽기'} ↗</span></div>`;
  card.addEventListener('click',()=>letter.draft?openCompose({draft:state.drafts.find(d=>d.id===letter.id)}):openLetter(letter,card));item.append(card);
  if(letter.draft||letter.direction==='written'){
   const actions=document.createElement('div');actions.className='letter-item-actions';
   const edit=document.createElement('button');edit.textContent='수정';edit.setAttribute('aria-label',(letter.title||'제목 없는 편지')+' 수정');
   edit.addEventListener('click',()=>letter.draft?openCompose({draft:state.drafts.find(d=>d.id===letter.id)}):openCompose({edit:findMail(letter.id)}));
   const remove=document.createElement('button');remove.textContent='삭제';remove.className='delete-action';remove.setAttribute('aria-label',(letter.title||'제목 없는 편지')+' 삭제');remove.addEventListener('click',()=>askDelete(letter.draft?'draft':'mail',letter.id));
   actions.append(edit,remove);item.append(actions);
  }
  $('letters').append(item);
 }
 $('first-letter').innerHTML=personal.length?'남긴 마음 펼치기 <span class="arrow" aria-hidden="true">↗</span>':'그리운 이에게 쓰기 <span class="arrow" aria-hidden="true">↗</span>';
}
function isKept(letter=current){return !letter._update&&!letter._snapshot&&(letter._public||state.mail.some(l=>l.id===letter.id))}
function renderPage(){if(!current)return;const isExternal=!isKept();$('letter-number').textContent=(current._snapshot?'이전 링크의 편지':isExternal?'도착한 편지':current.direction==='received'?'받은 편지':'쓴 편지')+' · '+current.seasonName;$('letter-title').textContent=current.title;$('letter-date').textContent=current.date;$('letter-correspondents').textContent=current.sender+' → '+current.recipient;$('salutation').textContent=page===0?current.to:current.recipient+'에게, 계속하여.';const ownGreeting=page===0&&current.pages[0].trimStart().split(String.fromCharCode(10))[0].includes(current.recipient+'에게');$('salutation').classList.toggle('hidden',ownGreeting);$('letter-content').textContent=current.pages[page];$('signature').textContent=page===current.pages.length-1?current.from:'';$('previous').disabled=page===0;$('next').textContent=page===current.pages.length-1?'편지 접기 ↗':'다음 장으로 →';$('page-count').textContent=`${String(page+1).padStart(2,'0')} / ${String(current.pages.length).padStart(2,'0')}`;$('page-dots').innerHTML=current.pages.map((_,i)=>`<span class="page-dot ${i===page?'current':''}"></span>`).join('');const marked=state.saved.includes(current.id);$('bookmark').setAttribute('aria-pressed',String(marked));$('bookmark').textContent=marked?'책갈피 빼기 ◆':'책갈피 끼우기 +';$('keep-letter').classList.toggle('hidden',!isExternal||!!current._snapshot);$('keep-letter').textContent=current._update?'수정본으로 보관':'내 서고에 보관';$('bookmark').classList.toggle('hidden',!!current._snapshot);$('reader-manage').classList.toggle('hidden',isExternal||current.direction!=='written');$('thread-list').replaceChildren();const related=letters().filter(l=>l.id!==current.id&&l.threadId===current.threadId).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));for(const other of related){const button=document.createElement('button');button.textContent=`${other.sender} → ${other.recipient} · ${other.title} ↗`;button.addEventListener('click',()=>{current=other;page=0;renderPage()});$('thread-list').append(button)}$('thread-section').classList.toggle('hidden',!related.length);state.progress[current.id]=page;if(isKept())persist();renderKeeper();document.querySelector('.reading-body').scrollTop=0}
function openLetter(letter,source){opener=source||document.activeElement;current=letter;const last=state.progress[letter.id];page=Number.isInteger(last)?Math.max(0,Math.min(last,letter.pages.length-1)):0;renderPage();showDialog($('reader-dialog'));$('letter-title').focus()}
function keepIncoming(){
 if(!current||isKept()||current._snapshot)return true;
 const record=recordFrom(current);record.direction='received';
 if(!commit(()=>{const index=state.mail.findIndex(l=>l.id===record.id);if(index<0)state.mail.push(record);else state.mail[index]=record;state.progress[record.id]=page}))return false;
 current=asLetter(record);$('arrival-banner').classList.add('hidden');clearIncomingHash();renderPage();renderCards();return true;
}
function clearIncomingHash(){if(location.hash.startsWith('#letter='))history.replaceState(null,'',location.pathname+location.search+'#archive')}
function closeReader(){$('reader-dialog').close()}
function renderSettings(){const s=state.settings;$('setting-name').value=s.penName;$('setting-site').value=s.siteName;$('setting-headline').value=s.headline;$('setting-intro').value=s.intro;$('setting-theme').value=s.theme;$('setting-font').value=s.fontSize;$('setting-spacing').value=s.spacing}
function applySettings(){const s=state.settings;document.querySelector('.brand-name').textContent=s.siteName;document.querySelector('.brand').setAttribute('aria-label',s.siteName+' 처음으로');document.title=s.siteName+' — 무명의 서고';document.querySelector('.intro').textContent=s.intro;if(s.headline===defaults.headline){$('hero-title').innerHTML='다시 만날 수 없는<br><span>그대에게.</span>'}else{$('hero-title').replaceChildren();const lines=s.headline.split('\n');lines.forEach((line,i)=>{if(i)$('hero-title').append(document.createElement('br'));const node=document.createElement(i===lines.length-1?'span':'span');node.textContent=line;if(i!==lines.length-1)node.style.color='inherit';$('hero-title').append(node)})}document.documentElement.style.setProperty('--reader-font-size',s.fontSize+'px');document.documentElement.style.setProperty('--reader-line-height',s.spacing);const dark=s.theme==='night'||s.theme==='system'&&systemTheme.matches;document.body.classList.toggle('night',dark);$('lamp').setAttribute('aria-pressed',String(dark));$('lamp').setAttribute('aria-label',dark?'낮의 서고로 바꾸기':'밤의 서고로 바꾸기');$('lamp').querySelector('span').textContent=dark?'낮의 서고':'밤의 서고';renderCards()}
function currentSeason(){return ['winter','winter','spring','spring','spring','summer','summer','summer','autumn','autumn','autumn','winter'][new Date().getMonth()]}
function openCompose(options={}){
 if($('reader-dialog').open)closeReader();
 const parent=options.parent,edit=options.edit;
 const existing=edit?state.drafts.find(d=>d.editingId===edit.id):null;
 const now=new Date().toISOString(),id=crypto.randomUUID();
 composing=options.draft?{...options.draft}:existing?{...existing}:edit?{...recordFrom(edit),id,editingId:edit.id,baseRevision:edit.revision||0}: {id,threadId:parent?.threadId||id,parentId:parent?.id,parentTitle:parent?.title,title:parent?(parent.title+'에 부치는 답장').slice(0,80):'',sender:state.settings.penName||parent?.recipient||'',recipient:parent?.sender||'',body:'',season:parent?.season||currentSeason(),createdAt:now,updatedAt:now,revision:0};
 $('compose-title').textContent=composing.editingId?'쓴 편지를 다듬습니다.':options.draft?'쓰던 마음을 이어 씁니다.':parent||composing.parentId?'답장을 한 통 씁니다.':'그리운 이에게 씁니다.';
 for(const field of ['sender','recipient','season','body'])$('compose-'+field).value=composing[field]||'';
 $('compose-subject').value=composing.title;
 $('reply-context').classList.toggle('hidden',!composing.parentId);
 $('reply-context').textContent=composing.parentId?'「'+composing.parentTitle+'」에 이어 쓰는 편지입니다. 앞선 편지 내용은 새 링크에 포함되지 않습니다.':'';
 $('edit-context').classList.toggle('hidden',!composing.editingId);
 $('edit-context').textContent='공개 편지를 수정하면 다른 방문자에게도 수정된 내용이 보입니다. 기존 개인 편지는 공개하기를 누른 경우에만 공용 서고로 옮겨집니다.'+(composing.entrustedAt?' 수정한 마음에는 무명의 인장을 다시 남길 수 있습니다.':'');
 $('save-letter').textContent=composing.editingId?'수정하고 공개하기':'공개 서고에 남기기';
 $('seal-and-share').textContent=composing.editingId?'수정하고 링크 보기 ↗':'공개하고 링크 보기 ↗';
 $('draft-status').textContent='접어 둔 마음은 이 브라우저에 임시 보관됩니다.';
 updateCount();showDialog($('compose-dialog'));
 (!composing.sender?$('compose-sender'):!composing.recipient?$('compose-recipient'):$('compose-body')).focus();
}
function composeRecord(){return {...composing,title:$('compose-subject').value.trim(),sender:$('compose-sender').value.trim(),recipient:$('compose-recipient').value.trim(),body:$('compose-body').value,season:$('compose-season').value,updatedAt:new Date().toISOString()}}
function updateCount(){$('char-count').textContent=$('compose-body').value.length.toLocaleString('ko-KR')+' / 6,000'}
function saveDraft(announce=false){clearTimeout(draftTimer);if(!composing)return true;const record=composeRecord();if(!record.title&&!record.body.trim()&&!record.sender&&!record.recipient)return true;const ok=commit(()=>{const index=state.drafts.findIndex(l=>l.id===record.id);if(index<0)state.drafts.push(record);else state.drafts[index]=record});$('draft-status').textContent=ok?'쓰던 편지를 이 브라우저에 보관했습니다.':'저장하지 못했습니다. 이 창을 닫기 전에 내용을 복사해 주세요.';if(ok){renderCards();if(announce)toast('쓰던 편지를 서고에 보관했습니다.')}return ok}
async function finishCompose(share,entrust=false){
 if(sealing||!composing||!$('compose-form').reportValidity())return;
 const draft=composeRecord();if(!draft.body.trim()){toast('빈 종이에 마음을 조금 적어 주세요.');$('compose-body').focus();return}
 const original=draft.editingId?findMail(draft.editingId):null;
 if(draft.editingId&&(!original||original.direction!=='written')){toast('수정할 원본 편지를 찾지 못했습니다. 원고는 그대로 보관됩니다.');return}
 if(original&&(original.revision||0)!==(draft.baseRevision||0)){toast('원본이 변경되었습니다. 원고를 보관하고 최신 편지를 다시 펼쳐 주세요.');return}
 if(!saveDraft())return;
 const record=recordFrom({...draft,id:original?.id||draft.id,createdAt:original?.createdAt||draft.createdAt,revision:original?.revision||0});
 delete record.entrustedAt;if(entrust)record.entrustedAt=new Date().toISOString();
 sealing=true;setPublishing(true);
 try{
  clearTimeout(draftTimer);const published=await savePublicLetter(record,!!original?._public);
  commit(()=>{state.drafts=state.drafts.filter(d=>d.id!==draft.id);state.mail=state.mail.filter(l=>l.id!==published.id);state.progress[published.id]=0;if(!state.settings.penName)state.settings.penName=published.sender});
  composing=null;$('compose-dialog').close();selectFilter('written');openLetter(asLetter(published));toast(original?'공개 편지를 수정했습니다.':'모두가 읽을 수 있는 서고에 편지를 남겼습니다.');
  if(entrust)openMumyeong(current);else if(share)await openShare(current);
 }catch(error){$('draft-status').textContent='공개하지 못했습니다. 원고는 쓰던 편지에 남아 있습니다.';toast(error.message)}finally{sealing=false;setPublishing(false)}
}
function wireRecord(letter){return {v:1,...recordFrom(letter)}}
function toBase64(bytes){let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function fromBase64(text){if(!/^[a-zA-Z0-9_-]+$/.test(text))throw new Error('편지 링크가 올바르지 않습니다.');const raw=atob(text.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function encodeLetter(letter){const raw=new TextEncoder().encode(JSON.stringify(wireRecord(letter)));let bytes=raw,format='u';if(typeof CompressionStream!=='undefined'){try{const compressed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());if(compressed.length<raw.length){bytes=compressed;format='z'}}catch{}}return '1'+format+'.'+toBase64(bytes)}
async function decodeLetter(code){if(code.length>36000||!/^1[zu]\./.test(code))throw new Error('지원하지 않거나 너무 긴 편지 링크입니다.');let bytes=fromBase64(code.slice(3));if(code.startsWith('1z.')){if(typeof DecompressionStream==='undefined')throw new Error('이 편지는 최신 브라우저에서 열어 주세요.');const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();const chunks=[];let size=0;try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>60000)throw new Error('편지 크기가 너무 큽니다.');chunks.push(part.value)}}finally{await reader.cancel().catch(()=>{})}bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}}if(bytes.length>60000)throw new Error('편지 크기가 너무 큽니다.');const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(data.v!==1)throw new Error('지원하지 않는 편지 형식입니다.');return recordFrom(data)}
async function openShare(letter){if(sharing)return;sharing=true;try{const code=letter._public?'public:'+letter.id:await encodeLetter(letter);const base=new URL(location.href);base.hash='letter='+code;base.search='';const url=base.href;if(url.length>36000)throw new Error('편지가 너무 길어 링크를 만들지 못했습니다. 여러 통으로 나누어 주세요.');$('share-summary').textContent=letter.sender+' → '+letter.recipient+' · 「'+letter.title+'」';$('share-url').value=url;$('copy-link').textContent='편지 링크 복사 ↗';showDialog($('share-dialog'))}catch(error){toast(error.message||'편지 링크를 만들지 못했습니다.')}finally{sharing=false}}
async function loadIncoming(){
 if(!location.hash.startsWith('#letter='))return;
 try{
  if(location.hash.startsWith('#letter=public:')){if(composing&&(sealing||!saveDraft()))return;composing=null;const id=location.hash.slice(15);if(!idPattern.test(id))throw new Error('편지 번호를 확인해 주세요.');const data=await archiveRequest('/'+id);const record=rememberPublic(data.letter);for(const modal of ['compose-dialog','share-dialog','settings-dialog','mumyeong-dialog'])if($(modal).open)$(modal).close();openLetter(asLetter(record));renderCards();return}
  const record=await decodeLetter(location.hash.slice(8));
  if(composing&&!saveDraft())return;
  composing=null;
  for(const id of ['compose-dialog','share-dialog','settings-dialog','delete-dialog','mumyeong-dialog']){if($(id).open)$(id).close()}
  const known=state.mail.find(l=>l.id===record.id);
  if(known){
   const sameContent=['title','sender','recipient','body','threadId','parentId','parentTitle','season','createdAt'].every(k=>(known[k]||'')===(record[k]||''));
   const same=sameContent&&(known.entrustedAt||'')===(record.entrustedAt||'');
   if(same){openLetter(asLetter(known));return}
   if(known.threadId!==record.threadId)throw new Error('서고의 편지와 연결 정보가 다릅니다. 보낸 이에게 링크를 다시 요청해 주세요.');
   if(known.direction==='received'&&(record.revision>(known.revision||0)||sameContent&&record.revision===(known.revision||0)&&!known.entrustedAt&&!!record.entrustedAt)){
    record.direction='received';const incoming=asLetter(record);incoming._update=true;
    $('arrival-banner').textContent='수정된 편지가 도착했습니다. 내용을 읽고 「수정본으로 보관」을 누르면 서고의 편지가 바뀝니다.';
    $('arrival-banner').classList.remove('hidden');openLetter(incoming);return;
   }
   if(known.direction==='written'||record.revision<(known.revision||0)||sameContent&&record.revision===(known.revision||0)&&!!known.entrustedAt&&!record.entrustedAt){
    record.direction=known.direction;const snapshot=asLetter(record);snapshot._snapshot=true;
    $('arrival-banner').textContent='이 링크에 담긴 내용을 펼쳤습니다. 내 서고에 보관한 최신 편지는 그대로 유지됩니다.';
    $('arrival-banner').classList.remove('hidden');openLetter(snapshot);return;
   }
   throw new Error('같은 번호의 편지와 내용이 다릅니다. 보낸 이에게 최신 링크를 요청해 주세요.');
  }
  record.direction='received';$('arrival-banner').textContent=record.sender+'에게서 편지 한 통이 도착했습니다. 읽고 나서 내 서고에 간직하거나 답장을 써 보세요.';
  $('arrival-banner').classList.remove('hidden');openLetter(asLetter(record));
 }catch(error){
  for(const id of ['reader-dialog','share-dialog']){if($(id).open)$(id).close()}
  const message=/[가-힣]/.test(error.message||'')?error.message:'링크 전체가 복사되었는지 확인해 주세요.';
  $('arrival-banner').textContent='편지를 펼치지 못했습니다. '+message;$('arrival-banner').classList.remove('hidden');
  if($('compose-dialog').open||$('settings-dialog').open)toast(message);else $('arrival-banner').scrollIntoView({block:'start'});
 }
}
function backupData(){return {version:2,exportedAt:new Date().toISOString(),...state,publicLetters:publicRecords.filter(letter=>editKeyFor(letter.id)).map(letter=>recordFrom(letter))}}
function exportArchive(){const blob=new Blob([JSON.stringify(backupData(),null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='월하서간-백업-'+new Date().toISOString().slice(0,10)+'.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),20000);$('backup-status').textContent='서고 백업 파일을 내려받았습니다.'}
async function importArchive(file){if(!file)return;try{if(file.size>4*1024*1024)throw new Error('4MB 이하의 서고 백업 파일을 선택해 주세요.');const data=JSON.parse(await file.text());if(data.version!==2||!Array.isArray(data.mail)||!Array.isArray(data.drafts)||data.mail.length+data.drafts.length>1000)throw new Error('월하서간 백업 파일이 아닙니다.');const mail=[...data.mail,...(Array.isArray(data.publicLetters)?data.publicLetters.map(value=>({...value,direction:'written'})):[])].map(v=>({...recordFrom(v),direction:v.direction==='received'?'received':'written'}));const drafts=data.drafts.map(v=>recordFrom(v,true));const settings=settingsFrom(data.settings);const ok=commit(()=>{for(const record of mail){if(!state.mail.some(l=>l.id===record.id))state.mail.push(record)}for(const record of drafts){if(!state.mail.some(l=>l.id===record.id)&&!state.drafts.some(l=>l.id===record.id))state.drafts.push(record)}if(data.editKeys&&typeof data.editKeys==='object')for(const [id,key] of Object.entries(data.editKeys)){if(idPattern.test(id)&&typeof key==='string'&&/^[a-f0-9]{64}$/.test(key))state.editKeys[id]=key}state.settings=settings;state.saved=[...new Set([...state.saved,...(Array.isArray(data.saved)?data.saved.filter(id=>typeof id==='string'&&idPattern.test(id)):[])])];if(data.progress&&typeof data.progress==='object'){for(const [key,value] of Object.entries(data.progress)){if(idPattern.test(key)&&Number.isInteger(value)&&value>=0&&value<1000&&!Number.isInteger(state.progress[key]))state.progress[key]=value}}});if(!ok)throw new Error('이 브라우저에 백업을 저장하지 못했습니다.');applySettings();renderSettings();$('backup-status').textContent='서고를 가져왔습니다. 기존 편지는 그대로 두고 새 편지와 원고를 더했습니다. 설정도 백업에 맞추었습니다.'}catch(error){$('backup-status').textContent=error.message||'백업 파일을 읽지 못했습니다.'}finally{$('import-archive').value=''}}

function askDelete(kind,id){
 const record=kind==='mail'?findMail(id):state.drafts.find(l=>l.id===id)||(composing?.id===id?composeRecord():null);
 if(!record||kind==='mail'&&record.direction!=='written')return;
 pendingDeletion={kind,id};
 $('delete-title').textContent=kind==='mail'?'이 편지를 삭제할까요?':'쓰던 편지를 삭제할까요?';
 $('delete-subject').textContent='「'+(record.title||'제목 없는 편지')+'」';
 $('delete-description').textContent=kind==='mail'?(record._public?'공용 서고에서 이 공개 편지와 수정 중인 원고를 삭제합니다. 다른 방문자도 더 이상 이 편지를 열 수 없습니다. 이미 따로 복사하거나 백업한 내용까지 지워지지는 않습니다.':'기존 개인 편지와 수정 원고를 이 브라우저에서 삭제합니다. 공개 서고의 다른 편지에는 영향을 주지 않습니다.'):record.editingId?'수정 중인 원고만 삭제합니다. 완성해 보관한 원본 편지는 그대로 남습니다. 이 원고는 되돌릴 수 없습니다.':'이 브라우저에서 쓰던 편지를 삭제합니다. 삭제한 원고는 되돌릴 수 없습니다.';
 showDialog($('delete-dialog'));$('cancel-delete').focus();
}
async function deleteConfirmed(){
 if(!pendingDeletion||deletingLetter)return;const {kind,id}=pendingDeletion,record=kind==='mail'?findMail(id):null;
 deletingLetter=true;$('confirm-delete').disabled=true;$('cancel-delete').disabled=true;
 try{
  if(record?._public)await deletePublicLetter(id);
  if(!commit(()=>{if(kind==='mail'){state.mail=state.mail.filter(l=>l.id!==id);state.drafts=state.drafts.filter(l=>l.editingId!==id);state.saved=state.saved.filter(value=>value!==id);delete state.progress[id];delete state.editKeys[id]}else state.drafts=state.drafts.filter(l=>l.id!==id)}))return;
  if(composing&&(composing.id===id||kind==='mail'&&composing.editingId===id)){clearTimeout(draftTimer);composing=null;$('compose-dialog').close()}
  if(kind==='mail'&&current?.id===id){if($('reader-dialog').open)closeReader();current=null;clearIncomingHash();$('arrival-banner').classList.add('hidden')}
  $('delete-dialog').close();pendingDeletion=null;renderCards();toast(kind==='mail'?'편지를 서고에서 삭제했습니다.':'쓰던 편지를 삭제했습니다.');
 }catch(error){toast(error.message)}finally{deletingLetter=false;$('confirm-delete').disabled=false;$('cancel-delete').disabled=false}
}
$('edit-letter').addEventListener('click',()=>{const record=mailRecords().find(l=>l.id===current?.id&&l.direction==='written');if(record)openCompose({edit:record})});
$('delete-letter').addEventListener('click',()=>askDelete('mail',current.id));
$('delete-compose').addEventListener('click',()=>{if(composing)askDelete('draft',composing.id)});
$('cancel-delete').addEventListener('click',()=>$('delete-dialog').close());
$('confirm-delete').addEventListener('click',deleteConfirmed);
$('delete-dialog').addEventListener('cancel',event=>{if(deletingLetter)event.preventDefault()});
$('delete-dialog').addEventListener('close',()=>{pendingDeletion=null;syncScroll()});


function renderKeeper(){
 const own=isKept()&&current.direction==='written';
 const marked=!!current.entrustedAt;
 $('keeper-record').classList.toggle('hidden',!own&&!marked);
 $('keeper-record').classList.toggle('is-recorded',marked);
 $('keeper-mark').classList.toggle('hidden',!marked);
 $('keeper-record-text').textContent=marked?'무명이 기록한 마음 · '+shortDate(current.entrustedAt):'이 마음을 잊히지 않는 기록으로 남길까요?';
 $('entrust-letter').classList.toggle('hidden',!own);
 $('entrust-letter').textContent=marked?'무명의 인장 펼치기 ↗':current._public?'무명에게 맡기기 ↗':'공개 서고에 맡기기 ↗';
}
function openMumyeong(letter){
 $('mumyeong-subject').textContent=letter.sender+' → '+letter.recipient+' · 「'+letter.title+'」';
 $('mumyeong-date').textContent=shortDate(letter.entrustedAt)+' · '+letter.recipient+'에게';
 showDialog($('mumyeong-dialog'));
}
async function entrustCurrent(){
 const record=findMail(current?.id);if(!record||record.direction!=='written'||current._snapshot||current._update)return;
 if(record.entrustedAt){openMumyeong(record);return}
 $('entrust-letter').disabled=true;
 try{const published=await savePublicLetter({...record,entrustedAt:new Date().toISOString()},!!record._public);commit(()=>state.mail=state.mail.filter(letter=>letter.id!==record.id));current=asLetter(published);renderPage();renderCards();openMumyeong(current)}catch(error){toast(error.message)}finally{$('entrust-letter').disabled=false}
}
$('entrust-compose').addEventListener('click',()=>finishCompose(false,true));
$('entrust-letter').addEventListener('click',entrustCurrent);
$('close-mumyeong').addEventListener('click',()=>$('mumyeong-dialog').close());
$('mumyeong-dialog').addEventListener('close',syncScroll);

$('new-letter').addEventListener('click',()=>openCompose());$('write-from-archive').addEventListener('click',()=>openCompose());
$('first-letter').addEventListener('click',()=>{const personal=mailRecords().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));const letter=personal[0]?asLetter(personal[0]):null;if(letter)openLetter(letter,$('first-letter'));else openCompose()});
$('close-reader').addEventListener('click',closeReader);
$('reader-dialog').addEventListener('close',()=>{syncScroll();renderCards();if(!document.querySelector('dialog[open]')){if(opener?.isConnected)opener.focus();else document.querySelector('.filter.active')?.focus()}});
$('reader-dialog').addEventListener('click',e=>{if(e.target===$('reader-dialog')){const box=$('reader-dialog').getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)closeReader()}});
$('previous').addEventListener('click',()=>{if(page>0){page--;renderPage()}});$('next').addEventListener('click',()=>{if(page<current.pages.length-1){page++;renderPage()}else closeReader()});
$('keep-letter').addEventListener('click',()=>{if(keepIncoming())toast('도착한 편지를 내 서고에 간직했습니다.')});
$('bookmark').addEventListener('click',()=>{if(!keepIncoming())return;const marked=state.saved.includes(current.id);if(!commit(()=>{state.saved=marked?state.saved.filter(id=>id!==current.id):[...state.saved,current.id]}))return;renderPage();toast(marked?'편지에서 책갈피를 꺼냈습니다.':'이 마음에 책갈피를 끼웠습니다.')});
$('reply-letter').addEventListener('click',()=>{if(!keepIncoming())return;openCompose({parent:current})});$('share-letter').addEventListener('click',()=>openShare(current));
document.addEventListener('keydown',e=>{if(!$('reader-dialog').open||document.querySelector('#share-dialog[open]')||$('mumyeong-dialog').open||$('delete-dialog').open||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowRight'&&page<current.pages.length-1){e.preventDefault();page++;renderPage()}if(e.key==='ArrowLeft'&&page>0){e.preventDefault();page--;renderPage()}});
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>selectFilter(button.dataset.filter)));$('season-filter').addEventListener('change',()=>{season=$('season-filter').value;renderCards()});
$('close-compose').addEventListener('click',()=>{if(!sealing&&saveDraft())$('compose-dialog').close()});$('compose-dialog').addEventListener('cancel',event=>{if(sealing||!saveDraft())event.preventDefault()});$('compose-dialog').addEventListener('close',()=>{clearTimeout(draftTimer);composing=null;syncScroll();renderCards()});
$('compose-form').addEventListener('input',()=>{updateCount();$('draft-status').textContent='쓰던 마음을 보관하는 중…';clearTimeout(draftTimer);draftTimer=setTimeout(()=>saveDraft(),600)});
$('save-draft').addEventListener('click',()=>{if(saveDraft(true)){$('compose-dialog').close();selectFilter('drafts')}});
$('compose-form').addEventListener('submit',event=>{event.preventDefault();finishCompose(false)});$('seal-and-share').addEventListener('click',()=>finishCompose(true));
$('insert-page').addEventListener('click',()=>{const textarea=$('compose-body');const separator='\n\n---\n\n';if(textarea.value.length+separator.length>6000){toast('한 통에는 6,000자까지 담을 수 있습니다.');return}textarea.setRangeText(separator,textarea.selectionStart,textarea.selectionEnd,'end');textarea.dispatchEvent(new Event('input',{bubbles:true}));textarea.focus()});
$('close-share').addEventListener('click',()=>$('share-dialog').close());$('share-dialog').addEventListener('close',syncScroll);
$('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('share-url').value);$('copy-link').textContent='편지 링크를 복사했습니다 ✓';toast('상대에게 이 링크를 전해 주세요.')}catch{$('share-url').focus();$('share-url').select();toast('선택된 링크를 길게 누르거나 Ctrl+C로 복사해 주세요.')}});
$('open-settings').addEventListener('click',()=>{renderSettings();$('backup-status').textContent='';showDialog($('settings-dialog'))});$('close-settings').addEventListener('click',()=>$('settings-dialog').close());$('settings-dialog').addEventListener('close',syncScroll);
$('settings-form').addEventListener('submit',event=>{event.preventDefault();const settings=settingsFrom({penName:$('setting-name').value.trim(),siteName:$('setting-site').value.trim(),headline:$('setting-headline').value.trim(),intro:$('setting-intro').value.trim(),theme:$('setting-theme').value,fontSize:$('setting-font').value,spacing:$('setting-spacing').value});if(!commit(()=>state.settings=settings))return;applySettings();$('settings-dialog').close();toast('당신의 서고를 새롭게 가꾸었습니다.')});
$('lamp').addEventListener('click',()=>{const dark=document.body.classList.contains('night');if(commit(()=>state.settings.theme=dark?'day':'night'))applySettings()});systemTheme.addEventListener('change',()=>{if(state.settings.theme==='system')applySettings()});
$('export-archive').addEventListener('click',exportArchive);$('import-archive').addEventListener('change',()=>importArchive($('import-archive').files[0]));
window.addEventListener('pagehide',()=>{if(composing)saveDraft()});window.addEventListener('hashchange',loadIncoming);
$('replay-intro').addEventListener('click',()=>startIntro(true));applySettings();startPublicArchive();loadIncoming();startIntro();

