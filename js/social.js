import * as api from './social-api.js';
import { rankPosts, deduplicatePosts, readFeedPreferences } from './feed-ranking.mjs';
import { mountStaffPanel } from './staff-panel.js';
import { matchesMuted } from './content-preferences.mjs';
import { mountDrawing } from './drawing.js';
const root = document.querySelector('#socialRoot');
const page = document.body.dataset.page;
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = value => {
  try { const url = new URL(value, location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
};
const profileUrl = id => '/users/' + encodeURIComponent(id);
const postUrl = id => '/post/' + encodeURIComponent(id);
const loginUrl = () => '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
const userName = p => p?.displayName || p?.username || 'Deleted account';
const timeLabel = value => {
  const t = api.timestamp(value);
  return t ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now';
};
const time = value => `<time datetime="${api.timestamp(value) ? new Date(api.timestamp(value)).toISOString() : ''}">${escape(timeLabel(value))}</time>`;
const avatar = p => `<img class="social-avatar" src="${escape(safeUrl(p?.avatarUrl || '/users/default/pfp.jpg'))}" alt="" loading="lazy">`;
const empty = (title, description = '', action = '') => `<div class="social-empty"><h2>${escape(title)}</h2><p>${escape(description)}</p>${action}</div>`;
const options = value => api.BOARDS.map(b => `<option${b === value ? ' selected' : ''}>${b}</option>`).join('');
let friends = [], blocks = [], people = [], feedRender = () => {}, disposers = [], cardDisposers = [];
const posts = new Map();
const publicPages = new Set(['home', 'community', 'board', 'post', 'search', 'gift', 'profile', 'polls', 'archive']);
let bootRevision = 0, anchorReached=false;
function revealAnchor(){if(anchorReached||!location.hash)return;let target;try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch(_){}if(target){anchorReached=true;target.scrollIntoView({block:'center'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}}
const notice = document.createElement('div');
notice.className = 'social-toast'; notice.setAttribute('role', 'status'); notice.hidden = true;
document.body.append(notice);
function toast(message) { notice.textContent = message; notice.hidden = false; clearTimeout(notice.timer); notice.timer = setTimeout(() => { notice.hidden = true; }, 6000); }
function failure(error) { toast(api.friendlyError(error)); }
function requireUser() {
  if (api.state.profile && api.state.user?.uid === api.auth.currentUser?.uid) return true;
  if (!api.state.ready || api.state.user) { toast('Your account is still connecting. You can retry from Settings.'); return false; }
  location.assign(loginUrl()); return false;
}
function heading(title, description = '') { return `<header class="social-heading"><p class="social-eyebrow">COOLBRADOR / ${escape(title)}</p><h1>${escape(title)}</h1><p>${escape(description)}</p></header>`; }
function gate() { root.innerHTML = heading('Your pack is waiting') + empty('Sign in to continue', 'Connect with friends, share posts, and join the conversation.', `<a class="social-primary" href="${loginUrl()}">Sign in or create an account</a>`); }
function bindForm(form, handler) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (form.dataset.busy || !requireUser()) return;
    const values = new FormData(form);
    const controls = [...form.elements].map(el => [el, el.disabled]);
    form.dataset.busy = '1'; form.setAttribute('aria-busy', 'true');
    const button = form.querySelector('[type=submit]');
    const label = button.textContent; button.disabled = true; button.textContent = 'Saving…';
    const status = form.querySelector('[role=status]');
    controls.forEach(([el]) => { el.disabled = true; });
    try { if (status) status.textContent = ''; await handler(values); }
    catch (error) { if (status) status.textContent = api.friendlyError(error); else failure(error); }
    finally { delete form.dataset.busy; form.removeAttribute('aria-busy'); controls.forEach(([el, disabled]) => { el.disabled = disabled; }); button.textContent = label; }
  });
}
function composer(board = '', reply = null) {
  const container = document.createElement('section'); container.className = 'social-compose';
  if (!api.state.profile) {
    container.innerHTML = (!api.state.ready || api.state.user)
      ? '<p>Your account is loading. You can keep reading while it connects.</p>'
      : `<p><a href="${loginUrl()}">Sign in</a> to ${reply ? 'reply' : 'share a post with the pack'}.</p>`;
    if (api.state.error) {
      container.innerHTML = '<p>Your account is signed in, but your profile could not load.</p>';
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry account';
      retry.onclick = async () => { retry.disabled = true; try { await api.restoreSession(); } catch (error) { failure(error); } finally { retry.disabled = false; } };
      container.append(retry);
    }
    return container;
  }
  const draftKey = `cb_draft_${api.state.user.uid}_${reply?.id || board || 'feed'}`;
  container.innerHTML = `<form><label class="social-compose-label">${reply ? 'Add a reply' : 'What’s happening in your world?'}<textarea name="body" maxlength="2000" rows="3" placeholder="${reply ? 'Keep the conversation going…' : 'A thought, a drawing, a moment from Chipper…'}" ${reply ? 'required' : ''}></textarea></label>
    <div class="social-attachment" hidden></div><div class="social-compose-tools">
    ${reply ? '' : `<label class="social-file">＋ Add media<input name="media" type="file" accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"></label>`}
    ${board || reply ? `<span class="social-muted">${reply ? 'Replies are public' : 'Posting to ' + escape(board)}</span>` : `<label class="social-board-picker">Community<select name="board">${options('General')}</select></label>`}
    ${reply ? '' : '<label class="social-sensitive-toggle"><input type="checkbox" name="sensitive"> Sensitive content</label>'}<span class="social-counter" aria-live="off">0 / 2000</span><button type="submit" class="social-primary">${reply ? 'Reply' : 'Post'}</button></div><p role="status"></p></form>`;
  const form = container.querySelector('form'), textarea = form.elements.body;
  try { textarea.value = localStorage.getItem(draftKey) || ''; } catch (_) {}
  function remember() { container.querySelector('.social-counter').textContent = textarea.value.length + ' / 2000'; try { localStorage.setItem(draftKey, textarea.value); } catch (_) {} }
  remember(); textarea.oninput = remember;
  const file = form.elements.media, preview = container.querySelector('.social-attachment');
  let objectUrl;
  if (file) file.onchange = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const selected = file.files[0]; preview.replaceChildren(); preview.hidden = !selected;
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) { file.value = ''; preview.hidden = true; toast('Choose media under 10 MB.'); return; }
    objectUrl = URL.createObjectURL(selected);
    const el = document.createElement(selected.type.startsWith('video/') ? 'video' : 'img');
    el.src = objectUrl; el.alt = 'Attachment preview'; if (el.tagName === 'VIDEO') el.controls = true;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove attachment';
    remove.onclick = () => { file.value = ''; preview.hidden = true; URL.revokeObjectURL(objectUrl); preview.replaceChildren(); };
    preview.append(el, remove);
  };
  if (file) {
    const pad=document.createElement('div');container.append(pad);
    const stop=mountDrawing(pad,{draftKey:draftKey+'_drawing',attach:image=>{const transfer=new DataTransfer();transfer.items.add(image);file.files=transfer.files;file.dispatchEvent(new Event('change'));}});
    disposers.push(stop);
  }
  bindForm(form, async data => {
    const body = String(data.get('body') || '').trim();
    if (!body && !file?.files.length) throw new Error('Write something or attach a photo or video.');
    const selected = file?.files[0];
    let contentWarnings = data.get('sensitive') ? ['sensitive'] : [];
    if (selected && window.CoolbradorMediaSafety) {
      const result = await window.CoolbradorMediaSafety.scan(selected, body);
      if (result?.softNsfw) contentWarnings.push('nsfw');
      if (result?.ok === false) throw new Error('This attachment could not be accepted. Please choose another file.');
    }
    const media = selected ? await api.upload(selected) : null;
    try { if (reply) await api.comment(reply, body); else await api.createPost({ body, media, contentWarnings, board: board || data.get('board') }); }
    catch(error){if(media&&['permission-denied','invalid-argument'].includes(error.code))await api.discardUpload(media).catch(()=>{});throw error;}
    textarea.value = ''; if (file) file.value = ''; preview.hidden = true; preview.replaceChildren();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    remember(); toast(reply ? 'Reply posted.' : 'Your post is live.');
  });
  return container;
}
function mediaHTML(media) {
  if (!media?.url || !safeUrl(media.url)) return '';
  const url = escape(safeUrl(media.url));
  return media.type === 'video' ? `<video class="social-media" src="${url}" controls preload="metadata" playsinline></video>` : `<a href="${url}" target="_blank" rel="noopener"><img class="social-media" src="${url}" alt="Post attachment" loading="lazy"></a>`;
}
function postBody(post) {
  const content = `<p class="social-post-text">${escape(post.text)}</p>${mediaHTML(post.media)}`;
  if (matchesMuted(post.text)) return `<details class="social-content-warning"><summary>Muted word or phrase · Show post</summary>${content}</details>`;
  const classification = window.CoolbradorSensitiveFilter?.classifyPost(post);
  if (classification && !window.CoolbradorSensitiveFilter.shouldShowPost(post)) return `<details class="social-content-warning"><summary>Sensitive content · Show post</summary>${content}</details>`;
  return content;
}
function postCard(post, detailed = false) {
  posts.set(post.id, post);
  const el = document.createElement('article'); el.className = 'social-post'; el.dataset.postId = post.id;
  const own = post.authorId === api.state.user?.uid;
  el.innerHTML = `${post._repost ? `<p class="social-muted">↻ <a href="${profileUrl(post._repost.profileId)}">${escape(post._repost.name)}</a> reposted</p>` : ''}<header class="social-post-head"><a class="social-author" href="${profileUrl(post.profileId)}">${avatar()}<strong>Loading profile…</strong></a><a class="social-board-tag" href="/b/${encodeURIComponent(post.board)}">${escape(post.board)}${post.inGame ? ' · In-game' : ''}</a>
    <details class="social-menu"><summary aria-label="Post options">•••</summary><div><button data-action="share" data-id="${escape(post.id)}">Copy link</button>${own ? `<button data-action="edit" data-id="${escape(post.id)}">Edit post</button><button data-action="delete" data-id="${escape(post.id)}">Delete post</button>` : `<button data-action="report" data-id="${escape(post.id)}">Report post</button><button data-action="block" data-id="${escape(post.id)}">Block author</button>`}</div></details></header>
    <a class="social-post-time" href="${postUrl(post.id)}">${time(post.createdAt)}${post.editedAt ? ' · edited' : ''}</a>${postBody(post)}
    <footer class="social-post-actions"><button data-action="yeah" data-id="${escape(post.id)}" aria-pressed="false">♡ Yeah! <span>0</span></button><a href="${postUrl(post.id)}${detailed ? '#reply' : ''}">↩ Reply</a><button data-action="repost" data-id="${escape(post.id)}" aria-pressed="false">↻ Repost <span>0</span></button><button data-action="share" data-id="${escape(post.id)}">↗ Share</button></footer>`;
  api.profile(post.profileId).then(p => {
    if (!p) { el.querySelector('.social-author strong').textContent = 'Former member'; return; }
    el.querySelector('.social-author').innerHTML = avatar(p) + `<strong>${escape(userName(p))}</strong>`;
  }).catch(() => { el.querySelector('.social-author strong').textContent = 'Member'; });
  cardDisposers.push(api.watchReactions(post.id, reactions => {
    for (const kind of ['yeah','repost']) {
      const btn = el.querySelector(`[data-action=${kind}]`);
      btn.querySelector('span').textContent = reactions.filter(r => r[kind]).length;
      btn.setAttribute('aria-pressed', String(reactions.some(r => r.id === api.state.user?.uid && r[kind])));
    }
  }, () => {}));
  return el;
}
function disposeCards() { cardDisposers.splice(0).forEach(fn => fn()); }
async function confirmDialog(title, label, value, multiline = false, maxLength = 2000, required = true) {
  const dialog = document.createElement('dialog'); dialog.className = 'social-dialog';
  dialog.setAttribute('aria-labelledby','socialDialogTitle');
  dialog.innerHTML = `<form method="dialog"><h2 id="socialDialogTitle">${escape(title)}</h2>${label ? `<label>${escape(label)}${multiline ? `<textarea name="value" rows="5" maxlength="${maxLength}" ${required?'required':''}>${escape(value || '')}</textarea>` : `<p>${escape(value || '')}</p>`}</label>` : ''}<div class="social-actions"><button value="cancel" formnovalidate>Cancel</button><button class="social-primary" value="confirm">Confirm</button></div></form>`;
  const previousFocus=document.activeElement;
  document.body.append(dialog); dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => { const result = dialog.returnValue === 'confirm' ? multiline ? dialog.querySelector('textarea').value : true : null; dialog.remove(); if(previousFocus?.isConnected)previousFocus.focus(); resolve(result); }, { once: true }));
}
root.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]'); if (!button || button.disabled) return;
  const { action, id } = button.dataset, post = posts.get(id);
  if (!post) return;
  if (!['share','report'].includes(action) && !requireUser()) return;
  if(action==='report' && !api.state.user){location.assign('/safety.html?url='+encodeURIComponent(location.origin+postUrl(id))+'#report');return;}
  button.disabled = true;
  try {
    if (action === 'share') {
      const url = location.origin + postUrl(id);
      try { await navigator.clipboard.writeText(url); toast('Post link copied.'); } catch { await confirmDialog('Link to this post', 'Copy this URL', url); }
    } else if (['yeah','repost'].includes(action)) { await api.react(id, action); if (action === 'repost') toast('Repost updated.'); }
    else if (action === 'delete') { if (await confirmDialog('Delete this post?', 'This cannot be undone.', '')) await api.removePost(id); }
    else if (action === 'edit') { const value = await confirmDialog('Edit post', 'Post text', post.text, true); if (value !== null) await api.editPost(id, value); }
    else if (action === 'report') { await reportDialog({postId:post.id},location.origin+postUrl(id)); }
    else if (action === 'block') { if (await confirmDialog('Block this person?', 'Their posts will be hidden and they will be unable to message you.', '')) { await api.block(post.authorId, true); toast('Person blocked. Manage blocks in Friends.'); } }
  } catch (error) { failure(error); } finally { button.disabled = false; }
});
document.addEventListener('click', event => {
  document.querySelectorAll('.social-menu[open]').forEach(menu => { if(!menu.contains(event.target))menu.open=false; });
});
document.addEventListener('keydown', event => {
  if(event.key==='Escape')document.querySelectorAll('.social-menu[open]').forEach(menu => {menu.open=false;menu.querySelector('summary').focus();});
});
async function reportDialog(target,url) {
  const dialog=document.createElement('dialog');dialog.className='social-dialog';dialog.setAttribute('aria-labelledby','reportTitle');
  dialog.innerHTML=`<form method="dialog"><h2 id="reportTitle">Report content</h2><p>Reports go to moderators. Your identity is not shown to the author.</p><label>Reason<select name="category"><option>Harassment or threats</option><option>Hate or violence</option><option>Child safety</option><option>Privacy or intimate images</option><option>Scam or spam</option><option>Copyright</option><option>Other</option></select></label><label>What happened?<textarea name="reason" rows="4" maxlength="850" required></textarea></label><p><a id="legalNotice">Report suspected illegal content without an account →</a></p><div class="social-actions"><button value="cancel" formnovalidate>Cancel</button><button value="submit" class="social-primary">Submit report</button></div></form>`;
  dialog.querySelector('#legalNotice').href='/safety.html?url='+encodeURIComponent(url)+'#report';
  const previous=document.activeElement;document.body.append(dialog);dialog.showModal();
  const form=dialog.querySelector('form'),status=document.createElement('p');status.setAttribute('role','status');form.append(status);
  let busy=false;
  form.onsubmit=async event=>{
    if(event.submitter?.value==='cancel')return;
    event.preventDefault();if(busy)return;
    const values=new FormData(form),reason=String(values.get('reason')).trim();
    if(!reason){status.textContent='Please describe what happened.';form.elements.reason.focus();return;}
    busy=true;form.setAttribute('aria-busy','true');form.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await api.reportContent(target,values.get('category')+': '+reason);dialog.close();toast('Report submitted for review.');}
    catch(error){status.textContent=api.friendlyError(error);}
    finally{busy=false;form.removeAttribute('aria-busy');form.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  await new Promise(resolve=>dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();resolve();},{once:true}));
}
function boardGrid() {
  return `<nav class="social-boards" aria-label="Communities">${api.BOARDS.map((b,i) => `<a href="/b/${b}"><span aria-hidden="true">${['✦','🎮','☾','🌱','🌎','⚑','🎁','🌾'][i] || '✦'}</span><strong>${escape(api.boardInfo.get(b)?.name || b)}</strong><small>${b === 'BeeSid' ? 'The Chipper game board' : 'Join the conversation'}</small></a>`).join('')}</nav>`;
}
function renderFeed(board, authorId) {
  const host = root.querySelector('#liveFeed'), load = root.querySelector('#loadMore');
  let current = [], reposts = [], stops = [], repostStops = [], generation = 0, count = 30, subscribedKey, repostRevision = 0;
  const postPages = new Map(), repostPages = new Map();
  const preferenceKey='cb_feed_'+(api.state.user?.uid||'guest');
  let preferences;try{preferences=readFeedPreferences(localStorage,preferenceKey);}catch{preferences={interests:[],seen:{}};}
  const rankingNow=Date.now(),seenAtStart={...preferences.seen};
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(!root.querySelector('[data-feed=for-you][aria-selected=true]'))return;for(const entry of entries)if(entry.isIntersecting&&entry.intersectionRatio>=.5){preferences.seen[entry.target.dataset.postId]=Date.now();observer.unobserve(entry.target);}try{preferences.seen=Object.fromEntries(Object.entries(preferences.seen).sort((a,b)=>b[1]-a[1]).slice(0,500));localStorage.setItem(preferenceKey,JSON.stringify(preferences));}catch{}},{threshold:.5}):null;
  disposers.push(()=>observer?.disconnect());
  function friendsMode() { return !!root.querySelector('[data-feed="friends"][aria-selected="true"]'); }
  function sourceIds() { return [...new Set([api.state.user?.uid,...friends.filter(f=>f.status==='accepted').flatMap(f=>f.participants)])].filter(id=>id&&!blocks.includes(id)).sort(); }
  function render() {
    disposeCards(); observer?.disconnect(); host.replaceChildren();
    let filtered = deduplicatePosts([...current, ...reposts]).filter(p => !blocks.includes(p.authorId) && !blocks.includes(p._repost?.authorId));
    filtered.sort((a,b) => api.timestamp(b._repost?.createdAt || b.createdAt)-api.timestamp(a._repost?.createdAt || a.createdAt));
    if(root.querySelector('[data-feed=for-you][aria-selected=true]'))filtered=rankPosts(filtered,{now:rankingNow,interests:preferences.interests,friends:sourceIds().filter(id=>id!==api.state.user?.uid),seen:seenAtStart,blocked:blocks});
    const term = (root.querySelector('#feedSearch')?.value || '').toLowerCase().trim();
    if (term) filtered = filtered.filter(p => p.text.toLowerCase().includes(term) || p.board.toLowerCase().includes(term));
    if (!filtered.length) host.innerHTML = empty('A fresh start', term ? 'No matching posts loaded. Load more or try another search.' : friendsMode() ? 'Posts and reposts from your friends will appear here.' : 'Share the first post or explore a community.', '<a href="/friends.html">Discover people →</a>');
    else filtered.forEach(p => {const card=postCard(p);host.append(card);if(p._rankReason){const why=document.createElement('p');why.className='social-muted social-ranking-reason';why.textContent=p._rankReason;card.prepend(why);observer?.observe(card);}});
    load.hidden = ![...postPages.values(),...repostPages.values()].some(rows=>rows.length===count);
  }
  function subscribe() {
    stops.forEach(fn=>fn()); repostStops.forEach(fn=>fn()); stops=[];repostStops=[];
    const version=++generation; current=[];reposts=[];postPages.clear();repostPages.clear();
    const ids=sourceIds(), mode=friendsMode(); subscribedKey=JSON.stringify([mode,ids,count]);
    const chunks=mode ? Array.from({length:Math.ceil(ids.length/30)},(_,i)=>ids.slice(i*30,i*30+30)) : [null];
    host.setAttribute('aria-busy','true');
    function failed(error) { if(version!==generation)return;host.removeAttribute('aria-busy');host.innerHTML=empty('Could not load posts',api.friendlyError(error),'<button id="retryFeed">Try again</button>');host.querySelector('#retryFeed').onclick=subscribe; }
    function rebuildReposts() {
      const revision=++repostRevision;
      repostStops.forEach(fn=>fn());repostStops=[];reposts=[];
      const entries=[...repostPages.values()].flat();
      entries.forEach(r=>repostStops.push(api.watchPost(r.postId,async p=>{
        const sharer=await api.profile(r.profileId).catch(()=>null);
        if(version!==generation||revision!==repostRevision)return;
        reposts=reposts.filter(existing=>existing._repost.id!==r.id);
        if(p&&(!board||p.board===board))reposts.push({...p,_repost:{...r,name:userName(sharer)}});
        render();
      },failure)));
      render();
    }
    chunks.forEach((authorIds,i)=>{
      stops.push(api.watchPosts({board,authorId,authorIds,count},rows=>{if(version!==generation)return;postPages.set(i,rows);current=[...postPages.values()].flat();host.removeAttribute('aria-busy');render();},failed));
      stops.push(api.watchReposts({authorId,authorIds,count},rows=>{if(version!==generation)return;repostPages.set(i,rows);rebuildReposts();},failed));
    });
    if(!chunks.length){host.removeAttribute('aria-busy');render();}
  }
  feedRender=()=>{if(subscribedKey!==JSON.stringify([friendsMode(),sourceIds(),count]))subscribe();else render();};
  load.onclick=()=>{count+=30;subscribe();};
  root.querySelector('#feedSearch')?.addEventListener('input',render);
  root.querySelectorAll('[data-feed]').forEach(tab=>{tab.onclick=()=>{
    if(tab.dataset.feed==='friends'&&!requireUser())return;
    const explanation=root.querySelector('#feedExplanation');if(explanation)explanation.textContent=tab.dataset.feed==='for-you'?'Ranked by chosen communities, friends, freshness and variety. Seen posts get less priority. Ranking stays on this device.':'Newest posts and reposts first.';
    root.querySelectorAll('[data-feed]').forEach(el=>{el.setAttribute('aria-selected',String(el===tab));el.tabIndex=el===tab?0:-1;});count=30;subscribe();
  };});
  disposers.push(()=>{generation++;stops.forEach(fn=>fn());repostStops.forEach(fn=>fn());});subscribe();
}
async function feedPage(board) {
  const title = (page==='gift'?'Gifts for the pack':api.boardInfo.get(board)?.name || board) || (page === 'home' ? 'Your corner of the cosmos' : 'Community');
  root.innerHTML = heading(title, page==='gift'?'Share drawings, encouragement and thank-yous. This board does not take payments.':board === 'BeeSid' ? 'The Miiverse-style home for Chipper moments, drawings, and in-game discoveries.' : 'Small moments. Big conversations. A place for the whole pack.') +
    (page === 'home' || !board ? boardGrid() : '') +
    `<div id="composer"></div>${board === 'BeeSid' ? '<aside class="social-callout">🎮 Posts on this board are marked for Chipper. <a href="?archive=1">Explore the original game feed →</a></aside>' : ''}
    <div class="social-feed-toolbar"><div role="tablist" aria-label="Feed"><button role="tab" data-feed="latest" aria-selected="true">Latest</button><button role="tab" data-feed="for-you" aria-selected="false" tabindex="-1">For you</button><button data-auth-required role="tab" data-feed="friends" aria-selected="false" tabindex="-1">Friends</button></div><label>Search posts<input id="feedSearch" type="search" placeholder="Find a conversation"></label></div><p class="social-muted"><span id="feedExplanation">Newest posts and reposts first.</span> <a href="/settings#feedPreferences">Choose your interests</a> · <a href="/safety.html#feed">How your feed works</a></p><section id="liveFeed" aria-label="Posts"><p>Loading posts…</p></section><button id="loadMore" class="social-load" hidden>Load more posts</button>`;
  root.querySelector('#composer').append(composer(board)); renderFeed(board);
  if (page === 'home') { const grid=root.querySelector('.social-boards');grid.classList.add('is-carousel');root.querySelector('.social-heading').after(root.querySelector('#composer'));const browse=document.createElement('a');browse.href='/community.html';browse.textContent='Browse all communities →';grid.after(browse); }
  if (page === 'community' && api.state.profile) {
    const create = document.createElement('details'); create.className = 'social-poll-compose';
    create.innerHTML = '<summary>＋ Start a community</summary><form class="social-compose"><label>Community name<input name="name" maxlength="48" required></label><label>Description<textarea name="description" maxlength="280" rows="2"></textarea></label><button type="submit" class="social-primary">Create community</button><p role="status"></p></form>';
    root.querySelector('.social-boards').after(create);
    bindForm(create.querySelector('form'), async data => { location.assign('/b/' + await api.createBoard(data.get('name'),data.get('description'))); });
  }
  const info = api.boardInfo.get(board);
  if (info) {
    root.querySelector('.social-heading > p:last-child').textContent = info.description;
    if (info.ownerId === api.state.user?.uid) {
      const edit = document.createElement('button'); edit.textContent = 'Edit community description';
      root.querySelector('.social-heading').append(edit);
      edit.onclick = async () => { const text = await confirmDialog('Edit community','Description',info.description,true,280,false); if (text !== null) { try { await api.updateBoard(board,text); location.reload(); } catch (error) { failure(error); } } };
    }
  }
}
async function threadPage() {
  const id = decodeURIComponent(location.pathname.split('/')[2] || '');
  root.innerHTML = `<a href="/community.html">← Back to community</a><section id="threadPost"><p>Loading post…</p></section><section id="threadComments" aria-label="Replies"></section><button id="moreReplies" class="social-load" hidden>Load more replies</button><div id="reply"></div>`;
  let stopComments, mounted = false, commentVersion=0;
  disposers.push(api.watchPost(id, post => {
    disposeCards(); const target = root.querySelector('#threadPost'); target.replaceChildren();
    if (!post) { commentVersion++; mounted=false; target.innerHTML = empty('Post not found', 'It may have been deleted or the link is incorrect.'); root.querySelector('#reply').replaceChildren(); root.querySelector('#threadComments').replaceChildren(); root.querySelector('#moreReplies').hidden=true; stopComments?.(); return; }
    target.append(postCard(post, true));
    if (!mounted) {
      mounted = true; root.querySelector('#reply').append(composer('', post));
      stopComments = api.watchLinkedComments(id,location.hash.startsWith('#comment-')?decodeURIComponent(location.hash.slice(9)):null, async (comments, more) => {
        root.querySelector('#moreReplies').hidden = !more; const version=++commentVersion;
        const container = root.querySelector('#threadComments');
        const cards = await Promise.all(comments.map(async c => {
          const p = await api.profile(c.profileId).catch(() => null);
          if (blocks.includes(c.authorId)) return '';
          return `<article class="social-comment" id="comment-${escape(c.id)}"><a class="social-author" href="${profileUrl(c.profileId)}">${avatar(p)}<strong>${escape(userName(p))}</strong></a>${time(c.createdAt)}${matchesMuted(c.text)?`<details class="social-content-warning"><summary>Muted word or phrase · Show reply</summary><p>${escape(c.text)}</p>${mediaHTML(c.media)}</details>`:`<p>${escape(c.text)}</p>${mediaHTML(c.media)}`}${api.state.user?.uid === c.authorId || api.state.user?.uid === post.authorId ? `<button data-delete-comment="${escape(c.id)}">Delete reply</button>` : `<button data-report-comment="${escape(c.id)}">Report reply</button>`}</article>`;
        }));
        if(version!==commentVersion)return;
        container.innerHTML = `<h2>Replies (${comments.length}${more ? '+' : ''})</h2>` + (cards.join('') || '<p class="social-muted">Start the conversation.</p>');
        revealAnchor();
        container.querySelectorAll('[data-report-comment]').forEach(button=>{button.onclick=async()=>{const url=location.origin+postUrl(id)+'#comment-'+button.dataset.reportComment;if(!api.state.user){location.assign('/safety.html?url='+encodeURIComponent(url)+'#report');return;}try{await reportDialog({postId:id,commentId:button.dataset.reportComment},url);}catch(error){failure(error);}};});
        container.querySelectorAll('[data-delete-comment]').forEach(button => { button.onclick = async () => { if (await confirmDialog('Delete reply?', '', '')) { try { await api.removeComment(id, button.dataset.deleteComment); } catch (error) { failure(error); } } }; });
      }, failure);
      root.querySelector('#moreReplies').onclick = () => stopComments.more();
    }
  }, error => { root.querySelector('#threadPost').innerHTML = empty('Could not load post', api.friendlyError(error)); }));
  disposers.push(() => { commentVersion++; stopComments?.(); });
}
async function peoplePage() {
  const revision = bootRevision;
  root.innerHTML = heading('Find your pack', 'Real people, shared interests, and conversations that carry on.') + `<label class="social-search">Search people<input id="peopleSearch" type="search" placeholder="Search by display name"></label><div id="requests"></div><h2>Your friends</h2><div id="friendList" class="social-person-grid"></div><h2>Discover people</h2><div id="peopleList" class="social-person-grid"><p>Loading people…</p></div><button id="morePeople" class="social-load">Load more people</button><p class="social-muted">Search covers people loaded so far. Load more to explore further.</p><div id="blockedList"></div>`;
  let cursor, resolving = false; const resolved = new Set();
  async function loadPeople() {
    const button = root.querySelector('#morePeople'); button.disabled = true;
    try { const result = await api.peoplePage(cursor); if (revision !== bootRevision) return; cursor = result.cursor;
      const merged = new Map(people.map(p => [p.uid,p])); result.rows.forEach(p => merged.set(p.uid,p)); people = [...merged.values()];
      button.hidden = !result.hasMore; paint();
    } catch(error) { failure(error); } finally { button.disabled = false; }
  }
  root.querySelector('#morePeople').onclick = loadPeople;
  function paint() {
    if (revision !== bootRevision) return;
    // Resolve all friends/requesters independently from discovery pagination.
    const ids = [...new Set([...friends.flatMap(f=>f.participants), ...blocks])].filter(id=>!resolved.has(id)&&!people.some(p=>p.uid===id));
    if (ids.length && !resolving) { resolving=true; ids.forEach(id=>resolved.add(id)); Promise.all(ids.map(id=>api.profileByUid(id))).then(rows=>{ if (revision !== bootRevision) return; rows.filter(Boolean).forEach(p=>people.push(p)); resolving=false; paint(); }).catch(error=>{resolving=false;failure(error);}); }

    const query = root.querySelector('#peopleSearch').value.toLowerCase();
    const accepted = friends.filter(f => f.status === 'accepted').flatMap(f => f.participants);
    const pending = friends.filter(f => f.status === 'pending' && f.requester !== api.state.user?.uid && !blocks.includes(f.requester));
    root.querySelector('#requests').innerHTML = pending.length ? `<h2>Friend requests</h2>${pending.map(f => `<div class="social-request"><span>${escape(userName(people.find(p => p.uid === f.requester)))}</span><button data-accept="${escape(f.id)}">Accept</button><button data-remove="${escape(f.id)}">Decline</button></div>`).join('')}` : '';
    for (const [id, isFriend] of [['friendList',true],['peopleList',false]]) {
      const list = people.filter(p => p.uid !== api.state.user?.uid && !blocks.includes(p.uid) && accepted.includes(p.uid) === isFriend && userName(p).toLowerCase().includes(query));
      root.querySelector('#' + id).innerHTML = list.length ? list.map(p => {
        const relation = friends.find(f => f.participants.includes(p.uid));
        return `<article class="social-person"><a class="social-author" href="${profileUrl(p.id)}">${avatar(p)}<strong>${escape(userName(p))}</strong></a><p>${escape(p.bio || 'Member of the pack')}</p><div class="social-actions">${relation ? `<button data-remove="${escape(relation.id)}">${relation.status === 'accepted' ? 'Remove friend' : relation.requester===api.state.user?.uid ? 'Cancel request' : 'Decline request'}</button>` : `<button data-add="${escape(p.uid)}">Add friend</button>`}<button data-message="${escape(p.uid)}">Message</button></div></article>`;
      }).join('') : `<p class="social-muted">${isFriend ? 'No friends yet. Find someone below and send a request.' : 'No people match your search.'}</p>`;
    }
    root.querySelector('#blockedList').innerHTML = blocks.length ? `<h2>Blocked people</h2>${blocks.map(id => `<div class="social-request"><span>${escape(userName(people.find(p => p.uid === id)))}</span><button data-unblock="${escape(id)}">Unblock</button></div>`).join('')}` : '';
    root.querySelectorAll('[data-accept],[data-add],[data-remove],[data-message],[data-unblock]').forEach(button => { button.onclick = async () => {
      if (!requireUser()) return; button.disabled = true;
      try {
        const d = button.dataset;
        if (d.accept) await api.acceptFriend(d.accept);
        if (d.add) { await api.requestFriend(d.add); toast('Friend request sent.'); }
        if (d.remove) await api.removeFriend(d.remove);
        if (d.unblock) await api.block(d.unblock, false);
        if (d.message) location.assign('/messages?thread=' + encodeURIComponent(await api.openConversation(d.message)));
      } catch (error) { failure(error); } finally { button.disabled = false; }
    }; });
  }
  feedRender = paint; root.querySelector('#peopleSearch').oninput = paint; await loadPeople(); paint();
}
async function profilePage() {
  const revision = bootRevision;
  const id = decodeURIComponent(location.pathname.split('/')[2] || api.state.profile?.id || '');
  const p = await api.profile(id);
  if (revision !== bootRevision) return;
  if (!p) { root.innerHTML = heading('Profile') + empty('Profile not found', 'This profile may be an archived demo or its link may be incorrect.', '<a href="/friends.html">Discover people →</a>'); return; }
  const own = p.uid === api.state.user?.uid;
  root.innerHTML = `<header class="social-profile">${avatar(p)}<div><p class="social-eyebrow">MEMBER OF THE PACK</p><h1>${escape(userName(p))}</h1><p class="social-bio">${escape(p.bio || 'A little corner of the Coolbrador cosmos.')}</p><small>Joined ${escape(timeLabel(p.createdAt))}</small></div></header><div class="social-actions" data-auth-required>${own ? '<button id="editProfile">Edit profile</button><a href="/settings">Customize appearance</a>' : '<button id="profileFriend">Add friend</button><button id="profileMessage">Message</button><button id="profileBlock">Block</button>'}</div><div id="profileEditor"></div><h2>Posts</h2><p class="social-muted">Newest first · <a href="/safety.html#feed">How your feed works</a></p><section id="liveFeed"></section><button id="loadMore" class="social-load" hidden>Load more posts</button>`;
  renderFeed(undefined, p.uid);
  if (own) root.querySelector('#editProfile').onclick = () => {
    const editor = root.querySelector('#profileEditor');
    editor.innerHTML = `<form class="social-compose"><label>Display name<input name="displayName" maxlength="48" required value="${escape(userName(p))}"></label><label>Bio<textarea name="bio" maxlength="500" rows="3">${escape(p.bio)}</textarea></label><label>Profile photo<input name="avatar" type="file" accept="image/png,image/jpeg,image/gif,image/webp"></label><div class="social-actions"><button type="button" id="cancelProfile">Cancel</button><button type="submit" class="social-primary">Save profile</button></div><p role="status"></p></form>`;
    editor.querySelector('#cancelProfile').onclick = () => editor.replaceChildren();
    bindForm(editor.querySelector('form'), async data => {
      const file = data.get('avatar');
      const media = file?.size ? await api.upload(file) : null;
      try { await api.saveProfile({ displayName: data.get('displayName'), bio: data.get('bio'), avatarUrl: media?.url, avatarPath:media?.path }); }
      catch(error){if(media&&['permission-denied','invalid-argument'].includes(error.code))await api.discardUpload(media).catch(()=>{});throw error;}
      location.reload();
    });
    editor.querySelector('input').focus();
  };
  else {
    const friend = root.querySelector('#profileFriend');
    function update() {
      const relation=friends.find(f=>f.participants.includes(p.uid)),blocked=blocks.includes(p.uid);
      friend.textContent=blocked?'Unblock to connect':relation?relation.status==='accepted'?'Remove friend':relation.requester===api.state.user?.uid?'Cancel request':'Accept request':'Add friend';friend.disabled=blocked;
      root.querySelector('#profileMessage').disabled=blocked;root.querySelector('#profileBlock').textContent=blocked?'Unblock':'Block';
    }
    const renderPosts=feedRender;feedRender=()=>{renderPosts();update();};update();
    friend.onclick=async()=>{if(!requireUser())return;friend.disabled=true;try{const relation=friends.find(f=>f.participants.includes(p.uid));if(!relation)await api.requestFriend(p.uid);else if(relation.status==='pending'&&relation.requester!==api.state.user.uid)await api.acceptFriend(relation.id);else await api.removeFriend(relation.id);}catch(error){failure(error);}finally{update();}};
    root.querySelector('#profileBlock').onclick=async()=>{if(!requireUser())return;const blocked=blocks.includes(p.uid);if(blocked||await confirmDialog('Block this person?','Their posts will be hidden and contact will be restricted.','')){try{await api.block(p.uid,!blocked);}catch(error){failure(error);}}};
    root.querySelector('#profileMessage').onclick = async () => { if (requireUser()) { try { location.assign('/messages?thread=' + encodeURIComponent(await api.openConversation(p.uid))); } catch (error) { failure(error); } } };
  }
}
async function messagesPage() {
  if (!api.state.profile) return gate();
  root.innerHTML = heading('Messages', 'A quieter corner for conversations with your pack.') + `<div class="social-inbox"><aside><a href="/friends.html">＋ New conversation</a><nav id="conversationList" aria-label="Conversations"></nav></aside><section id="conversation"><div class="social-empty"><h2>Choose a conversation</h2><p>Start a message from someone’s profile or the people directory.</p></div></section></div>`;
  let active = new URLSearchParams(location.search).get('thread'), stopMessages, threadRows = [], readTimes=new Map(), lastRead=0;
  function readActive() { if(active&&!document.hidden&&threadRows.some(t=>t.id===active)&&Date.now()-lastRead>1000){lastRead=Date.now();api.markConversationRead(active).catch(failure);} }
  document.addEventListener('visibilitychange',readActive); disposers.push(()=>document.removeEventListener('visibilitychange',readActive));
  disposers.push(api.watchConversationReads(rows=>{readTimes=rows;paintThreads();},failure));
  let selection = 0;
  async function select(id) {
    if (!threadRows.some(t => t.id === id)) { root.querySelector('#conversation').innerHTML = empty('Conversation unavailable', 'Choose a conversation you belong to.'); return; }
    active = id; history.replaceState(null, '', '?thread=' + encodeURIComponent(id)); stopMessages?.();
    const thread = threadRows.find(t => t.id === id), otherId = thread.participants.find(uid => uid !== api.state.user.uid);
    const version = ++selection; lastRead=0;
    const other = await api.profileByUid(otherId); if(version !== selection) return;
    const pane = root.querySelector('#conversation');
    pane.innerHTML = `<header class="social-chat-head"><a href="${profileUrl(other?.id || otherId)}">${escape(userName(other))}</a><span class="social-muted">Private conversation</span></header><button id="olderMessages" class="social-load" hidden>Load older messages</button><div id="messageLog" class="social-message-log" role="log" tabindex="0" aria-label="Messages" aria-live="polite"></div><form class="social-chat-compose"><label>Message<textarea name="message" rows="2" maxlength="2000" required placeholder="Write a message…"></textarea></label><button type="submit" class="social-primary">Send</button><p role="status"></p></form>`;
    const form = pane.querySelector('form');
    const draftKey = `cb_dm_draft_${api.state.user.uid}_${id}`;
    try { form.elements.message.value = localStorage.getItem(draftKey) || ''; } catch (_) {}
    form.elements.message.oninput = () => { try { localStorage.setItem(draftKey,form.elements.message.value); } catch (_) {} };
    if (!other || blocks.includes(otherId)) { form.hidden=true; pane.querySelector('.social-chat-head span').textContent=other?'You blocked this person':'This account was deleted'; }
    bindForm(form, async data => { await api.sendMessage(id, data.get('message')); form.elements.message.value = ''; try { localStorage.removeItem(draftKey); } catch (_) {} });
    let loadingOlder = false;
    pane.querySelector('#olderMessages').onclick = () => { loadingOlder=true; stopMessages.more(); };
    stopMessages = api.watchMessages(id, (messages, more) => {
      if(version !== selection) return; pane.querySelector('#olderMessages').hidden=!more;
      const log = pane.querySelector('#messageLog');
      const oldHeight = log.scrollHeight, oldTop = log.scrollTop;
      const nearEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80 || !log.children.length;
      log.innerHTML = messages.length ? messages.map(m => `<article class="social-message${m.senderId === api.state.user.uid ? ' is-own' : ''}"><p>${escape(m.text)}</p>${time(m.createdAt)}</article>`).join('') : '<p class="social-muted">Say hello to start the conversation.</p>';
      if (loadingOlder) { log.scrollTop = oldTop + log.scrollHeight - oldHeight; loadingOlder=false; }
      else if (nearEnd) log.scrollTop = log.scrollHeight;
      if(!document.hidden&&messages.some(m=>m.senderId!==api.state.user.uid&&api.timestamp(m.createdAt)>(readTimes.get(id)||0)))readActive();
    }, error => { pane.querySelector('[role=status]').textContent = api.friendlyError(error); });
    paintThreads();
  }
  function paintThreads() {
    const list = root.querySelector('#conversationList');
    list.innerHTML = threadRows.length ? threadRows.map(t => { const p = people.find(p => p.uid === t.participants.find(id => id !== api.state.user.uid)); return `<button data-thread="${escape(t.id)}" aria-current="${t.id === active}">${avatar(p)}<span>${escape(userName(p))}${t.lastSenderId&&t.lastSenderId!==api.state.user.uid&&api.timestamp(t.updatedAt)>(readTimes.get(t.id)||0)?' <strong class="social-unread">New</strong>':''}<small>${escape(timeLabel(t.updatedAt))}</small></span></button>`; }).join('') : '<p class="social-muted">No conversations yet.</p>';
    list.querySelectorAll('[data-thread]').forEach(button => { button.onclick = () => select(button.dataset.thread).catch(failure); });
  }
  let opened = false;
  disposers.push(api.watchConversations(async rows => { threadRows = rows; const profiles = await Promise.all(rows.map(t=>api.profileByUid(t.participants.find(id=>id!==api.state.user.uid)))); people=profiles.filter(Boolean); paintThreads(); if (active && !opened) { opened = true; select(active).catch(failure); } }, failure));
  disposers.push(() => stopMessages?.());
}
async function notificationsPage() {
  if (!api.state.profile) return gate();
  root.innerHTML = heading('Notifications', 'Replies to your posts and new connections.') + '<div class="social-actions"><a href="/friends.html">View friend requests →</a><button id="readAllNotifications">Mark all as read</button></div><section id="notificationList"><p>Loading notifications…</p></section><button id="moreNotifications" class="social-load" hidden>Load older notifications</button>';
  root.querySelector('#readAllNotifications').onclick=async event=>{const b=event.currentTarget;b.disabled=true;try{await api.markAllNotificationsRead();}catch(error){failure(error);}finally{b.disabled=false;}};
  let notificationVersion=0;
  const stopNotifications = api.watchNotifications(async (rows, more) => {
    const version=++notificationVersion;
    root.querySelector('#moreNotifications').hidden=!more;
    const entries = await Promise.all(rows.map(async n => {
      const p = await api.profile(n.profileId).catch(() => null);
      return `<article class="social-notification${n.read ? '' : ' is-unread'}">${avatar(p)}<div><a data-read="${escape(n.id)}" href="${postUrl(n.postId)}#comment-${encodeURIComponent(n.commentId)}"><strong>${escape(userName(p))}</strong> replied to your post<p>${escape(n.text)}</p></a>${time(n.createdAt)}</div>${n.read ? '' : `<button data-mark="${escape(n.id)}" aria-label="Mark notification as read">✓</button>`}</article>`;
    }));
    if(version!==notificationVersion)return;
    const host = root.querySelector('#notificationList'); host.innerHTML = entries.join('') || empty('You’re all caught up', 'Replies to your posts will appear here.');
    host.querySelectorAll('[data-mark]').forEach(button => { button.onclick = () => api.markRead(button.dataset.mark).catch(failure); });
    host.querySelectorAll('[data-read]').forEach(link => { link.onclick = async event => { event.preventDefault(); try { await api.markRead(link.dataset.read); } catch (_) {} location.assign(link.href); }; });
  }, failure);
  disposers.push(stopNotifications); root.querySelector('#moreNotifications').onclick=()=>stopNotifications.more();
}
async function pollsPage() {
  root.innerHTML = heading('The pack decides', 'Ask a question. Cast a vote. Watch the conversation take shape.') + `<details class="social-poll-compose" data-auth-required><summary>＋ Create a poll</summary><form class="social-compose"><label>Question<input name="title" maxlength="180" required placeholder="What should we explore next?"></label><label>Choices, one per line<textarea name="choices" rows="3" required placeholder="A new Chipper world&#10;A community drawing night"></textarea></label><label>Community<select name="board">${options('General')}</select></label><button type="submit" class="social-primary">Create poll</button><p role="status"></p></form></details><div id="pollList"><p>Loading polls…</p></div><button id="morePolls" class="social-load" hidden>Load older polls</button>`;
  const form = root.querySelector('form'); bindForm(form, async data => {
    await api.createPoll(data.get('title'), String(data.get('choices')).split('\n').map(v => v.trim()).filter(Boolean), data.get('board'));
    form.reset(); root.querySelector('details').open = false; toast('Poll created.');
  });
  let pollStops = [], charts = new Map();
  disposers.push(() => { pollStops.forEach(fn => fn()); charts.forEach(c => c?.destroy()); });
  const stopPolls = api.watchLinkedPolls(location.hash.startsWith('#poll-')?decodeURIComponent(location.hash.slice(6)):null,(polls, more) => {
    root.querySelector('#morePolls').hidden=!more;
    pollStops.forEach(fn => fn()); charts.forEach(c => c?.destroy()); pollStops = []; charts = new Map();
    const host = root.querySelector('#pollList'); host.replaceChildren();
    if (!polls.length) host.innerHTML = empty('A question starts a conversation', 'Create the first community poll.');
    polls.forEach(poll => {
      const card = document.createElement('article'); card.className = 'social-poll'; card.id = 'poll-' + poll.id;
      card.innerHTML = `<span class="social-board-tag">${escape(poll.board)}</span><h2>${escape(poll.title)}</h2><div class="social-vote-options">${poll.options.map((option,i) => `<button data-choice="${i}"><span>${escape(option)}</span><strong>0%</strong></button>`).join('')}</div><p class="social-vote-status" role="status"></p><div class="social-chart"></div><p class="social-muted">Share of votes, not betting odds. One vote per account. Votes are public.</p>${poll.authorId===api.state.user?.uid?`<div class="social-actions">${poll.closedAt?'':'<button data-close-poll>Close voting</button>'}<button data-delete-poll>Delete poll</button></div>`:'<button data-report-poll>Report poll</button>'}`;
      host.append(card); revealAnchor(); let myVote, chart;
      if(matchesMuted([poll.title,...poll.options].join(' ')))card.innerHTML='<details class="social-content-warning"><summary>Muted word or phrase · Show poll</summary>'+card.innerHTML+'</details>';
      card.querySelector('[data-report-poll]')?.addEventListener('click',async()=>{const url=location.origin+'/polls#poll-'+poll.id;if(!api.state.user){location.assign('/safety.html?url='+encodeURIComponent(url)+'#report');return;}try{await reportDialog({pollId:poll.id},url);}catch(error){failure(error);}});
      card.querySelector('[data-close-poll]')?.addEventListener('click',async()=>{if(await confirmDialog('Close this poll?','Existing votes and history will remain visible.','')){try{await api.closePoll(poll.id);}catch(error){failure(error);}}});
      card.querySelector('[data-delete-poll]')?.addEventListener('click',async()=>{if(await confirmDialog('Delete this poll?','Its votes and history will be permanently removed.','')){try{await api.removePoll(poll.id);}catch(error){failure(error);}}});
      card.querySelectorAll('[data-choice]').forEach(button => { button.onclick = async () => {
        if (!requireUser() || myVote || poll.closedAt) return;
        card.querySelectorAll('button[data-choice]').forEach(b => { b.disabled = true; });
        try { await api.vote(poll.id, Number(button.dataset.choice)); }
        catch (error) { failure(error); card.querySelectorAll('button[data-choice]').forEach(b => { b.disabled = !!myVote || !!poll.closedAt; }); }
      }; });
      pollStops.push(api.watchVotes(poll.id, votes => {
        myVote = votes.find(v => v.id === api.state.user?.uid);
        const counts = poll.options.map((_,i) => votes.filter(v => v.choice === i).length);
        card.querySelectorAll('[data-choice]').forEach((button,i) => { button.disabled = !!myVote || !!poll.closedAt; button.setAttribute('aria-pressed', String(myVote?.choice === i)); button.querySelector('strong').textContent = (votes.length ? Math.round(counts[i] / votes.length * 100) : 0) + '%'; });
        card.querySelector('.social-vote-status').textContent = `${votes.length} vote${votes.length === 1 ? '' : 's'}${poll.closedAt?' · Voting closed':''}${myVote ? ' · You voted for ' + poll.options[myVote.choice] : poll.closedAt ? '' : ' · Choose an option to vote'}`;
        const sorted = votes.filter(v => api.timestamp(v.createdAt)).sort((a,b) => api.timestamp(a.createdAt)-api.timestamp(b.createdAt));
        const running = poll.options.map(() => 0);
        const series = poll.options.map((name,i) => ({ id: String(i), name, points: [] }));
        sorted.forEach((vote,n) => { running[vote.choice]++; series.forEach((s,i) => s.points.push({ t: api.timestamp(vote.createdAt), v: running[i]/(n+1)*100 })); });
        chart?.destroy(); chart = window.CoolbradorScrubChart.mount(card.querySelector('.social-chart'), { series, title: poll.title, interpolation: 'step' }); charts.set(poll.id, chart);
      }, failure));
    });
  }, failure);
  disposers.push(stopPolls); root.querySelector('#morePolls').onclick=()=>stopPolls.more();
}
async function archivePage() {
  const revision = bootRevision;
  const board = decodeURIComponent(location.pathname.split('/')[2] || 'BeeSid');
  const response = await fetch('/data/community-archive.json'); if (!response.ok) throw new Error('The game archive is temporarily unavailable.');
  const data = await response.json();
  if (revision !== bootRevision) return;
  const all = data[board] || [];
  root.innerHTML = heading(board === 'BeeSid' ? 'Chipper game archive' : board + ' archive', 'Original Miiverse-style posts, preserved for the game. New conversations happen on the live BeeSid board.') + '<a class="social-primary" href="/b/BeeSid">Join the live board →</a><section id="archivePosts"></section>';
  const route = location.pathname.match(/\/post\/(\d+)\/comments/);
  const chronological = all.slice().sort((a,b) => (Date.parse(a.timestamp) || Number(a.id) || 0)-(Date.parse(b.timestamp) || Number(b.id) || 0));
  const selected = route ? [chronological[Number(route[1])-1]].filter(Boolean) : all;
  const host = root.querySelector('#archivePosts');
  if (!selected.length) { host.innerHTML = empty('Archived post not found'); return; }
  host.innerHTML = selected.map(p => `<article class="social-post"><header class="social-post-head"><strong>${escape(p.username || p.author || 'Chipper player')}</strong><span class="social-board-tag">Chipper archive</span></header><p class="social-post-text">${escape(p.text || p.body)}</p>${(Array.isArray(p.media) ? p.media : [p.media]).map(mediaHTML).join('')}<p class="social-muted">${Array.isArray(p.yeahs) ? p.yeahs.length : Number(p.yeahs) || 0} Yeah! · ${escape(timeLabel(p.timestamp))}</p></article>`).join('');
}
async function searchPage() {
  const revision = bootRevision;
  const term=new URLSearchParams(location.search).get('q')||'';
  root.innerHTML=heading('Search the pack','Find public posts and people. Use complete words; multiple words narrow the results.')+`<form id="publicSearch" class="social-compose" action="/search"><label>Search<input name="q" type="search" value="${escape(term)}" required minlength="2" maxlength="120"></label><button type="submit" class="social-primary">Search</button></form><div id="searchPeople"></div><div id="searchPosts"></div>`;
  if(!term.trim())return;
  for(const [kind,id,title] of [['profiles','searchPeople','People'],['posts','searchPosts','Posts']]){
    const section=root.querySelector('#'+id);section.innerHTML=`<h2>${title}</h2><div class="search-results"></div><button class="social-load">Load more ${title.toLowerCase()}</button><p role="status"></p>`;
    const host=section.querySelector('.search-results'),button=section.querySelector('button');let cursor,found=0;
    async function load(){button.disabled=true;section.querySelector('[role=status]').textContent='Searching…';
      try{const result=await api.searchPublic(kind,term,cursor);if(revision!==bootRevision)return;cursor=result.cursor;found+=result.rows.length;
        for(const item of result.rows){if(kind==='posts')host.append(postCard(item));else{const card=document.createElement('article');card.className='social-person';card.innerHTML=`<a class="social-author" href="${profileUrl(item.id)}">${avatar(item)}<strong>${escape(userName(item))}</strong></a><p>${escape(item.bio)}</p>`;host.append(card);}}
        button.hidden=!result.hasMore;section.querySelector('[role=status]').textContent=found?`${found} ${title.toLowerCase()} found${result.hasMore?'; more results available.':'.'}`:result.hasMore?'No matches in this page. Load more to keep searching.':'No matching '+title.toLowerCase()+'.';
      }catch(error){section.querySelector('[role=status]').textContent=api.friendlyError(error);}finally{button.disabled=false;}
    }
    button.onclick=load;await load();if(revision!==bootRevision)return;
  }
}
async function moderationPage() { await mountStaffPanel(root); }

function wireKeyboardTabs() {
  if (root.dataset.keyboardTabs) return;
  root.dataset.keyboardTabs = '1';
  root.addEventListener('keydown', e => {
    const tab = e.target.closest('[role=tab]'); if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    const tabs = [...tab.closest('[role=tablist]').querySelectorAll('[role=tab]')].filter(el => el.getClientRects().length);
    let i = tabs.indexOf(tab); i = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length-1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length)%tabs.length;
    e.preventDefault(); tabs[i].click(); tabs[i].focus();
  });
}
async function boot() {
  const revision = ++bootRevision;
  disposers.splice(0).forEach(fn => fn()); disposeCards();
  friends = []; blocks = []; people = []; feedRender = () => {};
  if (api.state.error && !publicPages.has(page)) {
    root.innerHTML = empty('Your account could not load', 'You are still signed in. Retry to reconnect your account.', '<button id="retryAccount">Try again</button>');
    root.querySelector('#retryAccount').onclick = async event => {
      event.target.disabled = true;
      try { await api.restoreSession(); } catch (error) { failure(error); }
      finally { event.target.disabled = false; }
    };
    return;
  }
  if (!publicPages.has(page) && !api.state.profile) { gate(); return; }
  if (api.state.profile) {
    disposers.push(api.watchFriends(rows => { friends = rows; feedRender(); }, failure));
    disposers.push(api.watchBlocks(rows => { blocks = rows; feedRender(); }, failure));
  }
  try {
    // A direct public post link must not depend on account or board discovery.
    if (!['post', 'archive'].includes(page)) await api.loadBoards();
    if (revision !== bootRevision) return;
    if (page === 'home' || page === 'community') await feedPage();
    else if (page === 'board') {
      const requested = decodeURIComponent(location.pathname.split('/')[2] || 'General');
      const board = api.BOARDS.find(b => b.toLowerCase() === requested.toLowerCase()) || requested;
      if (!api.BOARDS.includes(board)) root.innerHTML = heading('Community') + empty('Community not found', 'Choose a community below.') + boardGrid();
      else if (board === 'BeeSid' && new URLSearchParams(location.search).has('archive')) await archivePage();
      else await feedPage(board);
    } else if (page === 'post') await threadPage();
    else if (page === 'search') await searchPage();
    else if (page === 'gift') await feedPage('GiftDrive');
    else if (page === 'friends') await peoplePage();
    else if (page === 'profile') await profilePage();
    else if (page === 'messages') await messagesPage();
    else if (page === 'notifications') await notificationsPage();
    else if (page === 'polls') await pollsPage();
    else if (page === 'archive') await archivePage();
    else if (page === 'moderation') await moderationPage();
  } catch (error) { if (revision !== bootRevision) return; root.innerHTML = empty('Could not load this page', api.friendlyError(error), '<button onclick="location.reload()">Try again</button>'); }
  wireKeyboardTabs();
}
// Public reads start immediately. Auth/profile restoration only enables account
// controls; neither a slow profile request nor a failed one gates a public post.
let renderedAccount = '';
function accountKey() { return [api.state.user?.uid || '', api.state.profile?.id || '', !!api.state.error, api.state.ready].join(':'); }
if (publicPages.has(page)) {
  renderedAccount = accountKey(); boot();
} else {
  await api.ready;
  renderedAccount = accountKey(); boot();
}
api.watchAuth(() => {
  const next = accountKey();
  if (next !== renderedAccount) { renderedAccount = next; boot(); }
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
window.addEventListener('pagehide', () => { disposers.forEach(fn => fn()); disposeCards(); });
document.addEventListener('error', e => { if (e.target instanceof HTMLImageElement && !e.target.dataset.fallback) { e.target.dataset.fallback = '1'; e.target.src = '/users/default/pfp.jpg'; } }, true);
