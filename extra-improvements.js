/* Additional Dotis user dashboard improvements. All changes below are demo data stored in this browser. */
(function () {
  'use strict';

  const KEY = {
    recipients: 'dotis-demo-donation-recipients',
    saved: 'dotis-user-saved-items',
    causes: 'dotis-user-discovery-causes',
    dismissed: 'dotis-user-dismissed-recommendations',
    fallback: 'dotis-user-recipient-fallback',
    inboxRead: 'dotis-user-inbox-read',
    inbox: 'dotis-demo-updates-inbox',
    exceptions: 'dotis-admin-allocation-exceptions',
    apps: 'dotis-demo-campaign-applications',
    charityApps: 'dotis-demo-charity-applications',
    reviewMeta: 'dotis-admin-review-meta',
    pendingWrite: 'dotis-demo-pending-write'
  };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key)); return value == null ? fallback : value; } catch (_) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } };
  const statusText = item => String(item.status || '').toLowerCase();
  const getCurrentEmail = () => (window.MOCK && window.S && MOCK[S.key] && MOCK[S.key].user && MOCK[S.key].user.email) || 'member@dotis.ai';
  const trustSamples = {
    'Animal Rescue PK': {verifiedOn:'12 Oct 2026', latestUpdate:'3 Nov 2026', reports:2},
    'Global Food Network': {verifiedOn:'28 Sep 2026', latestUpdate:'2 Nov 2026', reports:3},
    'Hope Bridge': {verifiedOn:'4 Aug 2026', latestUpdate:'30 Oct 2026', reports:4},
    'Wildlife Corridor': {verifiedOn:'19 Sep 2026', latestUpdate:'27 Oct 2026', reports:2},
    'Clean Plate Initiative': {verifiedOn:'7 Oct 2026', latestUpdate:'1 Nov 2026', reports:1}
  };
  const demoUpdates = [
    {id:'sample-animal-update',type:'UPDATE',title:'Rescue kits delivered to the field team',source:'Animal Rescue PK',date:'3 Nov 2026',copy:'A sample update showing how a charity announcement will appear in your inbox.'},
    {id:'sample-animal-report',type:'REPORT',title:'October impact report published',source:'Animal Rescue PK',date:'1 Nov 2026',copy:'Open the charity profile to review its latest impact report.'},
    {id:'sample-animal-proof',type:'PROOF',title:'Delivery photos added',source:'Animal Rescue Drive 2026',date:'31 Oct 2026',copy:'A sample proof notification linked to a followed campaign.'},
    {id:'sample-hope-update',type:'UPDATE',title:'New school opened in Kisumu',source:'Back to School Kenya',date:'29 Oct 2026',copy:'A sample campaign update for the inbox preview.'}
  ];
  let activeTab = 'saved';
  let editingCauses = false;
  const toast = message => window.showToast ? window.showToast(message) : window.toast ? window.toast(message) : console.info(message);
  let saveStatusTimer = null;
  let undoSaveTimer = null;

  function recoverPendingWrite() {
    const tx = read(KEY.pendingWrite, null);
    if (!tx || !Array.isArray(tx.entries)) return;
    try {
      tx.entries.forEach(entry => localStorage.setItem(entry.key, JSON.stringify(entry.value)));
      localStorage.removeItem(KEY.pendingWrite);
    } catch (_) { /* The next page load will retry the saved transaction. */ }
  }
  recoverPendingWrite();

  function recipientKey(item) { return item.type + ':' + item.id; }
  function recipientRecords() {
    const keys = read(KEY.recipients, ['charity:Animal Rescue PK']);
    return (Array.isArray(keys) ? keys : []).map(key => {
      const text = String(key), split = text.indexOf(':'), type = text.slice(0, split), id = text.slice(split + 1);
      if (type === 'charity') {
        const charity = (window.CHARITIES || []).find(item => item.name === id);
        return charity ? {type:'charity',id:charity.name,name:charity.name,cause:charity.cause||'Other',city:charity.city||'',country:charity.country||charity.loc||'',verified:!!charity.verified} : null;
      }
      const campaign = (window.CAMPAIGNS || []).find(item => item.slug === id);
      return campaign ? {type:'campaign',id:campaign.slug,name:campaign.name,cause:campaign.cause||'Campaign',city:campaign.city||'',country:campaign.country||'',verified:window.getCampaignState?!!getCampaignState(campaign).running:statusText(campaign)==='approved'} : null;
    }).filter(Boolean);
  }
  function savedItems() { const items = read(KEY.saved, []); return Array.isArray(items) ? items : []; }
  function selectedRecipientKeys() {
    const active=window.S&&Array.isArray(S.selectedRecipients)?S.selectedRecipients:null,stored=read(KEY.recipients,[]);
    return active|| (Array.isArray(stored)?stored:[]);
  }
  function saveItem(item) {
    const items = savedItems(), previous = items.slice(), key = recipientKey(item), exists = items.some(saved => recipientKey(saved) === key);
    if (exists) write(KEY.saved, items.filter(saved => recipientKey(saved) !== key));
    else {
      const stored = Object.assign({},item); delete stored.campaign; delete stored.score; delete stored.matchReason;
      items.unshift(Object.assign(stored, {savedAt:new Date().toISOString()}));
      write(KEY.saved, items);
    }
    refreshFeatures();
    syncSaveButtons();
    showSaveUndo(exists ? 'Removed from saved items' : 'Saved for later', () => { write(KEY.saved,previous); refreshFeatures(); syncSaveButtons(); });
  }
  function showSaveUndo(message,undo) {
    let toast=document.getElementById('di-save-toast');
    if(!toast){toast=document.createElement('div');toast.id='di-save-toast';toast.className='di-save-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.hidden=true;document.body.appendChild(toast);}
    if(undoSaveTimer)clearTimeout(undoSaveTimer);
    toast.innerHTML='<span>'+esc(message)+'</span><button type="button">Undo</button>';toast.hidden=false;
    requestAnimationFrame(()=>toast.classList.add('is-visible'));
    toast.querySelector('button').addEventListener('click',()=>{if(undoSaveTimer)clearTimeout(undoSaveTimer);undo();toast.classList.remove('is-visible');toast.innerHTML='<span>Change undone</span>';undoSaveTimer=setTimeout(()=>{toast.hidden=true;},1800);});
    undoSaveTimer=setTimeout(()=>{toast.classList.remove('is-visible');undoSaveTimer=setTimeout(()=>{toast.hidden=true;},220);},5000);
  }
  function charityModel(name) { return (window.CHARITIES || []).find(item => item.name === name); }
  function campaignModel(slug) { return (window.CAMPAIGNS || []).find(item => item.slug === slug); }
  function modelForCard(type, name) {
    if (type === 'charity') {
      const item = charityModel(name);
      return item && {type:'charity',id:item.name,name:item.name,cause:item.cause||'Other',city:item.city||'',country:item.country||item.loc||'',verified:!!item.verified};
    }
    const item = (window.CAMPAIGNS || []).find(campaign => campaign.name === name);
    return item && {type:'campaign',id:item.slug||item.name,name:item.name,cause:'Campaign',city:item.city||'',country:item.country||'',verified:window.getCampaignState?!!getCampaignState(item).running:statusText(item)==='approved'};
  }
  function onCardAction(event) {
    const save = event.target.closest('[data-dotis-save]');
    const trust = event.target.closest('[data-dotis-trust]');
    if (save) {
      event.preventDefault(); event.stopPropagation();
      const item = JSON.parse(save.dataset.item || '{}');
      if (item.type && item.id) saveItem(item);
      return;
    }
    if (trust) {
      event.preventDefault(); event.stopPropagation();
      showTrust(JSON.parse(trust.dataset.item || '{}'));
    }
  }
  function actionButton(label, kind, item) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'di-card-action ' + (kind === 'trust' ? 'di-card-trust' : 'di-card-save');
    button.dataset[kind === 'trust' ? 'dotisTrust' : 'dotisSave'] = 'true';
    button.dataset.item = JSON.stringify(item);
    button.innerHTML = kind === 'save' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.7L6 21Z"/></svg><span>' + esc(label) + '</span>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg><span>Trust history</span>';
    const accessibleLabel = kind === 'save' ? (label === 'Saved' ? 'Remove from saved recipients' : 'Save for later') : 'View trust history';
    button.setAttribute('aria-label',accessibleLabel); button.title=accessibleLabel;
    button.setAttribute('aria-pressed', kind === 'save' ? String(label === 'Saved') : 'false');
    return button;
  }
  function upsertAction(actions,kind,item) {
    const key=recipientKey(item),isSaved=savedItems().some(saved=>recipientKey(saved)===key);
    let button=actions.querySelector(kind==='save'?'[data-dotis-save]':'[data-dotis-trust]');
    if(!button){button=actionButton(kind==='save'&&isSaved?'Saved':'Save for later',kind,item);actions.appendChild(button);return;}
    button.dataset.item=JSON.stringify(item);
    if(kind==='save'){const label=button.querySelector('span');if(label&&label.textContent!==(isSaved?'Saved':'Save for later'))label.textContent=isSaved?'Saved':'Save for later';button.classList.toggle('is-saved',isSaved);button.setAttribute('aria-pressed',String(isSaved));}
  }
  function decorateCards() {
    document.querySelectorAll('#charity-grid .charity-card').forEach(card => {
      const name = card.querySelector('.charity-name')?.textContent.trim(), item = name && modelForCard('charity',name);
      if (!item) return;
      let actions = card.querySelector('.di-card-actions');
      if (!actions) { actions = document.createElement('div'); actions.className = 'di-card-actions'; const body = card.querySelector('.charity-body'); if (body) body.appendChild(actions); }
      upsertAction(actions,'save',item); upsertAction(actions,'trust',item);
    });
    document.querySelectorAll('#camp-list .camp-item,#camp-overview-list .camp-item').forEach(card => {
      const name = card.querySelector('.camp-name')?.textContent.trim(), item = name && modelForCard('campaign',name);
      if (!item) return;
      let actions = card.querySelector('.di-card-actions');
      if (!actions) { actions = document.createElement('div'); actions.className = 'di-card-actions di-campaign-card-actions'; card.appendChild(actions); }
      upsertAction(actions,'save',item); upsertAction(actions,'trust',item);
      if (card.classList.contains('camp-overview-item')) {
        actions.classList.add('di-overview-icon-actions');
        actions.querySelectorAll('.di-card-action').forEach(button => {
          button.classList.add('di-icon-action');
          const kind = button.hasAttribute('data-dotis-save') ? 'save' : 'trust';
          const label = kind === 'save' ? (button.classList.contains('is-saved') ? 'Remove from saved recipients' : 'Save for later') : 'View trust history';
          button.setAttribute('aria-label',label); button.title=label;
        });
      }
    });
  }
  function syncSaveButtons() {
    document.querySelectorAll('[data-dotis-save]').forEach(button => {
      try {
        const item = JSON.parse(button.dataset.item || '{}'), saved = savedItems().some(entry => recipientKey(entry) === recipientKey(item));
        button.classList.toggle('is-saved',saved);
        const label = button.querySelector('span'); if (label) label.textContent = saved ? 'Saved' : 'Save for later';
        const accessibleLabel = saved ? 'Remove from saved recipients' : 'Save for later';
        button.setAttribute('aria-pressed',String(saved)); button.setAttribute('aria-label',accessibleLabel); button.title=accessibleLabel;
      } catch (_) {}
    });
  }

  function addFeaturePage() {
    const nav = document.querySelector('.sb-nav'), main = document.querySelector('.main');
    if (!nav || !main || document.getElementById('page-dotis-hub')) return;
    const section = document.createElement('div'); section.className = 'sb-section'; section.textContent = 'Your giving';
    const button = document.createElement('button'); button.className = 'sb-link'; button.type = 'button'; button.dataset.dotisPage = 'true'; button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 5.5v15M8 7h8m-8 4h8"/></svg>My Causes <span class="sb-badge" id="di-unread-count">0</span>'; button.onclick = () => window.goPage('dotis-hub',button);
    const campaignGroup = Array.from(nav.querySelectorAll('.sb-section')).find(el => el.textContent.trim() === 'Campaigns');
    if (campaignGroup) campaignGroup.insertAdjacentElement('beforebegin', section);
    else nav.appendChild(section);
    section.insertAdjacentElement('afterend',button);
    const host = document.createElement('div'); host.id = 'page-dotis-hub'; host.className = 'page-content di-page'; host.style.display = 'none';
    const anchor = document.getElementById('page-settings');
    if (anchor) anchor.insertAdjacentElement('afterend',host); else main.appendChild(host);
    const originalGoPage = window.goPage;
    if (originalGoPage && !originalGoPage.__dotisHubWrapped) {
      const wrapped = function (id, btn) {
        const feature = document.getElementById('page-dotis-hub');
        if (id === 'dotis-hub') {
          document.querySelectorAll('.page-content').forEach(page => { page.style.display = 'none'; });
          feature.style.display = 'block';
          document.querySelectorAll('.sb-link').forEach(link => link.classList.remove('active'));
          if (btn) btn.classList.add('active');
          const crumb = document.getElementById('tb-breadcrumb'); if (crumb) crumb.textContent = 'My Causes';
          window.scrollTo({top:0,behavior:'smooth'}); renderHub(); return;
        }
        if (feature) feature.style.display = 'none';
        return originalGoPage.apply(this,arguments);
      };
      wrapped.__dotisHubWrapped = true; window.goPage = wrapped;
    }
  }
  function setTab(tab) {
    if (tab === 'discovery') tab = 'saved';
    activeTab = tab;
    document.querySelectorAll('[data-di-tab]').forEach(button => { const active = button.dataset.diTab === tab; button.classList.toggle('is-active',active); button.setAttribute('aria-selected',String(active)); });
    document.querySelectorAll('[data-di-panel]').forEach(panel => { panel.hidden = panel.dataset.diPanel !== tab; });
    renderHubContent();
  }
  function renderHub() {
    const host = document.getElementById('page-dotis-hub'); if (!host) return;
    host.innerHTML = '<header class="di-page-head"><div><span class="di-eyebrow">YOUR GIVING</span><h1>My Causes</h1><p>Manage saved recipients, monthly preferences and updates.</p></div></header><nav class="di-tabs" role="tablist" aria-label="My giving sections"><button data-di-tab="saved" role="tab">Saved <span id="di-saved-count">0</span></button><button data-di-tab="fallback" role="tab">Fallback</button><button data-di-tab="updates" role="tab">Updates <span id="di-updates-tab-count">0</span></button><button data-di-tab="trust" role="tab">Trust</button></nav><section class="di-panel" data-di-panel="saved"></section><section class="di-panel" data-di-panel="fallback" hidden></section><section class="di-panel" data-di-panel="updates" hidden></section><section class="di-panel" data-di-panel="trust" hidden></section>';
    host.querySelectorAll('[data-di-tab]').forEach(button => button.addEventListener('click',() => setTab(button.dataset.diTab)));
    setTab(activeTab);
  }
  function renderHubContent() {
    const panel = document.querySelector('[data-di-panel="'+activeTab+'"]'); if (!panel) return;
    if (activeTab === 'saved') renderSaved(panel);
    if (activeTab === 'fallback') renderFallback(panel);
    if (activeTab === 'updates') renderInbox(panel);
    if (activeTab === 'trust') renderTrustDirectory(panel);
    const savedCount = document.getElementById('di-saved-count'); if (savedCount) savedCount.textContent = String(savedItems().length);
  }
  function renderSaved(panel) {
    const items = savedItems();
    const rows = items.map(item => {
      const included=selectedRecipientKeys().includes(recipientKey(item));
      const location=[item.city,item.country].filter(Boolean).join(', ');
      return '<article class="di-shortlist-row"><div class="di-shortlist-info"><span class="di-type-label">'+(item.type==='campaign'?'Campaign':'Verified charity')+'</span><h3>'+esc(item.name)+'</h3><p>'+esc([item.cause,location].filter(Boolean).join(' · ')||'Recipient details')+'</p></div><div class="di-shortlist-actions">'+(item.verified?(included?'<span class="di-in-split-label">In monthly split</span>':'<button type="button" class="di-outline-action" data-add-split="'+esc(JSON.stringify(item))+'">Add to split</button>'):'')+'<button type="button" class="di-text-action" data-remove-saved="'+esc(recipientKey(item))+'">Remove</button></div></article>';
    }).join('');
    const splitCount=selectedRecipientKeys().length;
    panel.innerHTML = '<div class="di-section-head"><div><span class="di-eyebrow">SAVED RECIPIENTS</span><h2>Your shortlist</h2><p>Keep options here, then add up to five recipients to your equal monthly split.</p></div><span class="di-count-pill">'+splitCount+' / 5 in monthly split</span></div>'+(items.length ? '<div class="di-shortlist-list">'+rows+'</div>' : '<div class="di-empty di-empty-inline"><div class="di-empty-copy"><h3>No saved recipients yet</h3><p>Save a charity or campaign to keep it handy and add it to your split when you’re ready.</p></div><button type="button" class="di-outline-action" data-open-charities>Browse charities</button></div>')+recommendationsMarkup(3,null,'saved');
    panel.querySelectorAll('[data-remove-saved]').forEach(button => button.addEventListener('click',() => { const key=button.dataset.removeSaved;write(KEY.saved,savedItems().filter(item=>recipientKey(item)!==key));refreshFeatures();renderHubContent();syncSaveButtons(); }));
    panel.querySelectorAll('[data-add-split]').forEach(button => button.addEventListener('click',() => addToMonthlySplit(JSON.parse(button.dataset.addSplit))));
    panel.querySelector('[data-open-charities]')?.addEventListener('click',() => document.querySelector('.sb-link[onclick*="charities"]')?.click());
    bindRecommendationActions(panel);
  }
  function causePreferences() {
    let causes = read(KEY.causes, null);
    if (!Array.isArray(causes)) {
      causes = recipientRecords().map(item => item.cause).filter(Boolean);
      if (!causes.length) causes = ['Animal Rescue'];
      write(KEY.causes,causes);
    }
    return causes;
  }
  function recommendationItems(limit, contextCause) {
    const interests=causePreferences(), dismissedItems=read(KEY.dismissed,[]), dismissed=new Set(Array.isArray(dismissedItems)?dismissedItems:[]), selected=new Set(selectedRecipientKeys()), saved=new Set(savedItems().map(recipientKey));
    const activeCauses=contextCause&&contextCause!=='All'?[contextCause]:interests;
    const reference=recipientRecords().find(item=>item.city||item.country), referenceCity=String(reference&&reference.city||'').toLowerCase(), referenceCountry=String(reference&&reference.country||'').toLowerCase();
    const candidates=[], seen=new Set();
    const add=item=>{
      const key=recipientKey(item);if(seen.has(key)||selected.has(key)||saved.has(key)||dismissed.has(key))return;seen.add(key);
      let score=activeCauses.includes(item.cause)?10:0;
      const city=String(item.city||'').toLowerCase(),country=String(item.country||'').toLowerCase();
      const sameCity=!!(referenceCity&&city&&referenceCity===city),sameCountry=!!(referenceCountry&&country&&referenceCountry===country);
      if(sameCity)score+=5;
      else if(sameCountry)score+=3;
      const reasons=[];
      if(activeCauses.includes(item.cause))reasons.push('Matches '+item.cause);
      if(sameCity)reasons.push('Same city as a selected recipient');
      else if(sameCountry)reasons.push('Same country as a selected recipient');
      if(!reasons.length)reasons.push('Verified and currently active');
      candidates.push(Object.assign({},item,{score,matchReason:reasons.join(' · ')}));
    };
    (window.CHARITIES||[]).filter(item=>item.verified&&(!activeCauses.length||activeCauses.includes(item.cause))).forEach(item=>add({type:'charity',id:item.name,name:item.name,cause:item.cause||'Other',city:item.city||'',country:item.country||item.loc||'',verified:true}));
    (window.CAMPAIGNS||[]).filter(item=>window.getCampaignState?getCampaignState(item).running:statusText(item)==='approved').forEach(item=>{
      const charity=charityModel(item.charity);if(!charity||!charity.verified)return;
      const cause=charity.cause||'Other';if(activeCauses.length&&!activeCauses.includes(cause))return;
      add({type:'campaign',id:item.slug||item.name,name:item.name,cause,city:item.city||charity.city||'',country:item.country||charity.country||charity.loc||'',verified:true});
    });
    return candidates.sort((a,b)=>b.score-a.score).slice(0,limit);
  }
  function recommendationsMarkup(limit, contextCause, placement) {
    const items=recommendationItems(limit,contextCause), causes=Array.from(new Set((window.CHARITIES||[]).map(item=>item.cause).filter(Boolean))).sort(), interests=causePreferences(), splitCount=selectedRecipientKeys().length, isSaved=placement==='saved';
    const rows=items.map(item=>{
      const location=[item.city,item.country].filter(Boolean).join(', '),json=esc(JSON.stringify(item));
      return '<article class="di-recommend-row"><div class="di-recommend-info"><span class="di-type-label">'+(item.type==='campaign'?'Active campaign':'Verified charity')+'</span><h3>'+esc(item.name)+'</h3><p>'+esc([item.cause,location].filter(Boolean).join(' · '))+'</p><span class="di-match-reason">'+esc(item.matchReason)+'</span></div><div class="di-recommend-actions"><button type="button" class="di-primary-action" data-add-recommendation="'+json+'" '+(splitCount>=5?'disabled':'')+'>'+(splitCount>=5?'Split full':'Add to split')+'</button><button type="button" class="di-outline-action" data-save-recommendation="'+json+'">Save</button><button type="button" class="di-recommend-dismiss" data-dismiss-recommendation="'+esc(recipientKey(item))+'" aria-label="Hide '+esc(item.name)+'" title="Hide suggestion">×</button></div></article>';
    }).join('');
    const title=isSaved?'Recommended for your causes':'Suggested for this category',copy=isSaved?'Matched to your interests and selected recipients.':'Verified options in this cause.';
    const interestPicker=isSaved?'<div class="di-interest-picker" data-interest-picker '+(editingCauses?'':'hidden')+'><p>Choose causes to shape your recommendations.</p><div class="di-cause-chips is-editing">'+causes.map(cause=>'<button type="button" class="di-cause-chip '+(interests.includes(cause)?'is-selected':'')+'" data-cause="'+esc(cause)+'" aria-pressed="'+String(interests.includes(cause))+'">'+esc(cause)+'</button>').join('')+'</div></div>':'';
    const empty=items.length?'<div class="di-recommend-list">'+rows+'</div>':'<div class="di-recommend-empty">You’re all caught up with these matches. Browse the full directory or adjust your interests.</div>';
    return '<section class="di-recommend-section '+(isSaved?'':'di-recommend-section-context')+'"><div class="di-recommend-head"><div><span class="di-eyebrow">'+(isSaved?'BASED ON YOUR INTERESTS':'MATCHED TO YOUR FILTER')+'</span><h2>'+title+'</h2><p>'+copy+'</p></div>'+(isSaved?'<button type="button" class="di-text-action di-tune-interests" data-toggle-interests aria-expanded="'+String(editingCauses)+'">'+(editingCauses?'Done':'Tune interests')+'</button>':'')+'</div>'+interestPicker+empty+(isSaved&&!items.length?'<button type="button" class="di-text-action" data-reset-dismissed>Restore hidden suggestions</button>':'')+'</section>';
  }
  function renderCharityRecommendations() {
    const host=document.getElementById('di-charity-recommendations');if(!host)return;
    const cause=window.S&&S.categoryFilter||'All';
    if(!recommendationItems(1,cause).length){host.hidden=true;host.innerHTML='';return;}
    host.hidden=false;host.innerHTML=recommendationsMarkup(2,cause,'finder');bindRecommendationActions(host);
  }
  function addToMonthlySplit(item) {
    if(!item||!item.type||!item.id)return;
    const key=recipientKey(item),list=selectedRecipientKeys();
    if(list.includes(key)){toast('This recipient is already in your monthly split.');return;}
    if(list.length>=5){toast('You can choose up to five donation recipients. Remove one before adding another.');return;}
    if(item.type==='charity'&&window.chooseCharity){const index=(window.CHARITIES||[]).findIndex(charity=>charity.name===item.id);if(index<0){toast('This charity is no longer available.');return;}window.chooseCharity(index);}
    else if(item.type==='campaign'&&window.toggleCampaignRecipient)window.toggleCampaignRecipient(item.id);
    else{list.push(key);write(KEY.recipients,list);if(window.renderCharities)window.renderCharities();if(window.renderCampaigns)window.renderCampaigns();if(window.renderDonationRequestCard)window.renderDonationRequestCard();toast('Added to your equal monthly split.');}
    refreshFeatures();syncSaveButtons();renderCharityRecommendations();
  }
  function bindRecommendationActions(root) {
    root.querySelector('[data-toggle-interests]')?.addEventListener('click',()=>{editingCauses=!editingCauses;renderHubContent();});
    root.querySelectorAll('[data-cause]').forEach(button=>button.addEventListener('click',()=>{
      const next=causePreferences(),value=button.dataset.cause;write(KEY.causes,next.includes(value)?next.filter(item=>item!==value):next.concat(value));
      renderHubContent();renderCharityRecommendations();
    }));
    root.querySelectorAll('[data-add-recommendation]').forEach(button=>button.addEventListener('click',()=>addToMonthlySplit(JSON.parse(button.dataset.addRecommendation))));
    root.querySelectorAll('[data-save-recommendation]').forEach(button=>button.addEventListener('click',()=>{
      saveItem(JSON.parse(button.dataset.saveRecommendation));renderHubContent();renderCharityRecommendations();
    }));
    root.querySelectorAll('[data-dismiss-recommendation]').forEach(button=>button.addEventListener('click',()=>{
      const stored=read(KEY.dismissed,[]),hidden=Array.isArray(stored)?stored:[];hidden.push(button.dataset.dismissRecommendation);write(KEY.dismissed,Array.from(new Set(hidden)));
      renderHubContent();renderCharityRecommendations();
    }));
    root.querySelector('[data-reset-dismissed]')?.addEventListener('click',()=>{write(KEY.dismissed,[]);renderHubContent();renderCharityRecommendations();});
  }
  function renderFallback(panel) {
    const saved=read(KEY.fallback,{}),verified=(window.CHARITIES||[]).filter(item=>item.verified);
    const choices=[['notify','Notify me','I’ll choose a replacement after Dotis tells me.'],['hold','Hold my points','Keep my share on hold until I choose.'],['backup','Use my backup charity','Use the backup charity I choose below.']];
    panel.innerHTML='<div class="di-section-head"><div><span class="di-eyebrow">YOU ARE IN CONTROL</span><h2>Choose a fallback preference</h2><p>Set what should happen if a selected campaign closes or a recipient becomes ineligible.</p></div><span class="di-lock-pill"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Never reassigned silently</span></div><div class="di-fallback-layout"><div class="di-choice-list">'+choices.map(([value,title,copy])=>'<label class="di-choice-card '+(saved.mode===value?'is-selected':'')+'"><input type="radio" name="di-fallback" value="'+value+'" '+(saved.mode===value?'checked':'')+'><span class="di-choice-check"></span><span class="di-choice-copy"><strong>'+title+'</strong><small>'+copy+'</small></span></label>').join('')+'</div><aside class="di-backup-card"><span class="di-eyebrow">BACKUP CHARITY</span><label for="di-backup-charity">Only used when you select this option</label><select id="di-backup-charity">'+verified.map(item=>'<option value="'+esc(item.name)+'" '+(saved.backup===item.name?'selected':'')+'>'+esc(item.name)+'</option>').join('')+'</select><p>Your saved preference is the only instruction Dotis can use for a closed campaign or ineligible recipient.</p></aside></div><div class="di-fallback-footer"><span id="di-fallback-saved">'+(saved.mode?'Saved preference: '+esc(choices.find(item=>item[0]===saved.mode)?.[1]||''):'No fallback preference saved yet.')+'</span><button type="button" class="di-primary-action" data-save-fallback>Save preference</button></div>';
    panel.querySelectorAll('[name="di-fallback"]').forEach(input=>input.addEventListener('change',()=>{panel.querySelectorAll('.di-choice-card').forEach(card=>card.classList.toggle('is-selected',card.contains(panel.querySelector(':checked'))));}));
    panel.querySelector('[data-save-fallback]')?.addEventListener('click',()=>{const mode=panel.querySelector('[name="di-fallback"]:checked')?.value;if(!mode){toast('Choose how you want Dotis to handle a closed recipient.');return;}const backup=panel.querySelector('#di-backup-charity').value;if(mode==='backup'&&!backup){toast('Choose a verified backup charity.');return;}if(!write(KEY.fallback,{mode,backup,updatedAt:new Date().toISOString()})){toast('Could not save this preference in browser storage.');return;}renderFallback(panel);toast('Your fallback preference has been saved.');});
  }
  function followedNames() {
    const names=new Set();recipientRecords().forEach(item=>{names.add(item.name);if(item.type==='charity')(window.CAMPAIGNS||[]).filter(campaign=>campaign.charity===item.name).forEach(campaign=>names.add(campaign.name));});
    savedItems().forEach(item=>names.add(item.name));
    return names;
  }
  function userSpecificUpdates() {
    const mine = read(KEY.apps,[]).filter(item=>item.ownerEmail===getCurrentEmail()).map(item=>({application:item,type:'Campaign'}))
      .concat(read(KEY.charityApps,[]).filter(item=>item.ownerEmail===getCurrentEmail()).map(item=>({application:item,type:'Charity'})));
    return mine.flatMap(({application,type})=>{
      const history=Array.isArray(application.statusHistory)?application.statusHistory:[];
      const last=history[history.length-1];
      return last && ['Changes Requested','Approved','Rejected','In Review'].includes(last.status) ? [{id:'review-'+application.id+'-'+history.length,type:'REVIEW',title:type+' review: '+last.status,source:application.name,date:last.at?new Date(last.at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Recently',copy:last.note||last.reason||'Your '+type.toLowerCase()+' submission status has been updated.'}] : [];
    });
  }
  function allocationAttentionItems() {
    const exceptions=read(KEY.exceptions,[]), selected=new Set(selectedRecipientKeys());
    return (Array.isArray(exceptions)?exceptions:[]).filter(item=>item&&!item.resolved&&selected.has(item.recipientKey))
      .map(item=>({id:'exception-'+item.id,type:'UPDATE',title:'Choose what happens to your share',source:item.recipient||'Selected recipient',date:item.createdAt?new Date(item.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Recently',copy:'This recipient is unavailable. Its share remains on hold until you choose a replacement or save your hold preference.',actionRequired:true,recipientKey:item.recipientKey}));
  }
  function campaignGoalUpdates(followed) {
    return (window.CAMPAIGNS||[]).filter(campaign=>followed.has(campaign.name)&&(window.getCampaignState?getCampaignState(campaign).running:statusText(campaign)==='approved'))
      .map(campaign=>{const raised=Number(campaign.pointsRaised||campaign.raised)||0,target=Number(campaign.pointsTarget||campaign.target)||0,progress=target?Math.round(raised/target*100):0;return {campaign,progress};})
      .filter(entry=>entry.progress>=80)
      .map(({campaign,progress})=>({id:'goal-'+(campaign.slug||campaign.name),type:'UPDATE',title:progress>=100?'Campaign reached its points goal':'Campaign is close to its points goal',source:campaign.name,date:'Current',copy:progress+'% of its points goal has been reached.',campaignSlug:campaign.slug,goalNudge:true}));
  }
  function notificationItems() {
    const followed=followedNames(), ownUpdates=userSpecificUpdates(), savedUpdates=read(KEY.inbox,[]);
    const items=demoUpdates.filter(item=>followed.has(item.source)).concat(ownUpdates,Array.isArray(savedUpdates)?savedUpdates:[],campaignGoalUpdates(followed),allocationAttentionItems());
    const unique=new Map();items.forEach(item=>{if(item&&item.id)unique.set(item.id,item);});
    return Array.from(unique.values()).sort((a,b)=>(new Date(b.date).getTime()||0)-(new Date(a.date).getTime()||0));
  }
  function openCausesTab(tab) {
    const navButton=document.querySelector('[data-dotis-page="true"]');
    if(window.goPage)window.goPage('dotis-hub',navButton);
    setTab(tab);
  }
  function closeNotificationPopover(restoreFocus) {
    const popover=document.getElementById('di-notification-popover'),trigger=document.getElementById('di-notification-trigger');
    if(popover)popover.hidden=true;
    if(trigger)trigger.setAttribute('aria-expanded','false');
    if(restoreFocus&&trigger)trigger.focus();
  }
  function refreshGlobalNotifications() {
    const updates=notificationItems(),readIds=read(KEY.inboxRead,[]),unread=updates.filter(item=>!readIds.includes(item.id)).length;
    const bell=document.getElementById('di-notification-trigger'),badge=document.getElementById('di-global-unread-count'),summary=document.getElementById('di-notification-summary'),preview=document.getElementById('di-notification-preview'),markAll=document.getElementById('di-mark-all-read');
    const savedButton=document.getElementById('di-saved-shortcut'),savedBadge=document.getElementById('di-saved-global-count'),savedCount=savedItems().length;
    if(bell){bell.setAttribute('aria-label',unread?'Notifications, '+unread+' unread':'Notifications');bell.title=unread?'Notifications, '+unread+' unread':'Notifications';}
    if(badge){badge.textContent=unread>99?'99+':String(unread);badge.hidden=unread===0;}
    if(summary)summary.textContent=unread+' unread';
    if(markAll)markAll.disabled=unread===0;
    if(savedButton){savedButton.setAttribute('aria-label',savedCount?'Saved items, '+savedCount:'Saved items');savedButton.title=savedCount?savedCount+' saved items':'Saved items';}
    if(savedBadge){savedBadge.textContent=savedCount>99?'99+':String(savedCount);savedBadge.hidden=savedCount===0;}
    if(!preview)return;
    preview.innerHTML=updates.length?updates.slice(0,4).map(item=>'<button type="button" class="di-notification-item '+(readIds.includes(item.id)?'':'is-unread')+'" data-open-notification="'+esc(item.id)+'" aria-label="Open update: '+esc(item.title)+'"><span class="di-notification-dot" aria-hidden="true"></span><span class="di-notification-copy"><strong>'+esc(item.title)+'</strong><small>'+esc(item.source)+' · '+esc(item.date)+'</small></span></button>').join(''):'<div class="di-notification-empty">Updates from charities and campaigns you follow will appear here.</div>';
    preview.querySelectorAll('[data-open-notification]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.openNotification,list=read(KEY.inboxRead,[]);if(!list.includes(id)){list.push(id);write(KEY.inboxRead,Array.from(new Set(list)));}closeNotificationPopover(false);openCausesTab('updates');}));
  }
  function renderInbox(panel) {
    const updates=notificationItems();
    const readIds=read(KEY.inboxRead,[]), unread=updates.filter(item=>!readIds.includes(item.id)).length;
    const count=document.getElementById('di-updates-tab-count'); if(count)count.textContent=String(unread);
    const navCount=document.getElementById('di-unread-count');if(navCount)navCount.textContent=String(unread);
    const fallback=read(KEY.fallback,{});
    panel.innerHTML='<div class="di-section-head"><div><span class="di-eyebrow">ONE PLACE FOR WHAT IS NEW</span><h2>Updates inbox</h2><p>News, reports, proof and review updates from the things you follow.</p></div><span class="di-count-pill">'+unread+' unread</span></div><div class="di-inbox-toolbar"><div class="di-inbox-filters" role="group" aria-label="Filter updates"><button class="is-active" data-inbox-filter="all">All</button><button data-inbox-filter="UPDATE">Updates</button><button data-inbox-filter="REPORT">Reports</button><button data-inbox-filter="PROOF">Proof</button><button data-inbox-filter="REVIEW">Review</button></div><span class="di-sample-note">Sample feed · example updates</span></div><div class="di-inbox-list">'+(updates.length?updates.map(item=>{const isRead=readIds.includes(item.id),actions=item.actionRequired?'<div class="di-inbox-actions"><button type="button" class="di-inline-action" data-exception-replace="'+esc(item.recipientKey)+'">Choose replacement</button><button type="button" class="di-inline-action" data-exception-hold="'+esc(item.recipientKey)+'" '+(fallback.mode==='hold'?'disabled':'')+'>'+(fallback.mode==='hold'?'Hold preference saved':'Set hold preference')+'</button></div>':item.goalNudge?'<div class="di-inbox-actions"><button type="button" class="di-inline-action" data-view-campaign="'+esc(item.campaignSlug)+'">View campaign</button></div>':item.type==='PROOF'?'<div class="di-inbox-actions"><button type="button" class="di-inline-action" data-view-proof>View donation history</button></div>':'';return '<article class="di-inbox-item '+(isRead?'is-read':'')+(item.actionRequired?' is-action-required':'')+'" data-inbox-type="'+esc(item.type)+'"><div class="di-inbox-marker di-marker-'+esc(item.type.toLowerCase())+'">'+(item.actionRequired?'!':item.type==='REPORT'?'↗':item.type==='PROOF'?'✓':item.type==='REVIEW'?'◷':'✦')+'</div><div class="di-inbox-copy"><div class="di-inbox-meta"><span>'+(item.actionRequired?'ACTION NEEDED':esc(item.type))+'</span><time>'+esc(item.date)+'</time></div><h3>'+esc(item.title)+'</h3><p>'+esc(item.source)+' · '+esc(item.copy)+'</p>'+actions+'</div><button type="button" class="di-mark-read" data-mark-read="'+esc(item.id)+'">'+(isRead?'Read':'Mark read')+'</button></article>';}).join(''):'<div class="di-empty"><div class="di-empty-icon">✧</div><h3>No updates yet</h3><p>Save or select a charity or campaign and its updates will appear here.</p><button type="button" class="di-outline-action" data-open-charities>Find a charity</button></div>')+'</div>';
    panel.querySelectorAll('[data-inbox-filter]').forEach(button=>button.addEventListener('click',()=>{panel.querySelectorAll('[data-inbox-filter]').forEach(item=>item.classList.toggle('is-active',item===button));const filter=button.dataset.inboxFilter;panel.querySelectorAll('.di-inbox-item').forEach(item=>item.hidden=filter!=='all'&&item.dataset.inboxType!==filter);}));
    panel.querySelectorAll('[data-mark-read]').forEach(button=>button.addEventListener('click',()=>{const list=read(KEY.inboxRead,[]);list.push(button.dataset.markRead);write(KEY.inboxRead,Array.from(new Set(list)));refreshFeatures();}));
    panel.querySelectorAll('[data-exception-replace]').forEach(button=>button.addEventListener('click',()=>{if(window.startDotisRecipientReplacement)window.startDotisRecipientReplacement(button.dataset.exceptionReplace);}));
    panel.querySelectorAll('[data-exception-hold]').forEach(button=>button.addEventListener('click',()=>{const saved=read(KEY.fallback,{});if(saved.mode==='hold')return;if(!write(KEY.fallback,{mode:'hold',backup:saved.backup||'',updatedAt:new Date().toISOString()})){toast('Could not save your hold preference.');return;}const readValue=read(KEY.inboxRead,[]),ids=Array.isArray(readValue)?readValue:[],noticeId=button.closest('.di-inbox-item')?.querySelector('[data-mark-read]')?.dataset.markRead;if(noticeId)ids.push(noticeId);write(KEY.inboxRead,Array.from(new Set(ids)));toast('Hold preference saved. Dotis will keep shares for unavailable recipients on hold instead of reassigning them.');refreshFeatures();}));
    panel.querySelectorAll('[data-view-campaign]').forEach(button=>button.addEventListener('click',()=>{if(window.goPage)window.goPage('campaigns',null);}));
    panel.querySelectorAll('[data-view-proof]').forEach(button=>button.addEventListener('click',()=>{if(window.goPage)window.goPage('history',null);}));
    panel.querySelector('[data-open-charities]')?.addEventListener('click',()=>document.querySelector('.sb-link[onclick*="charities"]')?.click());
    refreshGlobalNotifications();
  }
  function trustInfo(item) {
    if (item.type === 'campaign') {
      const campaign=campaignModel(item.id)||item.campaign, charity=campaign&&charityModel(campaign.charity), profile=charity&&trustSamples[charity.name];
      return {status:charity&&charity.verified?'Verified supporting charity':'Verification pending',verifiedOn:profile?profile.verifiedOn:'Not yet verified',latestUpdate:campaign&&campaign.latestUpdate||'29 Oct 2026',reports:Number(campaign&&campaign.reports)||1,source:charity?charity.name:'Supporting charity'};
    }
    const charity=charityModel(item.id),profile=trustSamples[item.name]||{};
    return {status:charity&&charity.verified?'Verified':'Verification pending',verifiedOn:charity&&charity.verified?(charity.verifiedOn||profile.verifiedOn||'Date not provided'):'Not verified',latestUpdate:charity&&(charity.latestUpdate||profile.latestUpdate)||'Not provided',reports:Number(charity&&charity.reports)||Number(profile.reports)||0,source:item.name};
  }
  function showTrust(item) {
    const info=trustInfo(item),modal=document.createElement('div');
    modal.className='di-trust-overlay';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','di-trust-title');
    modal.innerHTML='<section class="di-trust-modal"><button type="button" class="di-modal-close" aria-label="Close trust history">×</button><span class="di-eyebrow">TRANSPARENCY RECORD</span><h2 id="di-trust-title">'+esc(item.name)+'</h2><p class="di-trust-subtitle">A snapshot of verification and reporting activity for this profile.</p><span class="di-trust-status '+(info.status==='Verified'||info.status==='Verified supporting charity'?'is-verified':'is-pending')+'"><i></i>'+esc(info.status)+'</span><div class="di-trust-facts"><div><span>Verified on</span><strong>'+esc(info.verifiedOn)+'</strong></div><div><span>Latest update</span><strong>'+esc(info.latestUpdate)+'</strong></div><div><span>Reports available</span><strong>'+info.reports+'</strong></div><div><span>Profile</span><strong>'+esc(info.source)+'</strong></div></div><div class="di-trust-foot"><span>Demo profile data</span><p>In the live service, these details should come from the verified profile record.</p></div></section>';
    const close=()=>{modal.remove();document.documentElement.classList.remove('dotis-dialog-open');document.removeEventListener('keydown',closeOnEscape);};
    const closeOnEscape=event=>{if(event.key==='Escape')close();};
    modal.addEventListener('click',event=>{if(event.target===modal||event.target.closest('.di-modal-close'))close();});
    document.documentElement.classList.add('dotis-dialog-open');document.addEventListener('keydown',closeOnEscape);
    document.body.appendChild(modal);
  }
  function renderTrustDirectory(panel) {
    const entities=[];
    (window.CHARITIES||[]).forEach(charity=>entities.push({type:'charity',id:charity.name,name:charity.name,cause:charity.cause||'Other',country:charity.country||charity.loc||'',verified:!!charity.verified}));
    (window.CAMPAIGNS||[]).filter(campaign=>window.getCampaignState?getCampaignState(campaign).running:statusText(campaign)==='approved').forEach(campaign=>entities.push({type:'campaign',id:campaign.slug,name:campaign.name,cause:'Campaign',country:campaign.country||'',verified:true}));
    panel.innerHTML='<div class="di-section-head"><div><span class="di-eyebrow">TRUST, AT A GLANCE</span><h2>Profiles with a history</h2><p>Check verification, the latest update and available reports before choosing a recipient.</p></div><span class="di-sample-note">Sample profile data</span></div><div class="di-trust-grid">'+entities.map(item=>{const info=trustInfo(item);return '<article class="di-trust-card"><div class="di-trust-card-head"><span class="di-trust-status '+(info.status.includes('Verified')?'is-verified':'is-pending')+'"><i></i>'+esc(info.status)+'</span><span class="di-type-pill">'+(item.type==='campaign'?'Campaign':'Charity')+'</span></div><h3>'+esc(item.name)+'</h3><p>'+esc([item.cause,item.country].filter(Boolean).join(' · '))+'</p><div class="di-trust-mini"><span>Verified <strong>'+esc(info.verifiedOn)+'</strong></span><span>Latest update <strong>'+esc(info.latestUpdate)+'</strong></span><span>Reports <strong>'+info.reports+'</strong></span></div><button type="button" class="di-outline-action" data-open-trust>View trust history <span aria-hidden="true">↗</span></button></article>';}).join('')+'</div>';
    panel.querySelectorAll('[data-open-trust]').forEach((button,index)=>button.addEventListener('click',()=>showTrust(entities[index])));
  }
  function refreshFeatures() {
    const navCount=document.getElementById('di-unread-count'),tabCount=document.getElementById('di-updates-tab-count'),updates=notificationItems(),readIds=read(KEY.inboxRead,[]),count=updates.filter(item=>!readIds.includes(item.id)).length;
    if(navCount)navCount.textContent=String(count);if(tabCount)tabCount.textContent=String(count);
    refreshGlobalNotifications();
    if (document.getElementById('page-dotis-hub')?.style.display !== 'none') renderHubContent();
  }
  function installWideScreenAndFeatureStyles() {
    if (document.getElementById('dotis-extra-user-styles')) return;
    const style=document.createElement('style');style.id='dotis-extra-user-styles';style.textContent=`
      @media(min-width:1440px){html{zoom:1.1}}@media(min-width:1920px){html{zoom:1.15}}@media(min-width:2560px){html{zoom:1.2}}
      .di-global-shortcuts{display:flex;align-items:center;gap:6px}
      .di-global-shortcut{position:relative;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex:0 0 36px;padding:0;border:1px solid var(--border-mid);border-radius:var(--r-md);background:var(--surface);color:var(--ink-70);cursor:pointer;transition:border-color .18s,background .18s,color .18s}
      .di-global-shortcut:hover,.di-global-shortcut[aria-expanded="true"]{border-color:var(--flare);color:var(--ink)}
      .di-global-shortcut svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .di-global-shortcut#di-saved-shortcut svg{fill:none}
      .di-global-count{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;padding:0 4px;display:grid;place-items:center;border:2px solid var(--paper);border-radius:99px;background:var(--flare);color:#fff;font:700 8px/1 var(--font-b)}
      .di-global-count[hidden]{display:none}
      .di-notification-wrap{position:relative}
      .di-notification-popover{position:absolute;top:calc(100% + 12px);right:0;z-index:120;width:min(380px,calc(100vw - 24px));overflow:hidden;border:1px solid var(--border);border-radius:14px;background:var(--surface);box-shadow:0 18px 55px rgba(16,12,10,.2);color:var(--ink)}
      .di-notification-popover[hidden]{display:none!important}
      .di-notification-popover-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid var(--border)}
      .di-notification-popover-head h2{margin:0;color:var(--ink);font:600 16px/1.2 var(--font-b)}
      .di-notification-popover-head span{display:block;margin-top:4px;color:var(--ink-50);font:11px var(--font-b)}
      .di-notification-popover-head button,.di-notification-view-all{padding:5px 0;border:0;background:transparent;color:var(--flare);font:600 11px var(--font-b);cursor:pointer;white-space:nowrap}
      .di-notification-popover-head button:disabled{color:var(--ink-30);cursor:default}
      .di-notification-preview{display:grid;max-height:min(340px,55vh);overflow-y:auto;overscroll-behavior:contain}
      .di-notification-item{display:grid;grid-template-columns:8px minmax(0,1fr);align-items:start;gap:10px;width:100%;padding:12px 16px;border:0;border-bottom:1px solid var(--border);background:transparent;color:var(--ink);text-align:left;cursor:pointer}
      .di-notification-item:hover{background:var(--paper)}
      .di-notification-dot{width:7px;height:7px;margin-top:5px;border-radius:50%;background:transparent}
      .di-notification-item.is-unread .di-notification-dot{background:var(--flare)}
      .di-notification-copy{display:grid;gap:4px;min-width:0}
      .di-notification-copy strong{overflow:hidden;color:var(--ink);font:600 12px/1.35 var(--font-b);text-overflow:ellipsis;white-space:nowrap}
      .di-notification-copy small{overflow:hidden;color:var(--ink-50);font:10px/1.35 var(--font-b);text-overflow:ellipsis;white-space:nowrap}
      .di-notification-empty{padding:22px 16px;color:var(--ink-50);font:12px/1.5 var(--font-b)}
      .di-notification-view-all{display:flex;align-items:center;justify-content:space-between;width:100%;padding:13px 16px;border-top:1px solid var(--border)}
      .di-notification-view-all:hover{text-decoration:underline;text-underline-offset:3px}
      .di-save-toast{position:fixed;z-index:12000;left:50%;bottom:22px;display:flex;align-items:center;gap:20px;max-width:calc(100vw - 24px);padding:10px 13px 10px 16px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:var(--brand-ink);color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.2);font:12px var(--font-b);opacity:0;pointer-events:none;transform:translate(-50%,16px);transition:opacity .2s,transform .2s}
      .di-save-toast[hidden]{display:none}
      .di-save-toast.is-visible{opacity:1;pointer-events:auto;transform:translate(-50%,0)}
      .di-save-toast button{padding:4px 2px;border:0;background:transparent;color:#ff9b8d;font:700 11px var(--font-b);cursor:pointer}
      .di-save-toast button:hover{text-decoration:underline;text-underline-offset:3px}
      @media(max-width:560px){.di-global-shortcut{width:33px;height:33px;flex-basis:33px}.di-notification-popover{right:-40px}.di-notification-popover-head{padding:13px}.di-notification-item{padding:11px 13px}.di-notification-view-all{padding:12px 13px}.di-save-toast{bottom:14px;gap:12px;width:calc(100vw - 24px);justify-content:space-between}}
      @media(max-width:380px){.topbar{padding:0 12px}.topbar-right{gap:5px}.topbar .btn-ink{width:36px;height:36px;padding:0;justify-content:center}.topbar .btn-ink .rl{gap:0;font-size:0;letter-spacing:0}.topbar .btn-ink .rl svg{width:16px;height:16px}}
      .di-page{max-width:1500px!important;margin-inline:auto;padding-bottom:52px!important}
      .di-page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:0 0 24px;padding:8px 0 22px;border-bottom:1px solid var(--border)}
      .di-eyebrow{display:block;color:var(--ink-50);font:700 9px/1.4 var(--font-s);letter-spacing:.2em;text-transform:uppercase}
      .di-page-head h1{margin:8px 0 7px;color:var(--ink);font:600 clamp(27px,2.4vw,38px)/1.05 var(--font-d);letter-spacing:-.045em}
      .di-page-head p,.di-section-head p{max-width:680px;margin:0;color:var(--ink-50);font-size:13px;line-height:1.65}
      .di-demo-pill,.di-count-pill,.di-lock-pill{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;border:1px solid var(--border);border-radius:999px;background:var(--surface);padding:9px 13px;color:var(--ink-70);font:600 10px var(--font-s)}
      .di-demo-pill i,.di-saved-state i,.di-trust-status i{width:7px;height:7px;border-radius:50%;background:var(--leaf);box-shadow:0 0 0 4px var(--green-dim)}
      .di-tabs{display:flex;gap:6px;overflow:auto;padding:5px;border:1px solid var(--border);border-radius:16px;background:var(--surface-soft)}
      .di-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 16px;border:0;border-radius:11px;background:transparent;color:var(--ink-50);font:600 11px var(--font-s);white-space:nowrap;cursor:pointer}
      .di-tabs button.is-active{background:var(--ink);color:var(--paper);box-shadow:0 5px 14px rgba(16,12,10,.11)}
      .di-tabs button span{display:grid;place-items:center;min-width:19px;height:19px;padding:0 5px;border-radius:99px;background:rgba(16,12,10,.08);font:600 9px var(--font-s)}.di-tabs button.is-active span{background:rgba(255,255,255,.16)}
      .di-panel{padding-top:24px}.di-panel[hidden]{display:none}
      .di-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin:0 0 18px}.di-section-head h2{margin:7px 0 6px;font:600 clamp(21px,1.7vw,28px)/1.15 var(--font-d);letter-spacing:-.035em;color:var(--ink)}
      .di-shortlist-grid,.di-recommend-grid,.di-trust-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .di-shortlist-card,.di-recommend-card,.di-trust-card{min-width:0;overflow:hidden;border:1px solid var(--border);border-radius:19px;background:var(--surface);box-shadow:0 9px 28px rgba(16,12,10,.045)}
      .di-card-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .di-type-pill{display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:999px;padding:5px 8px;color:var(--ink-50);font:700 8px var(--font-s);letter-spacing:.08em;text-transform:uppercase}
      .di-text-action{border:0!important;background:transparent!important;color:var(--ink-50)!important;padding:6px 4px!important;font:600 10px var(--font-s)!important;cursor:pointer}.di-text-action:hover{color:var(--flare)!important}
      .di-trust-card h3{margin:14px 0 5px;color:var(--ink);font:600 17px/1.25 var(--font-d);letter-spacing:-.025em}
      .di-trust-card>p{margin:0;color:var(--ink-50);font-size:11px;line-height:1.55}
      .di-card-action{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:31px;padding:0 9px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--ink-50);font:600 8px var(--font-s);cursor:pointer;transition:border-color .18s,color .18s,background .18s}.di-card-action:hover,.di-card-action.is-saved{border-color:rgba(225,38,18,.3);background:var(--flare-dim);color:var(--flare)}.di-card-action svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.di-card-actions{justify-content:flex-start!important;margin-top:10px}.di-icon-action{position:relative;width:30px;height:30px;min-height:30px;flex:0 0 30px;padding:0;border-color:transparent;background:transparent;color:var(--ink-50)}.di-icon-action:hover,.di-icon-action.is-saved{border-color:transparent;background:var(--flare-dim);color:var(--flare)}.di-icon-action svg{width:14px;height:14px}.di-icon-action span{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.di-overview-icon-actions{margin:0!important}.di-campaign-card-actions{margin:0 0 0 8px;flex-direction:column;align-items:flex-end}.di-in-split-label{display:inline-flex;align-items:center;gap:6px;color:var(--leaf);font:600 9px var(--font-s)}.di-in-split-label i{width:6px;height:6px;border-radius:50%;background:var(--leaf)}.di-outline-action,.di-primary-action{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:37px;padding:0 13px;border:1px solid var(--border-mid);border-radius:999px;background:transparent;color:var(--ink);font:600 10px var(--font-s);text-decoration:none;cursor:pointer;transition:transform .18s,border-color .18s,background .18s}
      .di-outline-action:hover{border-color:var(--flare);background:var(--flare-dim)}.di-primary-action{border-color:var(--flare);background:var(--flare);color:#fff;box-shadow:0 8px 18px -13px var(--flare)}.di-primary-action:hover{transform:translateY(-1px);background:#c92313}
      .di-empty{display:grid;justify-items:center;gap:9px;padding:55px 24px;border:1px dashed var(--border-mid);border-radius:19px;background:var(--surface);text-align:center}.di-empty-wide{grid-column:1/-1}.di-empty-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:16px;background:var(--flare-dim);color:var(--flare);font-size:23px}.di-empty h3{margin:3px 0 0;color:var(--ink);font:600 18px var(--font-d)}.di-empty p{max-width:440px;margin:0;color:var(--ink-50);font-size:11px;line-height:1.6}
      .di-cause-chips{display:flex;flex-wrap:wrap;gap:8px;margin:-4px 0 20px}.di-cause-chip{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 11px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--ink-50);font:600 10px var(--font-s);cursor:pointer}.di-cause-chip span{font-size:12px}.di-cause-chips:not(.is-editing) .di-cause-chip:not(.is-selected){display:none}.di-cause-chip.is-selected{border-color:rgba(225,38,18,.24);background:var(--flare-dim);color:var(--flare)}.di-cause-chips.is-editing .di-cause-chip{display:inline-flex}
      .di-fallback-layout{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}.di-choice-list{display:grid;gap:10px}.di-choice-card{display:flex;align-items:center;gap:12px;min-height:76px;padding:12px 15px;border:1px solid var(--border);border-radius:15px;background:var(--surface);cursor:pointer;transition:border .18s,background .18s}.di-choice-card.is-selected{border-color:rgba(225,38,18,.42);background:var(--flare-dim)}.di-choice-card input{position:absolute;opacity:0;pointer-events:none}.di-choice-check{display:grid;place-items:center;width:20px;height:20px;flex:0 0 20px;border:1px solid var(--border-mid);border-radius:50%;background:var(--surface)}.di-choice-card.is-selected .di-choice-check{border:6px solid var(--flare)}.di-choice-copy{display:grid;gap:4px}.di-choice-copy strong{color:var(--ink);font:600 14px/1.3 var(--font-b)}.di-choice-copy small{color:var(--ink-50);font-size:10px;line-height:1.45}
      .di-lock-pill svg{width:14px;height:14px;fill:none;stroke:var(--leaf);stroke-width:1.8}.di-backup-card{padding:18px;border:1px solid var(--border);border-radius:16px;background:linear-gradient(145deg,var(--surface-soft),var(--surface))}.di-backup-card label{display:block;margin:12px 0 8px;color:var(--ink-70);font-size:11px}.di-backup-card select{width:100%;min-height:42px;padding:0 12px;border:1px solid var(--border-mid);border-radius:11px;background:var(--surface);color:var(--ink);font:500 13px var(--font-b)}.di-backup-card p{margin:12px 0 0;color:var(--ink-50);font-size:10px;line-height:1.55}.di-fallback-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:16px;padding:13px 15px;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--ink-50);font-size:10px}
      .di-inbox-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.di-inbox-filters{display:flex;gap:5px;flex-wrap:wrap}.di-inbox-filters button{min-height:31px;padding:0 11px;border:1px solid transparent;border-radius:999px;background:transparent;color:var(--ink-50);font:600 9px var(--font-s);cursor:pointer}.di-inbox-filters button.is-active{border-color:var(--border);background:var(--surface);color:var(--ink)}.di-sample-note{color:var(--ink-30);font:8px var(--font-s);letter-spacing:.08em;text-transform:uppercase}
      .di-inbox-list{display:grid;gap:9px}.di-inbox-item{display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:14px;padding:16px;border:1px solid var(--border);border-radius:15px;background:var(--surface);transition:opacity .15s}.di-inbox-item[hidden]{display:none}.di-inbox-item.is-read{opacity:.62}.di-inbox-marker{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--flare-dim);color:var(--flare);font-size:15px}.di-marker-report{background:rgba(54,92,142,.1);color:#365c8e}.di-marker-proof{background:var(--green-dim);color:var(--leaf)}.di-marker-review{background:var(--amber-dim);color:var(--amber)}.di-inbox-copy{min-width:0}.di-inbox-meta{display:flex;gap:10px;align-items:center;color:var(--ink-30);font:700 8px var(--font-s);letter-spacing:.12em}.di-inbox-meta span{color:var(--flare)}.di-inbox-meta time{letter-spacing:.02em}.di-inbox-copy h3{margin:5px 0 3px;color:var(--ink);font:600 13px var(--font-s)}.di-inbox-copy p{margin:0;color:var(--ink-50);font-size:10px;line-height:1.5}.di-mark-read{min-height:31px;padding:0 10px;border:1px solid var(--border);border-radius:999px;background:transparent;color:var(--ink-50);font:600 9px var(--font-s);cursor:pointer}
      .di-inbox-item.is-action-required{border-color:var(--flare-dim);background:linear-gradient(110deg,var(--flare-dim),var(--surface) 42%)}.di-inbox-item.is-action-required .di-inbox-marker{background:var(--flare);color:#fff;font:700 14px var(--font-b)}.di-inbox-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:9px}.di-inline-action{padding:0;border:0;background:transparent;color:var(--flare);font:600 10px var(--font-b);cursor:pointer}.di-inline-action:hover{text-decoration:underline;text-underline-offset:3px}.di-inline-action:disabled{color:var(--leaf);cursor:default;text-decoration:none}
      .di-trust-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.di-trust-card{padding:17px}.di-trust-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.di-trust-status{display:inline-flex;align-items:center;gap:8px;color:var(--ink-70);font:600 9px var(--font-s)}.di-trust-status.is-verified{color:var(--leaf)}.di-trust-status.is-pending{color:var(--amber)}.di-trust-status.is-pending i{background:var(--amber);box-shadow:0 0 0 4px var(--amber-dim)}.di-trust-card h3{margin-top:16px}.di-trust-mini{display:grid;gap:8px;margin:15px 0;padding:13px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}.di-trust-mini span{display:flex;justify-content:space-between;gap:10px;color:var(--ink-50);font-size:9px}.di-trust-mini strong{color:var(--ink-70);font-weight:600;text-align:right}.di-trust-overlay{position:fixed;z-index:1200;inset:0;display:grid;place-items:center;padding:22px;background:rgba(16,12,10,.55);backdrop-filter:blur(9px)}.di-trust-modal{position:relative;width:min(560px,100%);max-height:92vh;overflow:auto;scrollbar-width:none;-ms-overflow-style:none;padding:30px;border:1px solid var(--border);border-radius:24px;background:var(--surface);box-shadow:0 28px 85px rgba(0,0,0,.25)}.di-trust-modal::-webkit-scrollbar{display:none;width:0;height:0}.di-modal-close{position:absolute;top:18px;right:18px;width:36px;height:36px;border:1px solid var(--border);border-radius:50%;background:transparent;color:var(--ink);font-size:22px;cursor:pointer}.di-trust-modal h2{margin:9px 40px 6px 0;color:var(--ink);font:600 27px/1.15 var(--font-d)}.di-trust-subtitle{margin:0 0 16px;color:var(--ink-50);font-size:11px;line-height:1.55}.di-trust-facts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.di-trust-facts div{display:grid;gap:7px;padding:14px;border:1px solid var(--border);border-radius:13px;background:var(--surface-soft)}.di-trust-facts span{color:var(--ink-50);font:700 8px var(--font-s);letter-spacing:.12em;text-transform:uppercase}.di-trust-facts strong{color:var(--ink);font:600 12px var(--font-s)}.di-trust-foot{padding-top:14px;border-top:1px solid var(--border)}.di-trust-foot span{color:var(--amber);font:700 8px var(--font-s);letter-spacing:.12em;text-transform:uppercase}.di-trust-foot p{margin:6px 0 0;color:var(--ink-50);font-size:10px;line-height:1.5}
      @media(max-width:900px){.di-trust-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.di-page-head{align-items:flex-start;flex-direction:column}.di-fallback-layout{grid-template-columns:1fr}}
      @media(max-width:600px){.di-tabs{margin-inline:-3px}.di-tabs button{padding-inline:11px}.di-shortlist-grid,.di-recommend-grid,.di-trust-grid{grid-template-columns:1fr}.di-shortlist-card,.di-recommend-card{grid-template-columns:100px minmax(0,1fr)}.di-shortlist-content,.di-recommend-body{padding:13px}.di-shortlist-content h3,.di-recommend-body h3{font-size:15px}.di-inbox-item{grid-template-columns:34px minmax(0,1fr);gap:10px;padding:12px}.di-inbox-marker{width:32px;height:32px}.di-mark-read{grid-column:2;justify-self:start}.di-inbox-toolbar,.di-section-head{align-items:flex-start;flex-direction:column}.di-fallback-footer{align-items:flex-start;flex-direction:column}.di-trust-facts{grid-template-columns:1fr 1fr}.di-trust-modal{padding:24px 18px}.di-campaign-card-actions{gap:3px}.di-card-actions{flex-wrap:wrap}}
      .di-page{font-family:var(--font-b)}
      .di-page-head{align-items:center;margin-bottom:18px;padding:5px 0 16px}
      .di-page-head h1{font:clamp(27px,2.4vw,38px)/1.05 var(--font-d);letter-spacing:0}
      .di-page-head p,.di-section-head p{font:13px/1.5 var(--font-b)}
      .di-tabs{gap:3px;padding:4px;border-radius:10px;background:var(--surface)}
      .di-tabs button{min-height:38px;padding:0 14px;border-radius:7px;font:500 12px var(--font-b);transition:background .2s,color .2s}
      .di-tabs button.is-active{background:var(--ink);color:#fff;box-shadow:none}
      html[data-theme="dark"] .di-tabs button.is-active{background:var(--flare);color:#fff}
      .di-tabs button span{min-width:18px;height:18px;padding:0 4px;border-radius:4px;background:var(--ink-08);font:10px var(--font-s)}
      .di-tabs button.is-active span{background:rgba(255,255,255,.16)}
      .di-panel{padding-top:20px}
      .di-section-head{align-items:center;margin-bottom:14px;gap:14px}
      .di-section-head h2{font:clamp(19px,1.5vw,25px)/1.15 var(--font-d);letter-spacing:0}
      .di-section-head p{font-size:12px}
      .di-shortlist-list,.di-recommend-list{display:grid;overflow:hidden;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
      .di-shortlist-row,.di-recommend-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;padding:15px 18px;border-bottom:1px solid var(--border)}
      .di-shortlist-row:last-child,.di-recommend-row:last-child{border-bottom:0}
      .di-shortlist-info,.di-recommend-row>div:first-child{min-width:0}
      .di-type-label{display:block;margin-bottom:4px;color:var(--ink-50);font:10px/1.4 var(--font-s);letter-spacing:.07em;text-transform:uppercase}
      .di-shortlist-row h3,.di-recommend-row h3{margin:0 0 3px;color:var(--ink);font:600 15px/1.3 var(--font-b)}
      .di-shortlist-row p,.di-recommend-row p{margin:0;color:var(--ink-50);font:12px/1.45 var(--font-b)}
      .di-match-reason{display:inline-flex;align-items:center;margin-top:7px;padding:4px 7px;border:1px solid var(--border);border-radius:5px;color:var(--leaf);font:9px/1.2 var(--font-b)}
      .di-shortlist-actions,.di-recommend-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;white-space:nowrap}
      .di-in-split-label{font:500 11px var(--font-b)}
      .di-outline-action,.di-primary-action{position:relative;isolation:isolate;overflow:hidden;min-height:36px;padding:0 13px;border-radius:8px;font:500 12px var(--font-b);box-shadow:none;transform:none;transition:color .2s,border-color .2s,background .2s,box-shadow .25s}
      .di-outline-action{background:var(--surface);color:var(--ink-70)}
      .di-primary-action{background:var(--flare);color:#fff}
      .di-outline-action::before,.di-primary-action::before{position:absolute;z-index:-1;content:"";left:-12%;right:-12%;top:calc(100% - 2px);height:190%;background:var(--brand-ink);border-radius:50% 50% 0 0 / 16% 16% 0 0;transition:transform .55s cubic-bezier(.65,0,.35,1),border-radius .55s cubic-bezier(.65,0,.35,1)}
      .di-outline-action:hover,.di-primary-action:hover{transform:translateY(-1px);border-color:var(--brand-ink);background:var(--flare);color:#fff;box-shadow:0 10px 28px -10px rgba(16,12,10,.38)}
      .di-outline-action:hover::before,.di-primary-action:hover::before{transform:translateY(-62%);border-radius:50% 50% 0 0 / 5% 5% 0 0}
      .di-outline-action:focus-visible,.di-primary-action:focus-visible{outline:3px solid var(--flare-dim);outline-offset:2px}
      .di-text-action{font:500 12px var(--font-b)!important;text-decoration:underline;text-underline-offset:3px}
      .di-empty{padding:30px 20px;border-style:solid;border-radius:10px;text-align:left;justify-items:start}
      .di-empty h3{font:600 15px var(--font-b)}.di-empty p{font:12px/1.5 var(--font-b);text-align:left}
      .di-cause-chips{gap:7px;margin:0 0 14px}
      .di-cause-chip{min-height:32px;padding:0 11px;border-radius:7px;background:var(--surface);font:12px var(--font-b)}
      .di-cause-chip.is-selected{border-color:var(--ink);background:var(--ink);color:#fff}
      html[data-theme="dark"] .di-cause-chip{color:var(--ink-70);border-color:var(--border-mid)}
      html[data-theme="dark"] .di-cause-chip.is-selected{border-color:var(--flare);background:var(--flare);color:#fff}
      .di-recommend-section{margin-top:22px;padding-top:18px;border-top:1px solid var(--border)}
      .di-recommend-section-context{margin:12px 0 18px;padding:16px;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
      .di-recommend-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:11px}
      .di-recommend-head h2{margin:4px 0 4px;color:var(--ink);font:600 clamp(17px,1.3vw,20px)/1.2 var(--font-d)}
      .di-recommend-head p{margin:0;color:var(--ink-50);font:12px/1.5 var(--font-b)}
      .di-recommend-actions{gap:7px}
      .di-recommend-actions .di-primary-action,.di-recommend-actions .di-outline-action{min-height:32px;padding:0 10px;font-size:11px}
      .di-recommend-dismiss{width:30px;height:30px;flex:0 0 30px;padding:0;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--ink-50);font:20px/1 var(--font-b);cursor:pointer;transition:color .18s,border-color .18s,background .18s}
      .di-recommend-dismiss:hover{border-color:var(--flare-dim);background:var(--flare-dim);color:var(--flare)}
      .di-recommend-actions .di-primary-action:disabled{opacity:.48;cursor:not-allowed;transform:none}
      .di-interest-picker{margin:-2px 0 12px;padding:12px;border:1px solid var(--border);border-radius:9px;background:var(--surface-soft)}
      .di-interest-picker[hidden]{display:none!important}.di-interest-picker p{margin:0 0 9px;color:var(--ink-50);font:11px var(--font-b)}
      .di-interest-picker .di-cause-chips{margin:0}
      .di-recommend-empty{padding:14px;border:1px dashed var(--border-mid);border-radius:9px;color:var(--ink-50);font:12px/1.5 var(--font-b)}
      .di-empty-inline{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:18px;padding:18px 20px;margin-bottom:2px;border-style:solid;border-radius:10px;text-align:left}
      .di-empty-inline .di-empty-copy{min-width:0}.di-empty-inline h3{margin:0 0 5px}.di-empty-inline p{max-width:62ch;margin:0}.di-empty-inline>.di-outline-action{flex:0 0 auto;white-space:nowrap}
      @media(max-width:840px){.di-recommend-row{grid-template-columns:minmax(0,1fr);align-items:start;gap:12px;padding:16px 18px}.di-recommend-actions{width:100%;justify-content:flex-start}.di-recommend-dismiss{margin-left:auto}}
      .di-context-recommendations[hidden]{display:none!important}
      .di-inbox-filters button{border-radius:7px;font:12px var(--font-b)}
      .di-inbox-item{border-radius:10px}.di-inbox-copy h3{font:600 13px var(--font-b)}
      .di-trust-card{border-radius:10px;box-shadow:none}.di-trust-card h3{font:600 15px var(--font-b);letter-spacing:0}.di-trust-modal{border-radius:14px}.di-trust-modal h2{font:26px/1.15 var(--font-d)}
      .di-lock-pill,.di-count-pill{border-radius:8px;font:12px var(--font-b)}
      @media(max-width:600px){.di-shortlist-row,.di-recommend-row{grid-template-columns:1fr;align-items:start;gap:11px;padding:14px}.di-shortlist-actions,.di-recommend-actions{justify-content:flex-start;flex-wrap:wrap}.di-page-head{gap:8px}.di-page-head p{font-size:12px}.di-tabs{overflow-x:auto}.di-tabs button{padding-inline:11px}}
      @media(max-width:600px){.di-recommend-section{margin-top:18px;padding-top:15px}.di-recommend-section-context{padding:12px}.di-recommend-head{align-items:flex-start;flex-direction:column;gap:8px}.di-empty-inline{grid-template-columns:1fr;align-items:start;gap:12px;padding:16px}.di-empty-inline>.di-outline-action{justify-self:start}.di-recommend-actions{gap:6px}}
    `;document.head.appendChild(style);
  }

  function init() {
    recoverPendingWrite(); installWideScreenAndFeatureStyles(); addFeaturePage();
    document.addEventListener('click',onCardAction,true);
    const originalCharities=window.renderCharities, originalCampaigns=window.renderCampaigns;
    if (originalCharities && !originalCharities.__diDecorated) { const wrapped=function(){const result=originalCharities.apply(this,arguments);decorateCards();renderCharityRecommendations();return result;};wrapped.__diDecorated=true;window.renderCharities=wrapped; }
    if (originalCampaigns && !originalCampaigns.__diDecorated) { const wrapped=function(){const result=originalCampaigns.apply(this,arguments);decorateCards();return result;};wrapped.__diDecorated=true;window.renderCampaigns=wrapped; }
    decorateCards();renderCharityRecommendations();
    const savedShortcut=document.getElementById('di-saved-shortcut'),notificationTrigger=document.getElementById('di-notification-trigger'),notificationPopover=document.getElementById('di-notification-popover');
    savedShortcut?.addEventListener('click',()=>openCausesTab('saved'));
    notificationTrigger?.addEventListener('click',()=>{if(!notificationPopover)return;const opening=notificationPopover.hidden;notificationPopover.hidden=!opening;notificationTrigger.setAttribute('aria-expanded',String(opening));if(opening)refreshGlobalNotifications();});
    document.getElementById('di-mark-all-read')?.addEventListener('click',()=>{const ids=notificationItems().map(item=>item.id),all=read(KEY.inboxRead,[]);write(KEY.inboxRead,Array.from(new Set(all.concat(ids))));refreshFeatures();});
    document.getElementById('di-notification-view-all')?.addEventListener('click',()=>{closeNotificationPopover(false);openCausesTab('updates');});
    document.addEventListener('click',event=>{const wrap=document.querySelector('.di-notification-wrap');if(notificationPopover&&!notificationPopover.hidden&&wrap&&!wrap.contains(event.target))closeNotificationPopover(false);});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&notificationPopover&&!notificationPopover.hidden)closeNotificationPopover(true);});
    window.addEventListener('storage',event=>{if(!event.key||Object.values(KEY).includes(event.key)){recoverPendingWrite();decorateCards();refreshFeatures();}});
    if (window.MutationObserver) { const observer=new MutationObserver(()=>{ if(document.querySelector('#charity-grid .charity-card,#camp-list .camp-item')) decorateCards(); }); observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true}); }
    refreshFeatures();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
