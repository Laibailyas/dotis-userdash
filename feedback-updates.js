/* Dotis dashboard feedback updates. Front-end demo data is shared across the two dashboards on the same origin. */
(function () {
  'use strict';

  const KEYS = {
    recipients: 'dotis-demo-donation-recipients',
    applications: 'dotis-demo-campaign-applications',
    charityApplications: 'dotis-demo-charity-applications',
    pendingJoin: 'dotis-demo-pending-campaign-join',
    charityProfiles: 'dotis-demo-charity-profiles',
    campaigns: 'dotis-demo-campaign-profiles',
    exceptions: 'dotis-admin-allocation-exceptions',
    audit: 'dotis-admin-audit-history',
    pendingWrite: 'dotis-demo-pending-write',
    inbox: 'dotis-demo-updates-inbox',
    inboxRead: 'dotis-user-inbox-read'
  };
  const read = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value == null ? fallback : value; }
    catch (_) { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const safeText = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const currentUserEmail = () => (window.MOCK && MOCK[S.key] && MOCK[S.key].user && MOCK[S.key].user.email) || 'member@dotis.ai';
  let selectedRecipients = read(KEYS.recipients, ['charity:Animal Rescue PK']);
  if (!Array.isArray(selectedRecipients)) selectedRecipients = ['charity:Animal Rescue PK'];
  let countryFilter = 'all';
  let nearbyFirst = false;
  let userCoordinates = null;
  let replacementKey = '';

  function normalizeSharedData() {
    const sampleGeo={'Animal Rescue PK':['Islamabad',33.6844,73.0479],'Global Food Network':['Hamburg',53.5488,9.9872],'Flood Relief Fund':['Dhaka',23.8103,90.4125],'Hope Bridge':['Nairobi',-1.2921,36.8219],'Wildlife Corridor':['Arusha',-3.3869,36.6830],'Clean Plate Initiative':['Mumbai',19.0760,72.8777]};
    CHARITIES.forEach(item=>{const geo=sampleGeo[item.name];if(geo&&!item.city){item.city=geo[0];item.lat=geo[1];item.lon=geo[2];item.country=item.loc;}});
    const charityProfiles = read(KEYS.charityProfiles, []);
    if (Array.isArray(charityProfiles)) charityProfiles.forEach(profile => {
      if (!profile || !profile.name) return;
      const existing = CHARITIES.find(item => item.name === profile.name);
      if (existing) Object.assign(existing, profile);
      else if (profile.verified) CHARITIES.push(Object.assign({cause:'Other',desc:'A verified Dotis charity.',loc:profile.country || 'Global',verified:true,bg:'#E8DFC8',tc:'#100C0A'}, profile));
    });

    const campaigns = read(KEYS.campaigns, []);
    if (Array.isArray(campaigns)) campaigns.forEach(profile => {
      if (!profile || !profile.slug || !profile.name) return;
      const existing = CAMPAIGNS.find(item => item.slug === profile.slug);
      const state = String(profile.status || 'pending').toLowerCase();
      const mapped = Object.assign({}, profile, {status: state === 'approved' || state === 'active' ? 'approved' : state === 'rejected' ? 'rejected' : state === 'paused' ? 'paused' : state === 'completed' ? 'completed' : 'pending'});
      if (existing) Object.assign(existing, mapped);
      else CAMPAIGNS.push(mapped);
    });

    const applications = read(KEYS.applications, []);
    if (Array.isArray(applications)) applications.forEach(application => {
      if (!application || application.ownerEmail !== currentUserEmail()) return;
      const existing = CAMPAIGNS.find(item => item.slug === application.slug);
      const state = String(application.status || 'Pending').toLowerCase();
      const campaign = {
        name: application.name,
        charity: application.charity,
        status: state === 'approved' ? 'approved' : state === 'rejected' ? 'rejected' : 'pending',
        participants: Number(application.participants) || 0,
        pointsRaised: Number(application.pointsRaised) || 0,
        pointsTarget: Number(application.target) || 0,
        slug: application.slug,
        campaignBy: application.applicantName || currentUserEmail(),
        description: application.description || '',
        city: application.city || '',
        country: application.country || '',
        coverImage: application.coverImage || '',
        ownCampaign: true
      };
      if (existing) Object.assign(existing, campaign); else CAMPAIGNS.push(campaign);
    });

    selectedRecipients = selectedRecipients.filter(key => {
      const text=String(key),separator=text.indexOf(':'),type=text.slice(0,separator),value=text.slice(separator+1);
      return separator>0&&value.trim()!==''&&(type==='charity'||type==='campaign');
    }).slice(0, 5);
    persistRecipients();
    S.selectedRecipients = selectedRecipients;
    S.charity = firstActiveCharity() || (CHARITIES.find(item => item.verified) || {}).name || '';
  }

  function recipientDetails(key) {
    const [type, id] = String(key).split(':');
    if (type === 'charity') {
      const charity = CHARITIES.find(item => item.name === id && item.verified);
      return charity ? {key, type, name:charity.name, city:charity.city || '', country:charity.country || charity.loc || '', image:charity.image || ''} : null;
    }
    const campaign = CAMPAIGNS.find(item => item.slug === id && getCampaignState(item).running);
    return campaign ? {key, type, name:campaign.name, city:campaign.city || '', country:campaign.country || '', image:campaign.coverImage || ''} : null;
  }
  function allocationDetails(key) {
    const available=recipientDetails(key);if(available)return Object.assign({available:true,reason:''},available);
    const text=String(key),separator=text.indexOf(':'),type=text.slice(0,separator),id=text.slice(separator+1);
    if(type==='charity'){
      const charity=CHARITIES.find(item=>item.name===id);
      return {key,type,name:charity&&charity.name||id,city:charity&&charity.city||'',country:charity&&(charity.country||charity.loc)||'',available:false,reason:charity?(charity.status==='Rejected'?'Charity review was declined':charity.status==='Archived'?'Charity was archived':'Charity verification is no longer active'):'Charity is no longer listed'};
    }
    const campaign=CAMPAIGNS.find(item=>item.slug===id);
    return {key,type:'campaign',name:campaign&&campaign.name||id,city:campaign&&campaign.city||'',country:campaign&&campaign.country||'',available:false,reason:campaign?(campaign.status==='rejected'?'Campaign review was declined':campaign.status==='paused'?'Campaign is paused':campaign.status==='completed'?'Campaign is closed':'Campaign approval is no longer active'):'Campaign is no longer listed'};
  }
  function persistRecipients() {
    selectedRecipients = selectedRecipients.slice(0, 5);
    S.selectedRecipients = selectedRecipients;
    write(KEYS.recipients, selectedRecipients);
  }
  function firstActiveCharity(){return selectedRecipients.map(key=>String(key).startsWith('charity:')?String(key).slice(8):'').map(name=>CHARITIES.find(item=>item.name===name&&item.verified)).find(Boolean)?.name||'';}
  function writeSharedTransaction(entries) {
    const tx={id:'TX-USER-'+Date.now().toString(36),createdAt:new Date().toISOString(),entries};
    try{localStorage.setItem(KEYS.pendingWrite,JSON.stringify(tx));entries.forEach(entry=>localStorage.setItem(entry.key,JSON.stringify(entry.value)));localStorage.removeItem(KEYS.pendingWrite);return true;}
    catch(_){setToast('Your selection could not be saved. Please retry before leaving this page.');return false;}
  }
  function closeAllocationException(oldKey,newName,change,nextRecipients=selectedRecipients) {
    const exceptions=read(KEYS.exceptions,[]),open=exceptions.filter(item=>item.recipientKey===oldKey&&!item.resolved);
    if(!open.length)return [{key:KEYS.recipients,value:nextRecipients}];
    const now=new Date().toISOString();
    open.forEach(item=>{item.resolved=true;item.status='Resolved · user choice';item.resolution=change==='replace'?'replaced with '+newName:'removed from the monthly split';item.resolvedAt=now;});
    const audit=read(KEYS.audit,[]);open.forEach((item,index)=>audit.unshift({id:'AUD-USER-'+Date.now().toString(36)+'-'+index,actor:currentUserEmail(),at:now,entity:item.recipient,label:'allocation exception',what:change==='replace'?'User selected a replacement':'User removed unavailable recipient',reason:change==='replace'?'Replacement selected: '+newName:'User chose to remove this recipient from the monthly split'}));
    const readIds=read(KEYS.inboxRead,[]);open.forEach(item=>readIds.push('exception-'+item.id));
    return [{key:KEYS.recipients,value:nextRecipients},{key:KEYS.exceptions,value:exceptions},{key:KEYS.audit,value:audit.slice(0,300)},{key:KEYS.inboxRead,value:Array.from(new Set(readIds))}];
  }
  function equalShares(points, count) {
    if (!count) return [];
    const totalCents = Math.max(0, Math.round((Number(points) || 0) * 100));
    const baseCents = Math.floor(totalCents / count);
    const extraCents = totalCents % count;
    return Array.from({length: count}, (_, index) => (baseCents + (index < extraCents ? 1 : 0)) / 100);
  }
  function updateDialogLock() {
    document.documentElement.classList.toggle('dotis-dialog-open', !!document.querySelector('.dotis-modal-overlay.is-open'));
  }
  function nextAllocationLabel() {
    const now = new Date();
    return new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric'}).format(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }
  function publicUrl(slug) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('campaign', slug);
    const campaign = campaignBySlug(slug) || (window.__dotisSharedCampaign&&window.__dotisSharedCampaign.slug===slug?window.__dotisSharedCampaign:null);
    if (campaign && (getCampaignState(campaign).running || campaign.status==='approved')) {
      const details={name:campaign.name,charity:campaign.charity,description:campaign.description||'',city:campaign.city||'',country:campaign.country||'',target:Number(campaign.pointsTarget)||0,pointsRaised:Number(campaign.pointsRaised)||0,participants:Number(campaign.participants)||0,status:'approved',slug:campaign.slug};
      url.searchParams.set('campaignData',JSON.stringify(details));
    }
    return url.href;
  }
  function campaignBySlug(slug) { return CAMPAIGNS.find(item => item.slug === slug); }
  function selectedCampaignCount() { return selectedRecipients.filter(key => key.startsWith('campaign:')).length; }
  function selectedCharityCount() { return selectedRecipients.filter(key => key.startsWith('charity:')).length; }
  function setToast(message) { if (typeof window.showToast === 'function') window.showToast(message); else if (typeof window.toast === 'function') window.toast(message); }

  function injectControls() {
    const charityFilters = document.querySelector('#page-charities .charity-filters');
    if (charityFilters && !document.getElementById('charity-country-filter')) {
      charityFilters.insertAdjacentHTML('afterend', '<div class="dotis-charity-tools"><label for="charity-country-filter">Country</label><select id="charity-country-filter" aria-label="Filter charities by country"><option value="all">All countries</option></select><button type="button" id="charity-nearby-button" onclick="findNearbyCharities()">Find nearest</button><span id="charity-nearby-status" aria-live="polite">Choose up to 5 charities or campaigns. Selected recipients split donations equally.</span></div>');
      document.getElementById('charity-country-filter').addEventListener('change', event => { countryFilter = event.target.value; nearbyFirst = false; renderCharities(); });
    }
    const charityFormGrid = document.querySelector('#page-submit .form-grid');
    if (charityFormGrid && !document.getElementById('f-city')) {
      const country = document.getElementById('f-loc');
      if (country) { const cityWrap=document.createElement('div'); cityWrap.innerHTML='<label class="fl-label" for="f-city">City / town</label><input class="fl-input" id="f-city" placeholder="e.g. Lahore">'; country.closest('div').insertAdjacentElement('afterend',cityWrap); }
      const imageWrap=document.createElement('div'); imageWrap.className='form-full dotis-upload-field'; imageWrap.innerHTML='<label class="fl-label" for="f-charity-image">Charity header image</label><label class="dotis-file-picker"><span class="dotis-file-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 14v5h14v-5"/></svg></span><span class="dotis-file-copy"><strong>Choose an image</strong><small id="f-charity-image-name">No file selected</small></span><span class="dotis-file-action">Browse</span><input id="f-charity-image" type="file" accept="image/*" aria-label="Choose charity header image"></label><span class="dotis-form-help">JPG, PNG or WebP · up to 5 MB</span><div id="f-charity-image-preview" class="dotis-image-preview"></div>'; charityFormGrid.appendChild(imageWrap);
      document.getElementById('f-charity-image').addEventListener('change',async event=>{const input=event.target,file=input.files&&input.files[0],name=document.getElementById('f-charity-image-name');if(!file)return;if(!file.type.startsWith('image/')||file.size>5*1024*1024){setToast('Choose an image under 5 MB.');input.value='';if(name)name.textContent='No file selected';const preview=document.getElementById('f-charity-image-preview');if(preview){preview.innerHTML='';preview.dataset.image='';}return;}if(name)name.textContent=file.name;try{const data=await compressImage(file);document.getElementById('f-charity-image-preview').innerHTML='<img alt="Charity header preview" src="'+data+'">';document.getElementById('f-charity-image-preview').dataset.image=data;}catch(_){setToast('That image could not be loaded.');}});
    }
    const campaignHead = document.querySelector('#page-campaigns .pg-head');
    if (campaignHead && !document.getElementById('start-campaign-button')) {
      campaignHead.classList.add('dotis-campaign-page-head');
      campaignHead.insertAdjacentHTML('beforeend', '<button id="start-campaign-button" class="btn-flare" type="button" onclick="openCampaignSubmit()"><span class="rf" aria-hidden="true"></span><span class="rl">START A CAMPAIGN</span></button>');
    }
    if (!document.getElementById('dotis-campaign-submit-overlay')) document.body.insertAdjacentHTML('beforeend', '<div id="dotis-campaign-submit-overlay" class="dotis-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dotis-campaign-submit-title" onclick="if(event.target===this)closeCampaignSubmit()"><section class="dotis-modal"><header><div><span class="impact-lbl">CAMPAIGN APPLICATION</span><h2 id="dotis-campaign-submit-title">Start a campaign</h2></div><button type="button" aria-label="Close" onclick="closeCampaignSubmit()">&times;</button></header><form id="dotis-campaign-form" onsubmit="submitUserCampaign(event)"><div class="dotis-form-grid"><label>Campaign name<input name="name" maxlength="90" required placeholder="e.g. School kits for Kisumu"></label><label>Supporting verified charity<select name="charity" required></select></label><label>City<input name="city" maxlength="80" required placeholder="City"></label><label>Country<input name="country" maxlength="80" required placeholder="Country"></label><label>Points goal<input name="target" type="number" min="1" step="1" required value="2500"></label><label>Website or campaign page<input name="website" type="url" placeholder="https://"></label><label class="dotis-form-wide">Social profile<input name="social" type="url" placeholder="https://"></label><label class="dotis-form-wide">What will this campaign do?<textarea name="description" rows="4" required maxlength="900" placeholder="Describe who it supports and how the funds will be used."></textarea></label><div class="dotis-form-wide dotis-upload-field"><span class="dotis-upload-title">Campaign header image</span><label class="dotis-file-picker"><span class="dotis-file-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 14v5h14v-5"/></svg></span><span class="dotis-file-copy"><strong>Choose an image</strong><small id="user-campaign-image-name">No file selected</small></span><span class="dotis-file-action">Browse</span><input name="coverFile" type="file" accept="image/*" aria-label="Choose campaign header image"></label><span class="dotis-form-help">Optional · JPG, PNG or WebP · up to 5 MB</span></div><div class="dotis-form-wide dotis-image-preview" id="user-campaign-image-preview"></div><label class="dotis-terms-check dotis-form-wide"><input type="checkbox" name="terms" required><span>I confirm this campaign information is accurate and understand it must be approved before it can be shared publicly.</span></label></div><div class="dotis-modal-actions"><button type="button" class="btn-ghost" onclick="closeCampaignSubmit()">Cancel</button><button class="btn-flare" type="submit"><span class="rf" aria-hidden="true"></span><span class="rl">SUBMIT FOR REVIEW</span></button></div><p class="dotis-form-note">Approved campaigns receive a shareable public page. You can follow the review status under My Submissions.</p></form></section></div>');
    if (!document.getElementById('dotis-terms-overlay')) document.body.insertAdjacentHTML('beforeend', `<div id="dotis-terms-overlay" class="dotis-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dotis-terms-title" onclick="if(event.target===this)closeDotisTerms()"><section class="dotis-modal dotis-terms-modal"><header><div><span class="impact-lbl">DOTIS POINTS</span><h2 id="dotis-terms-title">Terms of use</h2></div><button type="button" aria-label="Close terms" onclick="closeDotisTerms()">&times;</button></header><div class="dotis-terms-copy"><h3>1. Accounts and eligibility</h3><p>You are responsible for keeping your sign-in details secure and for providing accurate account information. Keep your contact details current so Dotis can share important service and account updates.</p><h3>2. Points and monthly allocation</h3><p>Dotis Points are collected through the Dotis service for charitable giving. They are not cash, cannot be withdrawn, and cannot be transferred to another account.</p><p>At the end of each month, eligible points shown on your dashboard are allocated equally across the verified charities and approved campaigns you selected, up to five recipients. Your dashboard shows each recipient’s share and the month-end countdown. Any conversion, processing fee, final recipient, or payment timing follows the official Dotis terms.</p><h3>3. Charities and campaigns</h3><p>Charities must be verified and campaigns approved before they can receive allocations or be shared as active campaigns. Dotis may pause or remove a listing when its information needs review. A campaign page describes the organizer’s stated purpose and does not replace the charity’s own reporting.</p><h3>4. Submissions and campaign content</h3><p>Information and images you submit must be accurate, lawful, and suitable for public display. Dotis may review, decline, pause, or remove a submission when details are incomplete, misleading, or need further checks. Do not upload private information about another person without permission.</p><h3>5. Proof and reporting</h3><p>Donation and campaign updates depend on information supplied by participating charities and campaign organizers. A campaign page does not replace the charity’s own reporting. Uploaded proof should be genuine and related to the relevant contribution.</p><h3>6. Service changes and account action</h3><p>Dotis may update features, pause activity, or restrict an account when needed to protect the service, its users, or charitable recipients. See the published terms for details about service changes, complaints, and account closure.</p><p class="dotis-terms-links"><a href="https://dotis.ai/terms" target="_blank" rel="noopener noreferrer">Read the full terms on Dotis</a></p></div></section></div>`);
    if (!document.getElementById('dotis-privacy-overlay')) document.body.insertAdjacentHTML('beforeend', `<div id="dotis-privacy-overlay" class="dotis-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dotis-privacy-title" onclick="if(event.target===this)closeDotisPrivacy()"><section class="dotis-modal dotis-terms-modal"><header><div><span class="impact-lbl">YOUR INFORMATION</span><h2 id="dotis-privacy-title">Privacy notice</h2></div><button type="button" aria-label="Close privacy notice" onclick="closeDotisPrivacy()">&times;</button></header><div class="dotis-terms-copy"><h3>Information used by Dotis</h3><p>Dotis uses account details, charity and campaign submissions, and service activity needed to operate the dashboard, maintain account security, and record points and donations.</p><h3>Device and location information</h3><p>Device and network details may support service operation, security, and campaign participation records. If you choose “Find nearest,” your browser asks for location permission and this dashboard uses that location in your browser to order charities by distance. You can decline permission and filter by country instead.</p><h3>Profile visibility</h3><p>Showing your name on public rankings is optional and can be controlled in your profile. Use account settings to review available device and sharing controls.</p><h3>Questions and data rights</h3><p>For the current information about data handling, retention, and user rights, read the published Dotis privacy notice.</p><p class="dotis-terms-links"><a href="https://dotis.ai/privacy" target="_blank" rel="noopener noreferrer">Read the full privacy notice on Dotis</a></p></div></section></div>`);
    if (!document.getElementById('dotis-share-overlay')) document.body.insertAdjacentHTML('beforeend', `<div id="dotis-share-overlay" class="dotis-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dotis-share-title" onclick="if(event.target===this)closeCampaignShare()"><section class="dotis-modal dotis-share-modal"><header><div><span class="impact-lbl">PASS IT ON</span><h2 id="dotis-share-title">Share campaign</h2></div><button type="button" aria-label="Close share dialog" onclick="closeCampaignShare()">&times;</button></header><p class="dotis-share-intro" id="dotis-share-intro">Share this campaign with your community.</p><label class="dotis-share-link-label" for="dotis-share-url">Campaign link</label><div class="dotis-share-link-row"><input id="dotis-share-url" type="text" readonly aria-label="Campaign link"><button type="button" class="btn-flare" onclick="copyCampaignShareLink()"><span class="rf" aria-hidden="true"></span><span class="rl">COPY LINK</span></button></div><div class="dotis-social-share-grid"><a id="dotis-share-whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp</a><a id="dotis-share-facebook" target="_blank" rel="noopener noreferrer">Facebook</a><a id="dotis-share-linkedin" target="_blank" rel="noopener noreferrer">LinkedIn</a><a id="dotis-share-x" target="_blank" rel="noopener noreferrer">X</a><a id="dotis-share-email">Email</a><button id="dotis-native-share" type="button" onclick="nativeCampaignShare()">More options</button></div><p class="dotis-share-note">Anyone with the link can view this campaign page.</p></section></div>`);
    if (!document.getElementById('dotis-public-campaign')) document.body.insertAdjacentHTML('beforeend', '<main id="dotis-public-campaign" class="dotis-public-campaign" hidden></main>');
  }

  function fillCountryFilter() {
    const select = document.getElementById('charity-country-filter');
    if (!select) return;
    const current = select.value || countryFilter;
    const countries = Array.from(new Set(CHARITIES.map(item => item.country || item.loc).filter(Boolean))).sort((a,b) => a.localeCompare(b));
    select.innerHTML = '<option value="all">All countries</option>' + countries.map(country => '<option value="'+safeText(country)+'">'+safeText(country)+'</option>').join('');
    select.value = countries.includes(current) ? current : 'all';
    countryFilter = select.value;
  }

  function afterCharityRender() {
    fillCountryFilter();
    const grid = document.getElementById('charity-grid');
    if (!grid) return;
    const models = CHARITIES.filter(item => S.categoryFilter === 'All' || item.cause === S.categoryFilter);
    const cards = Array.from(grid.querySelectorAll('.charity-card'));
    cards.forEach((card, index) => {
      const model = models[index];
      if (!model) return;
      const country = model.country || model.loc || '';
      card.hidden = countryFilter !== 'all' && country !== countryFilter;
      const key = 'charity:' + model.name;
      const selected = selectedRecipients.includes(key);
      const button = card.querySelector('.charity-select');
      if (button && model.verified) {
        button.textContent = selected ? (replacementKey?'Already in monthly split':'Remove from monthly split') : (replacementKey?'Replace unavailable recipient':'Add to monthly split');
        button.setAttribute('aria-pressed', String(selected));
        button.classList.toggle('is-selected-recipient', selected);
        button.disabled=!!replacementKey&&selected;
      }
      const image = typeof model.image === 'string' && model.image.startsWith('data:image/') ? model.image : '';
      const header = card.querySelector('.charity-img');
      if (header && image) {
        header.style.backgroundImage = 'linear-gradient(180deg,rgba(16,12,10,.02),rgba(16,12,10,.18)),url("'+image+'")';
        header.style.backgroundSize = 'cover';
        header.style.backgroundPosition = 'center';
        header.classList.add('has-uploaded-image');
      }
      const loc = card.querySelector('.charity-loc');
      if (loc && model.city) { loc.title = model.city + ', ' + country; const pin=loc.querySelector('svg'); loc.innerHTML=(pin?pin.outerHTML:'')+safeText(model.city+', '+country); }
    });
    const visible = cards.map((card,index) => ({card,model:models[index]})).filter(item => item.model && !item.card.hidden);
    if (nearbyFirst && userCoordinates && visible.length) {
      visible.sort((a,b) => distanceToModel(a.model)-distanceToModel(b.model));
      visible.forEach(item => grid.appendChild(item.card));
    }
    const status = document.getElementById('charity-nearby-status');
    if (status) status.textContent = selectedRecipients.length + '/5 recipients selected · equal shares at month end' + (nearbyFirst ? ' · nearest first' : '');
    renderSelectedCharity();
    renderRecipientSummary();
  }
  function distanceToModel(model) {
    const lat = Number(model.lat), lon = Number(model.lon);
    if (!userCoordinates || !Number.isFinite(lat) || !Number.isFinite(lon)) return Infinity;
    const rad = value => value * Math.PI / 180;
    const dLat = rad(lat-userCoordinates.lat), dLon = rad(lon-userCoordinates.lon);
    const a = Math.sin(dLat/2)**2 + Math.cos(rad(userCoordinates.lat))*Math.cos(rad(lat))*Math.sin(dLon/2)**2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  function renderRecipientSummary() {
    const host = document.querySelector('#page-charities .card:first-of-type .card-body');
    if (!host) return;
    let box = document.getElementById('dotis-selected-recipient-list');
    if (!box) { box = document.createElement('div'); box.id='dotis-selected-recipient-list'; box.className='dotis-selected-recipient-list'; host.appendChild(box); }
    const details = selectedRecipients.map(allocationDetails),count=details.length;
    const amount = Math.max(0, Number(getPointsEarnedForMonth(new Date())) || 0), shares=equalShares(amount,count);
    const estimateNote=count?'Estimated from '+amount.toFixed(2)+' pts earned so far · allocation date '+nextAllocationLabel()+'.':'Choose up to five recipients to preview an equal split · next allocation '+nextAllocationLabel()+'.';
    box.innerHTML = '<div class="dotis-recipient-summary-head"><strong>'+count+' selected recipient'+(count===1?'':'s')+'</strong><span>'+ (count ? (100/count).toFixed(1)+'% each' : 'Select up to five') +'</span></div>' + (count ? details.map((item,index) => '<div class="dotis-recipient-line '+(item.available?'':'is-held')+'"><span><b>'+safeText(item.name)+'</b><small>'+safeText(item.type === 'campaign' ? 'Campaign' : 'Charity')+(item.city||item.country ? ' · '+safeText([item.city,item.country].filter(Boolean).join(', ')) : '')+(item.available?'':' · '+safeText(item.reason)+' · share held')+'</small></span><strong><b>~'+shares[index].toFixed(2)+' pts</b><small>'+(100/count).toFixed(1)+'%'+(item.available?'':' · held')+'</small>'+(item.available?'':'<button type="button" data-replace-allocation="'+safeText(item.key)+'">Choose replacement</button>')+'</strong></div>').join('') : '<p>No donation recipients selected yet.</p>')+'<div class="dotis-recipient-estimate">'+estimateNote+'</div>';
    bindAllocationActions(box);
  }

  function refreshDashboardDonation() {
    const amount = Math.max(0, Number(getPointsEarnedForMonth(new Date())) || 0);
    const available = document.getElementById('overview-donation-available');
    if (available) available.textContent = new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(amount);
    const details = selectedRecipients.map(allocationDetails);
    const container = document.querySelector('.overview-spotlight-donations');
    if (!container) return;
    let breakdown = document.getElementById('dotis-monthly-breakdown');
    if (!breakdown) {
      breakdown = document.createElement('div');
      breakdown.id = 'dotis-monthly-breakdown';
      breakdown.className = 'dotis-monthly-breakdown';
      const target = container.querySelector('.overview-donation-available-row');
      if (target) target.insertAdjacentElement('afterend', breakdown);
    }
    const count=details.length,shares=equalShares(amount,count);
    const percent=count?(100/count).toFixed(1).replace(/\.0$/,''):'0';
    const heldCount=details.filter(item=>!item.available).length;
    const splitStatus=count?(heldCount===count?'On hold':heldCount?'Partly on hold':'Estimated')+' · '+nextAllocationLabel():'Choose recipients';
    breakdown.innerHTML = '<div class="dotis-split-head"><strong>Monthly split</strong><span>'+(count?splitStatus:'Choose a charity')+'</span></div><div class="dotis-allocation-list">'+(count ? details.map((item,index) => '<div class="dotis-allocation-row '+(item.available?'':'is-held')+'"><span class="dotis-allocation-name">'+safeText(item.name)+(item.available?'':'<small>'+safeText(item.reason)+' · share held</small>')+'</span><span class="dotis-allocation-share"><strong>~'+shares[index].toFixed(2)+' pts</strong><small>'+percent+'%'+(item.available?'':' · held')+'</small></span>'+(item.available?'':'<span class="dotis-allocation-actions"><button type="button" data-replace-allocation="'+safeText(item.key)+'">Replace</button><button type="button" data-remove-held-allocation="'+safeText(item.key)+'">Remove</button></span>')+'</div>').join('') : '<div class="dotis-allocation-empty">Select a verified charity or approved campaign to start your split.</div>')+'</div><div class="dotis-split-estimate">Estimates use this month’s points so far. Final allocations appear in Donation history after processing.</div>';
    const label = container.querySelector('.overview-donation-available-row .overview-spotlight-unit');
    if (label) label.textContent = 'pts eligible this month';
    bindAllocationActions(breakdown);
    let journey=container.querySelector('.dotis-impact-journey');
    if(!journey){journey=document.createElement('details');journey.className='dotis-impact-journey';breakdown.insertAdjacentElement('afterend',journey);}
    const each=count?shares[0].toFixed(2):'0.00';
    const proofSample=Array.isArray(DONATIONS)?DONATIONS.find(item=>item.proofDemo&&item.proofFile):null;
    journey.innerHTML='<summary><span>How your giving moves</span><small>See the steps</small></summary><ol class="dotis-impact-steps"><li class="is-current"><span>01</span><div><strong>Points earned</strong><small>'+amount.toFixed(2)+' pts this month</small></div></li><li class="'+(count?'is-current':'')+'"><span>02</span><div><strong>Split equally</strong><small>'+(count?count+' recipient'+(count===1?'':'s')+' · about '+each+' pts each':'Choose up to five recipients')+'</small></div></li><li><span>03</span><div><strong>Month-end allocation</strong><small>'+(count?'Estimated for '+nextAllocationLabel()+' · pending final record':'Choose recipients to begin')+'</small></div></li><li class="'+(proofSample?'is-current':'')+'"><span>04</span><div><strong>Proof and reports</strong><small>'+(proofSample?'Sample proof ready · '+safeText(proofSample.ref):'Available for completed donations')+'</small></div></li></ol><a class="dotis-journey-link" href="#history" onclick="goPage(\'history\',null);return false">View donation history <span aria-hidden="true">→</span></a>';
  }

  function startRecipientReplacement(oldKey) {
    replacementKey=oldKey;
    const nav=Array.from(document.querySelectorAll('.sb-link')).find(button=>(button.getAttribute('onclick')||'').includes("'charities'"));
    if(nav)nav.click();else if(window.goPage)window.goPage('charities');
    if(typeof window.renderCharities==='function')window.renderCharities();
    const status=document.getElementById('charity-nearby-status'),item=allocationDetails(oldKey);
    if(status)status.textContent='Choose an active verified recipient to replace '+item.name+'. Its existing share remains on hold until you choose.';
    renderRecipientSummary();refreshDashboardDonation();setToast('Choose an active charity or campaign to replace '+item.name+'.');
  }
  window.startDotisRecipientReplacement = startRecipientReplacement;
  function bindAllocationActions(root) {
    root.querySelectorAll('[data-replace-allocation]').forEach(button=>button.addEventListener('click',()=>startRecipientReplacement(button.dataset.replaceAllocation)));
    root.querySelectorAll('[data-remove-held-allocation]').forEach(button=>button.addEventListener('click',()=>removeUnavailableRecipient(button.dataset.removeHeldAllocation)));
  }
  function removeUnavailableRecipient(oldKey) {
    if(!selectedRecipients.includes(oldKey))return;
    const next=selectedRecipients.filter(key=>key!==oldKey),entries=closeAllocationException(oldKey,'','remove',next);
    if(!writeSharedTransaction(entries))return;
    selectedRecipients=next;replacementKey='';S.selectedRecipients=selectedRecipients;
    if(window.renderCharities)window.renderCharities();if(window.renderCampaigns)window.renderCampaigns();renderSelectedCharity();renderRecipientSummary();refreshDashboardDonation();
    setToast('Unavailable recipient removed from your split. The remaining shares were recalculated at your request.');
  }

  function toggleRecipient(type, value) {
    const key = type + ':' + value;
    if(replacementKey){
      if(selectedRecipients.includes(key)){setToast('That recipient is already in your split. Choose a different replacement.');return;}
      const index=selectedRecipients.indexOf(replacementKey);if(index<0){replacementKey='';setToast('That held recipient is no longer selected.');return;}
      const oldKey=replacementKey,oldItem=allocationDetails(oldKey),newItem=recipientDetails(key);if(!newItem){setToast('Choose a currently active charity or approved campaign.');return;}
      const next=selectedRecipients.slice();next[index]=key;const entries=closeAllocationException(oldKey,newItem.name,'replace',next);
      if(!writeSharedTransaction(entries))return;
      selectedRecipients=next;replacementKey='';S.selectedRecipients=selectedRecipients;
      if(newItem.type==='charity')S.charity=newItem.name;
      if(window.renderCharities)window.renderCharities();if(window.renderCampaigns)window.renderCampaigns();refreshDashboardDonation();
      setToast(oldItem.name+' replaced with '+newItem.name+'. Your remaining split is unchanged.');return;
    }
    if (selectedRecipients.includes(key)) selectedRecipients = selectedRecipients.filter(item => item !== key);
    else {
      if (selectedRecipients.length >= 5) { setToast('You can select up to five recipients.'); return; }
      selectedRecipients.push(key);
    }
    persistRecipients();
    S.charity = firstActiveCharity() || (CHARITIES.find(item => item.verified) || {}).name || '';
    if (typeof window.renderCharities === 'function') window.renderCharities();
    if (typeof window.renderCampaigns === 'function') window.renderCampaigns();
    refreshDashboardDonation();
    setToast(selectedRecipients.includes(key) ? 'Added to your equal monthly split.' : 'Removed from your monthly split.');
  }

  function replaceShareControls(root) {
    if (!root) return;
    root.querySelectorAll('.campaign-share').forEach(box => {
      const ref = box.querySelector('.ref-val');
      const copy = box.querySelector('.copy-btn');
      if (!ref || !copy) return;
      const item = ref.closest('.camp-item') ? null : null;
      const slug = copy.dataset.slug || String(copy.dataset.url||'').split('/').pop();
      const url = slug ? publicUrl(slug) : '';
      if (url) { ref.textContent = url; copy.dataset.slug = slug; copy.dataset.url = url; }
      if (!box.querySelector('.dotis-share-button')) {
        const slug = copy.dataset.slug;
        if (slug) box.insertAdjacentHTML('beforeend','<button type="button" class="copy-btn dotis-share-button" onclick="shareCampaignLink(\''+safeText(slug)+'\')">Share</button>');
      }
    });
  }

  function openCampaignSubmit() {
    const form = document.getElementById('dotis-campaign-form');
    const overlay = document.getElementById('dotis-campaign-submit-overlay');
    if (!form || !overlay) return;
    const select = form.elements.charity;
    select.innerHTML = CHARITIES.filter(item => item.verified).map(item => '<option value="'+safeText(item.name)+'">'+safeText(item.name)+'</option>').join('');
    if (S.charity && CHARITIES.some(item => item.name === S.charity && item.verified)) select.value = S.charity;
    form.reset();
    if (S.charity && CHARITIES.some(item => item.name === S.charity && item.verified)) select.value = S.charity;
    document.getElementById('user-campaign-image-preview').innerHTML = ''; document.getElementById('user-campaign-image-preview').dataset.image=''; const selectedImageName=document.getElementById('user-campaign-image-name'); if(selectedImageName)selectedImageName.textContent='No file selected';
    form.elements.coverFile.onchange = function () { const file=this.files&&this.files[0],name=document.getElementById('user-campaign-image-name'); if(!file)return; if(!file.type.startsWith('image/')||file.size>5*1024*1024){setToast('Choose an image under 5 MB.');this.value='';if(name)name.textContent='No file selected';const preview=document.getElementById('user-campaign-image-preview');if(preview){preview.innerHTML='';preview.dataset.image='';}return;} if(name)name.textContent=file.name; previewCampaignImage(file); };
    overlay.classList.add('is-open');
    updateDialogLock();
    select.focus();
  }
  function closeCampaignSubmit() { document.getElementById('dotis-campaign-submit-overlay')?.classList.remove('is-open'); updateDialogLock(); }
  function previewCampaignImage(file) {
    const preview = document.getElementById('user-campaign-image-preview');
    if (!file || !preview) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) { setToast('Choose an image under 5 MB.'); return; }
    compressImage(file).then(data => { preview.innerHTML = '<img alt="Campaign header preview" src="'+data+'">'; preview.dataset.image = data; }).catch(() => setToast('That image could not be loaded.'));
  }
  function compressImage(file) {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 1400/img.width, 700/img.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1,Math.round(img.width*scale));
          canvas.height = Math.max(1,Math.round(img.height*scale));
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL('image/jpeg',.82));
        };
        img.onerror = reject; img.src = reader.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }
  async function submitUserCampaign(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (!values.name || !values.description || !values.charity || !values.city || !values.country || !values.terms) { setToast('Complete the required campaign fields and confirm the review terms.'); return; }
    if (!CHARITIES.some(item => item.name === values.charity && item.verified)) { setToast('Choose a verified supporting charity.'); return; }
    const file = form.elements.coverFile.files && form.elements.coverFile.files[0];
    if(file&&(!file.type.startsWith('image/')||file.size>5*1024*1024)){setToast('Choose an image under 5 MB.');return;}
    let coverImage = document.getElementById('user-campaign-image-preview')?.dataset.image || '';
    if (file && !coverImage) {
      try { coverImage = await compressImage(file); } catch (_) { setToast('That image could not be loaded.'); return; }
    }
    const slug = String(values.name).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + Math.random().toString(36).slice(2,6);
    const application = {
      id: 'UCA-' + Date.now().toString(36).toUpperCase(), campaignId:'CP-' + Date.now().toString(36).toUpperCase(),
      name:String(values.name).trim(), charity:String(values.charity), ownerEmail:currentUserEmail(), applicantName:S.contactName || currentUserEmail().split('@')[0],
      submitted:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}), city:String(values.city).trim(), country:String(values.country).trim(),
      location:String(values.city).trim()+', '+String(values.country).trim(), target:Number(values.target)||2500, description:String(values.description).trim(),
      website:String(values.website||'').trim(), social:String(values.social||'').trim(), coverImage, slug, status:'Pending', createdAt:new Date().toISOString()
    };
    const applications = read(KEYS.applications,[]);
    applications.unshift(application);
    write(KEYS.applications,applications);
    const campaignProfile = {name:application.name,charity:application.charity,status:'pending',participants:0,pointsRaised:0,pointsTarget:application.target,slug:application.slug,description:application.description,city:application.city,country:application.country,coverImage:application.coverImage,ownCampaign:true};
    const campaigns = read(KEYS.campaigns,[]).filter(item => item.slug !== slug);
    campaigns.unshift(campaignProfile); write(KEYS.campaigns,campaigns);
    CAMPAIGNS.unshift(campaignProfile);
    closeCampaignSubmit();
    form.reset();const imageName=document.getElementById('user-campaign-image-name'),imagePreview=document.getElementById('user-campaign-image-preview');if(imageName)imageName.textContent='No file selected';if(imagePreview){imagePreview.innerHTML='';imagePreview.dataset.image='';}
    if (typeof window.renderCampaigns === 'function') window.renderCampaigns();
    setToast('Campaign submitted. It will appear publicly after admin approval.');
  }

  async function updateOwnCampaignImage(slug,input) {
    const file=input.files&&input.files[0];if(!file)return;if(!file.type.startsWith('image/')||file.size>5*1024*1024){setToast('Choose an image under 5 MB.');return;}
    try{const coverImage=await compressImage(file),campaign=campaignBySlug(slug);if(!campaign)return;campaign.coverImage=coverImage;const profiles=read(KEYS.campaigns,[]).filter(item=>item.slug!==slug);profiles.unshift({name:campaign.name,charity:campaign.charity,status:campaign.status,participants:campaign.participants,pointsRaised:campaign.pointsRaised,pointsTarget:campaign.pointsTarget,slug:campaign.slug,description:campaign.description,city:campaign.city,country:campaign.country,coverImage,ownCampaign:true});write(KEYS.campaigns,profiles);const applications=read(KEYS.applications,[]),application=applications.find(item=>item.slug===slug);if(application){application.coverImage=coverImage;write(KEYS.applications,applications);}setToast('Campaign header image updated.');if(window.renderCampaigns)window.renderCampaigns();}catch(_){setToast('That image could not be loaded.');}
  }
  async function submitUserCharity() {
    const name=document.getElementById('f-name')?.value.trim(),email=document.getElementById('f-email')?.value.trim(),terms=document.getElementById('f-terms')?.checked;
    if(!name||!email){setToast('Fill in charity name and email.');return;}if(!terms){setToast('Please agree to the submission terms.');return;}
    const file=document.getElementById('f-charity-image')?.files?.[0];let image=document.getElementById('f-charity-image-preview')?.dataset.image||'';
    if(file&&!image){if(file.size>5*1024*1024){setToast('Choose an image under 5 MB.');return;}try{image=await compressImage(file);}catch(_){setToast('That image could not be loaded.');return;}}
    const application={id:'UCS-'+Date.now().toString(36).toUpperCase(),charityId:null,name,contact:(S.contactName||email.split('@')[0])+' · '+email,cause:document.getElementById('f-cat')?.value||'Other',country:document.getElementById('f-loc')?.value.trim()||'',city:document.getElementById('f-city')?.value.trim()||'',website:document.getElementById('f-web')?.value.trim()||'',social:[document.getElementById('f-ig')?.value.trim(),document.getElementById('f-tw')?.value.trim(),document.getElementById('f-tt')?.value.trim()].filter(Boolean).join(' · '),description:document.getElementById('f-desc')?.value.trim()||'',coverImage:image,ownerEmail:currentUserEmail(),submitted:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),status:'Pending'};
    const apps=read(KEYS.charityApplications,[]);apps.unshift(application);write(KEYS.charityApplications,apps);if(window.clearForm)window.clearForm();const cityInput=document.getElementById('f-city'),imageInput=document.getElementById('f-charity-image'),imageName=document.getElementById('f-charity-image-name'),imagePreview=document.getElementById('f-charity-image-preview');if(cityInput)cityInput.value='';if(imageInput)imageInput.value='';if(imageName)imageName.textContent='No file selected';if(imagePreview){imagePreview.innerHTML='';imagePreview.dataset.image='';}setToast('Charity submitted for admin review.');if(window.renderSubmissions)window.renderSubmissions();
  }
  async function updateSubmittedCharityImage(id,input){const file=input.files&&input.files[0];if(!file)return;if(!file.type.startsWith('image/')||file.size>5*1024*1024){setToast('Choose an image under 5 MB.');return;}try{const image=await compressImage(file),apps=read(KEYS.charityApplications,[]),application=apps.find(item=>item.id===id);if(!application)return;application.coverImage=image;write(KEYS.charityApplications,apps);if(String(application.status).toLowerCase()==='approved'){const profiles=read(KEYS.charityProfiles,[]).filter(item=>item.name!==application.name);profiles.unshift({name:application.name,cause:application.cause,country:application.country,city:application.city,website:application.website,image,verified:true,status:'Verified'});write(KEYS.charityProfiles,profiles);}if(window.renderSubmissions)window.renderSubmissions();if(window.renderCharities)window.renderCharities();setToast('Charity header image updated.');}catch(_){setToast('That image could not be loaded.');}}
  let activeShareData = null;
  let shareReturnFocus = null;
  function shareCampaignLink(slug) {
    const campaign = campaignBySlug(slug);
    const url = publicUrl(slug);
    const title = campaign ? campaign.name : 'Dotis campaign';
    const text = campaign ? 'Support '+campaign.name+' on Dotis.' : 'Support this Dotis campaign.';
    const overlay = document.getElementById('dotis-share-overlay');
    if (!overlay) { setToast('Campaign sharing is unavailable.'); return; }
    activeShareData = {title,text,url};
    shareReturnFocus = document.activeElement;
    document.getElementById('dotis-share-title').textContent = 'Share '+title;
    document.getElementById('dotis-share-intro').textContent = 'Invite your community to support '+title+'.';
    document.getElementById('dotis-share-url').value = url;
    const encodedUrl = encodeURIComponent(url), encodedText = encodeURIComponent(text);
    document.getElementById('dotis-share-whatsapp').href = 'https://wa.me/?text='+encodedText+'%20'+encodedUrl;
    document.getElementById('dotis-share-facebook').href = 'https://www.facebook.com/sharer/sharer.php?u='+encodedUrl;
    document.getElementById('dotis-share-linkedin').href = 'https://www.linkedin.com/sharing/share-offsite/?url='+encodedUrl;
    document.getElementById('dotis-share-x').href = 'https://twitter.com/intent/tweet?text='+encodedText+'&url='+encodedUrl;
    document.getElementById('dotis-share-email').href = 'mailto:?subject='+encodeURIComponent(title)+'&body='+encodedText+'%20'+encodedUrl;
    const nativeButton = document.getElementById('dotis-native-share');
    nativeButton.hidden = typeof navigator.share !== 'function';
    overlay.classList.add('is-open');
    updateDialogLock();
    document.getElementById('dotis-share-url').focus();
  }
  async function copyCampaignShareLink() {
    const input = document.getElementById('dotis-share-url');
    if (!input || !activeShareData) return;
    try { await navigator.clipboard.writeText(activeShareData.url); setToast('Campaign link copied.'); }
    catch (_) { input.focus(); input.select(); try { document.execCommand('copy'); setToast('Campaign link copied.'); } catch (_) { window.prompt('Copy this campaign link',activeShareData.url); } }
  }
  async function nativeCampaignShare() {
    if (!activeShareData || typeof navigator.share !== 'function') return;
    try { await navigator.share(activeShareData); }
    catch (error) { if (!error || error.name !== 'AbortError') setToast('The share menu could not be opened.'); }
  }
  function closeCampaignShare() {
    document.getElementById('dotis-share-overlay')?.classList.remove('is-open');
    updateDialogLock();
    if (shareReturnFocus && typeof shareReturnFocus.focus === 'function') shareReturnFocus.focus();
    shareReturnFocus = null;
  }
  async function copyPublicCampaignLink(button) {
    const slug = button.dataset.slug;
    const url = publicUrl(slug);
    try { await navigator.clipboard.writeText(url); button.textContent='Copied'; setTimeout(() => button.textContent='Copy',1600); }
    catch (_) { window.prompt('Copy this campaign link',url); }
  }

  function renderPublicCampaign() {
    const params = new URLSearchParams(window.location.search);
    const pathSlug=(window.location.pathname.match(/\/c\/([^/]+)/)||[])[1];
    const slug = params.get('campaign') || pathSlug;
    if (!slug) return;
    let campaign = campaignBySlug(slug);
    if (!campaign) { try { const shared=JSON.parse(params.get('campaignData')||'null'); if(shared&&shared.slug===slug&&shared.name)campaign=Object.assign({},shared,{pointsTarget:Number(shared.target)||0,status:'approved',ownCampaign:false}); } catch (_) {} }
    if(campaign){
      if(!CHARITIES.some(item=>item.name===campaign.charity)){const profile={name:campaign.charity,cause:'Other',desc:'Verified supporting charity.',loc:campaign.country||'Global',country:campaign.country||'Global',city:campaign.city||'',verified:true,website:'',bg:'#E8DFC8',tc:'#100C0A'};CHARITIES.push(profile);const charities=read(KEYS.charityProfiles,[]).filter(item=>item.name!==profile.name);charities.unshift({name:profile.name,cause:profile.cause,country:profile.country,city:profile.city,verified:true,status:'Verified'});write(KEYS.charityProfiles,charities);}
      if(!CAMPAIGNS.some(item=>item.slug===campaign.slug)){CAMPAIGNS.push(campaign);}
      const profiles=read(KEYS.campaigns,[]).filter(item=>item.slug!==campaign.slug);profiles.unshift({name:campaign.name,charity:campaign.charity,status:'approved',participants:Number(campaign.participants)||0,pointsRaised:Number(campaign.pointsRaised)||0,pointsTarget:Number(campaign.target||campaign.pointsTarget)||0,slug:campaign.slug,description:campaign.description||'',city:campaign.city||'',country:campaign.country||'',coverImage:campaign.coverImage||'',ownCampaign:false});write(KEYS.campaigns,profiles);
    }
    const root = document.getElementById('dotis-public-campaign');
    if (!root) return;
    const login=document.getElementById('login-screen'),app=document.getElementById('app');if(login)login.style.display='none';if(app)app.style.display='none';
    root.hidden = false;
    if (!campaign) {
      root.innerHTML='<section class="dotis-public-card"><a class="dotis-public-brand" href="https://dotis.ai">DOTIS</a><h1>Campaign not found</h1><p>This link may have expired or the campaign is no longer available.</p><a class="dotis-public-primary" href="https://dotis.ai">Visit Dotis</a></section>';
      return;
    }
    window.__dotisSharedCampaign=campaign;
    const state = campaign.ownCampaign===undefined&&!CHARITIES.some(item=>item.name===campaign.charity&&item.verified)?{running:true,label:'Approved'}:getCampaignState(campaign);
    const charity = CHARITIES.find(item => item.name === campaign.charity);
    const image = campaign.coverImage || (charity && charity.image) || '';
    const photo = image && image.startsWith('data:image/') ? ' style="background-image:linear-gradient(180deg,transparent,rgba(16,12,10,.5)),url(\''+image+'\')"' : '';
    const raised = Number(campaign.pointsRaised)||0, target=Number(campaign.pointsTarget)||0;
    const pct = target ? Math.min(100,Math.round(raised/target*100)) : 0;
    root.innerHTML='<div class="dotis-public-top"><a class="dotis-public-brand" href="https://dotis.ai">DOTIS</a><span>COMMUNITY CAMPAIGN</span></div><article class="dotis-public-card"><div class="dotis-public-cover"'+photo+'><span class="dotis-public-state">'+safeText(state.label)+'</span></div><div class="dotis-public-body"><div class="impact-lbl">SUPPORTING '+safeText(campaign.charity || 'A VERIFIED CHARITY').toUpperCase()+'</div><h1>'+safeText(campaign.name)+'</h1><p class="dotis-public-location">'+safeText([campaign.city,campaign.country].filter(Boolean).join(', ') || (charity && (charity.city ? charity.city+', ' : '')+(charity.country||charity.loc)) || '')+'</p><p class="dotis-public-description">'+safeText(campaign.description || 'Join this Dotis community campaign and help its verified charity reach more supporters.')+'</p><div class="dotis-public-progress"><div><span>Points raised</span><strong>'+raised.toLocaleString()+' / '+target.toLocaleString()+' pts</strong></div><span class="dotis-public-track"><i style="width:'+pct+'%"></i></span><small>'+Number(campaign.participants||0).toLocaleString()+' supporters · '+pct+'% of goal</small></div><div class="dotis-public-actions"><a class="dotis-public-primary" href="https://dotis.ai" target="_blank" rel="noopener noreferrer">Get Dotis</a><a class="dotis-public-secondary" href="'+safeText(location.origin+location.pathname)+'#login" onclick="event.preventDefault();prepareCampaignJoin(\''+safeText(campaign.slug)+'\')">I already use Dotis</a><button class="dotis-public-secondary" type="button" onclick="shareCampaignLink(\''+safeText(campaign.slug)+'\')">Share campaign</button></div><p class="dotis-public-note">Campaigns must be approved before they are shared. Contributions are allocated through Dotis to the named verified charity.</p></div></article><footer>Dotis · charitable giving through community campaigns</footer>';
  }

  function prepareCampaignJoin(slug){try{localStorage.setItem(KEYS.pendingJoin,slug);}catch(_){}const url=new URL(window.location.href);url.search='';url.hash='';window.location.href=url.href;}
  function openDotisTerms(event) { if (event && event.preventDefault) event.preventDefault(); document.getElementById('dotis-terms-overlay')?.classList.add('is-open'); updateDialogLock(); }
  function closeDotisTerms() { document.getElementById('dotis-terms-overlay')?.classList.remove('is-open'); updateDialogLock(); }
  function openDotisPrivacy(event) { if (event && event.preventDefault) event.preventDefault(); document.getElementById('dotis-privacy-overlay')?.classList.add('is-open'); updateDialogLock(); }
  function closeDotisPrivacy() { document.getElementById('dotis-privacy-overlay')?.classList.remove('is-open'); updateDialogLock(); }
  function findNearbyCharities() {
    const status = document.getElementById('charity-nearby-status');
    if (!navigator.geolocation) { if(status)status.textContent='Location is not available in this browser. Use the country filter.'; return; }
    if(status)status.textContent='Allow location access to sort charities by distance. Your location stays in this browser.';
    navigator.geolocation.getCurrentPosition(position => {
      userCoordinates = {lat:position.coords.latitude,lon:position.coords.longitude};
      nearbyFirst = true;
      countryFilter='all';
      const select=document.getElementById('charity-country-filter');if(select)select.value='all';
      renderCharities();
      if(status)status.textContent='Nearest charities are shown first using the location you allowed.';
    }, () => { if(status)status.textContent='Location was not shared. Choose a country from the filter instead.'; }, {enableHighAccuracy:false,timeout:8000,maximumAge:300000});
  }

  function installStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .dotis-charity-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:13px;border-top:1px solid var(--border)}
      .dotis-charity-tools label{font:10px var(--font-s);letter-spacing:.13em;text-transform:uppercase;color:var(--ink-50)}
      .dotis-charity-tools select,.dotis-charity-tools button{min-height:40px;border:1px solid var(--border-mid);border-radius:999px;background:var(--surface);padding:8px 14px;color:var(--ink);font:11px var(--font-b)}.dotis-charity-tools select{appearance:none;-webkit-appearance:none;min-width:158px;padding:8px 40px 8px 15px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236B625C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 15px center;background-size:14px 14px}
      .dotis-charity-tools button{background:var(--brand-ink);color:#fff;cursor:pointer}
      .dotis-charity-tools span{flex:1 1 230px;color:var(--ink-50);font-size:11px;line-height:1.5}
      .dotis-selected-recipient-list{width:100%;max-width:680px;margin-top:8px;padding:12px 14px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface-soft)}
      .dotis-recipient-summary-head,.dotis-recipient-line{display:flex;justify-content:space-between;align-items:center;gap:12px}.dotis-recipient-summary-head{margin-bottom:7px;font-size:11px}.dotis-recipient-summary-head span{font:9px var(--font-s);color:var(--flare);text-transform:uppercase;letter-spacing:.1em}
      .dotis-recipient-line{padding:7px 0;border-top:1px solid var(--border);font-size:11px}.dotis-recipient-line span{display:grid;gap:3px}.dotis-recipient-line small{color:var(--ink-50);font-size:10px}.dotis-recipient-line>strong{font:11px var(--font-s);color:var(--flare)}
      .dotis-recipient-line>strong{display:grid;justify-items:end;gap:2px;white-space:nowrap}.dotis-recipient-line>strong>b{font:600 11px var(--font-b);color:var(--ink)}.dotis-recipient-line>strong>small{font:9px var(--font-s);color:var(--ink-50)}.dotis-recipient-estimate{margin-top:8px;padding-top:8px;border-top:1px solid var(--border);color:var(--ink-50);font:10px/1.45 var(--font-b)}
      .dotis-split-estimate{margin-top:8px;color:var(--ink-50);font:10px/1.45 var(--font-b)}
      .dotis-impact-journey{margin-top:10px;border-top:1px solid var(--border);color:var(--ink)}.dotis-impact-journey summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;cursor:pointer;list-style:none}.dotis-impact-journey summary::-webkit-details-marker{display:none}.dotis-impact-journey summary>span{font:600 11px var(--font-b)}.dotis-impact-journey summary>small{color:var(--flare);font:10px var(--font-b)}.dotis-impact-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:2px 0 8px;padding:0;list-style:none}.dotis-impact-steps li{display:flex;gap:8px;min-width:0;padding:10px;border:1px solid var(--border);border-radius:9px;background:var(--surface-soft)}.dotis-impact-steps li>span{color:var(--ink-30);font:10px var(--font-s)}.dotis-impact-steps li.is-current>span{color:var(--flare)}.dotis-impact-steps li>div{display:grid;gap:3px;min-width:0}.dotis-impact-steps strong{color:var(--ink-70);font:600 10px var(--font-b)}.dotis-impact-steps small{color:var(--ink-50);font:9px/1.4 var(--font-b)}.dotis-journey-link{display:inline-flex;align-items:center;gap:5px;margin:0 0 2px;color:var(--flare);font:600 10px var(--font-b);text-decoration:none}.dotis-journey-link:hover{text-decoration:underline;text-underline-offset:3px}
      @media(max-width:760px){.dotis-impact-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:420px){.dotis-impact-steps{grid-template-columns:1fr}.dotis-recipient-line{align-items:flex-start}}
      .charity-select.is-selected-recipient{background:var(--leaf)!important;color:#fff!important}.charity-card[hidden]{display:none!important}.charity-img.has-uploaded-image .charity-art{opacity:0}
      .dotis-campaign-page-head{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"title action" "meta action";align-items:center;column-gap:24px;row-gap:8px}.dotis-campaign-page-head .pg-title{grid-area:title;margin:0}.dotis-campaign-page-head .pg-meta{grid-area:meta;line-height:1.5}.dotis-campaign-page-head #start-campaign-button{grid-area:action;justify-self:end;align-self:center;display:inline-flex;align-items:center;justify-content:center;text-align:center;width:auto;min-width:172px;min-height:44px;margin:0;padding-inline:20px;flex-shrink:0;white-space:nowrap}.dotis-campaign-page-head #start-campaign-button .rl{width:100%;justify-content:center;text-align:center}
      .dotis-campaign-cover-preview{margin:8px 0 0;padding:0}.dotis-campaign-cover-preview img{display:block;width:min(100%,320px);height:110px;object-fit:cover;border-radius:9px}.dotis-campaign-submit-action{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:11px 0 1px}.dotis-campaign-submit-action .btn-ghost{min-height:34px;margin:0;padding:8px 13px;font-size:10px;line-height:1.2;white-space:nowrap}.dotis-image-change{position:relative;overflow:hidden;cursor:pointer}.dotis-image-change input{position:absolute;inset:0;opacity:0;cursor:pointer}.dotis-image-preview img{max-width:100%;max-height:180px;object-fit:cover;border-radius:9px}
      .dotis-modal-overlay{display:none;position:fixed;inset:0;z-index:700;background:rgba(16,12,10,.7);padding:20px;align-items:center;justify-content:center;backdrop-filter:blur(5px)}.dotis-modal-overlay.is-open{display:flex}
      .dotis-modal{width:min(100%,680px);max-height:92vh;overflow:auto;scrollbar-width:none;-ms-overflow-style:none;border:1px solid var(--border);border-radius:18px;background:var(--paper);box-shadow:0 28px 80px rgba(0,0,0,.32);padding:22px}.dotis-modal::-webkit-scrollbar{display:none;width:0;height:0}.dotis-modal-overlay{z-index:10001}.dotis-dialog-open,.dotis-dialog-open body{overflow:hidden}.dotis-modal>header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:16px}.dotis-modal>header h2{font:25px/1.1 var(--font-d);margin-top:7px}.dotis-modal>header button{width:34px;height:34px;border:1px solid var(--border-mid);border-radius:50%;font-size:23px;color:var(--ink)}
      .dotis-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.dotis-form-grid>label{display:grid;gap:6px;font:9px var(--font-s);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-50)}.dotis-form-grid input,.dotis-form-grid select,.dotis-form-grid textarea{width:100%;min-width:0;border:1px solid var(--border-mid);border-radius:9px;background:var(--surface);padding:11px 12px;color:var(--ink);font:13px var(--font-b);letter-spacing:0;text-transform:none}.dotis-form-grid textarea{resize:vertical}.dotis-form-wide{grid-column:1/-1}.dotis-upload-field{display:grid;gap:7px;min-width:0}.dotis-upload-title{font:9px var(--font-s);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-50)}.dotis-file-picker{position:relative;display:flex;align-items:center;gap:11px;min-height:66px;min-width:0;padding:10px 12px;border:1px solid var(--border-mid);border-radius:12px;background:var(--surface);cursor:pointer;transition:border-color .18s,background .18s,box-shadow .18s}.dotis-file-picker:hover{border-color:var(--flare);background:var(--paper);box-shadow:0 8px 22px -18px rgba(225,38,18,.5)}.dotis-file-picker:focus-within{outline:3px solid rgba(225,38,18,.13);outline-offset:2px;border-color:var(--flare)}.dotis-file-picker input[type=file]{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;opacity:0;cursor:pointer}.dotis-file-icon{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:11px;background:var(--flare-dim);color:var(--flare);pointer-events:none}.dotis-file-icon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.dotis-file-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px;pointer-events:none}.dotis-file-copy strong{font-size:11px;font-weight:650;color:var(--ink)}.dotis-file-copy small{overflow:hidden;color:var(--ink-50);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.dotis-file-action{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:7px 11px;border:1px solid var(--border-mid);border-radius:9px;background:var(--paper);color:var(--ink-70);font-size:10px;font-weight:650;pointer-events:none;white-space:nowrap}.dotis-form-help,.dotis-form-note{font:10px/1.5 var(--font-b);letter-spacing:0;text-transform:none;color:var(--ink-50)}.dotis-form-note{margin-top:12px}.dotis-terms-check{display:flex!important;align-items:flex-start;gap:8px;font:11px/1.5 var(--font-b)!important;letter-spacing:0!important;text-transform:none!important;color:var(--ink-70)!important}.dotis-terms-check input{width:16px!important;height:16px;flex:0 0 auto;margin-top:1px}.dotis-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.dotis-image-preview img{display:block;width:100%;max-height:220px;object-fit:cover;border-radius:9px}
      .dotis-terms-modal{max-width:720px}.dotis-terms-copy{color:var(--ink-70);font-size:13px;line-height:1.7}.dotis-terms-copy h3{margin:17px 0 5px;color:var(--ink);font:17px var(--font-d)}.dotis-terms-copy p{margin:0 0 10px}.dotis-terms-links{display:flex;gap:15px;flex-wrap:wrap;margin-top:14px!important}.dotis-terms-links a{color:var(--flare);font-weight:700}.dotis-share-intro{margin:0 0 16px;color:var(--ink-70);font-size:14px;line-height:1.5}.dotis-share-link-label{display:block;margin-bottom:7px;color:var(--ink-50);font:10px var(--font-s);letter-spacing:.13em;text-transform:uppercase}.dotis-share-link-row{display:flex;gap:9px}.dotis-share-link-row input{flex:1;min-width:0;height:42px;padding:10px 12px;border:1px solid var(--border-mid);border-radius:10px;background:var(--surface);color:var(--ink);font:12px var(--font-b)}.dotis-share-link-row .btn-flare{justify-content:center;min-width:132px}.dotis-social-share-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:16px}.dotis-social-share-grid a,.dotis-social-share-grid button{display:flex;align-items:center;justify-content:center;min-height:42px;padding:9px 12px;border:1px solid var(--border-mid);border-radius:11px;background:var(--surface);color:var(--ink-70);font:12px var(--font-b);text-decoration:none;cursor:pointer;transition:background .16s,border-color .16s,color .16s}.dotis-social-share-grid a:hover,.dotis-social-share-grid button:hover{border-color:var(--flare);background:var(--flare-dim);color:var(--flare)}.dotis-share-note{margin:14px 0 0;color:var(--ink-50);font-size:11px;line-height:1.5}.dotis-share-modal{max-width:560px}.dotis-share-modal>header h2{overflow-wrap:anywhere}
      .dotis-public-campaign{position:fixed;inset:0;z-index:9999;overflow:auto;scrollbar-width:none;-ms-overflow-style:none;background:#f7f3ec;padding:26px;color:#100c0a;font-family:'DM Sans',system-ui,sans-serif}.dotis-public-campaign::-webkit-scrollbar{display:none;width:0;height:0}.dotis-public-top{width:min(100%,980px);margin:0 auto 20px;display:flex;align-items:center;justify-content:space-between}.dotis-public-brand{font:28px var(--font-d);letter-spacing:.1em;color:#100c0a;text-decoration:none}.dotis-public-top>span{font:9px var(--font-s);letter-spacing:.2em;color:#70665d}.dotis-public-card{width:min(100%,820px);margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 18px 60px rgba(16,12,10,.12)}.dotis-public-cover{height:270px;background:linear-gradient(135deg,#e8dfc8,#f4eee3);background-position:center;background-size:cover;display:flex;align-items:flex-end;padding:16px}.dotis-public-state{background:#fff;padding:7px 11px;border-radius:99px;font:9px var(--font-s);text-transform:uppercase;letter-spacing:.12em}.dotis-public-body{padding:clamp(22px,5vw,42px)}.dotis-public-body h1{margin:9px 0;font:clamp(30px,6vw,52px)/.98 var(--font-d)}.dotis-public-location{color:#716a64;font-size:13px}.dotis-public-description{max-width:650px;margin:18px 0;color:#4b4540;font-size:15px;line-height:1.7}.dotis-public-progress{padding:16px;background:#f7f3ec;border-radius:12px}.dotis-public-progress>div{display:flex;justify-content:space-between;gap:10px;font-size:12px}.dotis-public-progress>div strong{font-family:var(--font-s)}.dotis-public-track{display:block;height:7px;margin:10px 0;background:#e2d7c6;border-radius:10px;overflow:hidden}.dotis-public-track i{display:block;height:100%;background:#e12612}.dotis-public-progress small{color:#716a64}.dotis-public-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.dotis-public-primary,.dotis-public-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 16px;border-radius:99px;text-decoration:none;font-size:12px;font-weight:700;cursor:pointer}.dotis-public-primary{background:#e12612;color:#fff;border:1px solid #e12612}.dotis-public-secondary{background:#fff;color:#100c0a;border:1px solid rgba(16,12,10,.18)}.dotis-public-note{margin-top:16px;color:#716a64;font-size:11px;line-height:1.55}.dotis-public-campaign footer{width:min(100%,820px);margin:16px auto;text-align:center;font:9px var(--font-s);letter-spacing:.12em;color:#7c746b}
      @media(max-width:680px){.dotis-social-share-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dotis-share-link-row{align-items:stretch;flex-direction:column}.dotis-share-link-row .btn-flare{width:100%}.dotis-charity-tools{align-items:stretch}.dotis-charity-tools select,.dotis-charity-tools button{flex:1}.dotis-charity-tools select{min-width:0;padding-right:38px;background-position:right 13px center}.dotis-charity-tools span{flex-basis:100%}.dotis-form-grid{grid-template-columns:1fr}.dotis-form-wide{grid-column:auto}.dotis-modal{padding:17px}.dotis-modal-overlay{padding:10px}.dotis-public-campaign{padding:16px}.dotis-public-cover{height:210px}.dotis-public-actions>*{flex:1 1 100%}.dotis-campaign-page-head{grid-template-columns:1fr;grid-template-areas:"title" "meta" "action";row-gap:9px}.dotis-campaign-page-head #start-campaign-button{justify-self:start;min-height:42px;margin-top:3px}.dotis-allocation-list>div{font-size:12px}}
      @media(min-width:1200px){.sb-status-txt,.sb-section,.sb-badge,.topbar-breadcrumb,.btn-ink,.btn-flare,.overview-export-btn,.report-export-btn,.pg-meta,.card-tag,.card-action,.stat-delta,.item-sub,.item-tag,.impact-lbl,.impact-sub,.bar-pct,.copy-btn,.reveal-row,.fl-label,.charity-update-kicker,.charity-update-count,.charity-update-status,.charity-update-metrics,.charity-cause-label,.charity-meta,.charity-loc,.proof-ref,.proof-btn,.prof-key,.prof-edit,.overview-spotlight-kicker,.overview-trend,.overview-compare,.overview-donation-change,.overview-history-link,.overview-campaign-total,.overview-promise-kicker,.overview-promise-terms,.overview-promise-step-index,.overview-metric-btn,.overview-chart-range,.campaign-filter-title,.campaign-filter-reset,.report-kicker,.report-range,.report-status,.report-chart-meta,.campaign-share-label{font-size:clamp(10px,.75vw,13px)!important}.overview-spotlight-caption,.overview-spotlight-unit,.overview-lifetime-balance,.overview-bandwidth-note,.camp-sub,.camp-progress-meta,.charity-desc,.charity-campaign-meta,.overview-promise-step-copy>span,.overview-chart-note,.overview-campaign-summary,.proof-desc,.prof-val,.dotis-charity-tools span,.dotis-recipient-line,.dotis-allocation-list>div,.dotis-allocation-note{font-size:clamp(12px,.82vw,16px)!important;line-height:1.55}.dotis-form-grid>label,.dotis-upload-title,.dotis-file-copy small,.dotis-file-action,.dotis-form-help,.dotis-form-note,.dotis-share-link-label,.dotis-share-note{font-size:clamp(10px,.7vw,12px)!important}.dotis-form-grid input,.dotis-form-grid select,.dotis-form-grid textarea,.dotis-share-link-row input{font-size:clamp(13px,.85vw,16px)}}
      @media(max-width:600px){.charity-name,.camp-name{font-size:15px!important}.dotis-charity-tools select,.dotis-charity-tools button{font-size:12px}.dotis-recipient-line,.dotis-allocation-list>div{font-size:12px}}
      .dotis-recipient-line.is-held{background:var(--amber-dim);border-radius:10px;padding:8px 10px}.dotis-recipient-line.is-held>strong{display:grid;justify-items:end;gap:5px}.dotis-recipient-line.is-held button{border:0;background:transparent;color:var(--flare);font:600 9px var(--font-s);cursor:pointer;text-decoration:underline;text-underline-offset:2px}
      .dotis-monthly-breakdown{margin:12px 0 0;padding:0;border:0;border-radius:0;background:transparent}
      .dotis-split-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:8px;color:var(--ink)}
      .dotis-split-head strong{font:600 12px var(--font-b)}.dotis-split-head span{color:var(--leaf);font:500 clamp(9px,.7vw,11px) var(--font-s);white-space:nowrap}
      .dotis-allocation-list{display:grid;gap:0}
      .dotis-allocation-list>div.dotis-allocation-row{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px 12px;padding:8px 0;border-top:1px solid var(--border);font:12px/1.4 var(--font-b);color:var(--ink-70)}
      .dotis-allocation-name{min-width:0;overflow-wrap:anywhere;color:var(--ink);font:500 12px/1.35 var(--font-b)}
      .dotis-allocation-name small{display:block;margin-top:3px;color:var(--amber);font:10px/1.35 var(--font-b)}
      .dotis-allocation-share{display:flex;align-items:baseline;gap:8px;white-space:nowrap}
      .dotis-allocation-share strong{color:var(--ink);font:600 12px var(--font-b)}.dotis-allocation-share small{color:var(--ink-50);font:10px var(--font-s)}
      .dotis-allocation-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:12px}
      .dotis-allocation-actions button{padding:0;border:0;background:transparent;color:var(--flare);font:500 10px var(--font-b);cursor:pointer;text-decoration:underline;text-underline-offset:2px}
      .dotis-allocation-actions button:last-child{color:var(--ink-50)}
      .dotis-allocation-empty{display:block!important;padding:10px 0;border-top:1px solid var(--border);color:var(--ink-50);font:12px/1.45 var(--font-b)}
      @media(max-width:600px){.dotis-allocation-list>div.dotis-allocation-row{font-size:12px}.dotis-allocation-name,.dotis-allocation-share strong{font-size:12px}.dotis-split-head span{font-size:9px}}
    `;
    document.head.appendChild(style);
  }

  function patchCampaignMarkup() {
    const donationIconRise = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16l4-4 3 3 7-8"/><path d="M14 7h5v5"/></svg>';
    const donationIconGift = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M12 9H7.5a2.5 2.5 0 1 1 2.4-3.2L12 9Zm0 0h4.5a2.5 2.5 0 1 0-2.4-3.2L12 9Z"/></svg>';
    const icons = document.querySelectorAll('.overview-spotlight-icon');
    if (icons[0]) icons[0].innerHTML = donationIconRise;
    if (icons[1]) icons[1].innerHTML = donationIconGift;
    const terms = document.getElementById('points-terms-details');
    if (terms) terms.hidden = true;
  }

  function installWrappers() {
    const originalRenderCharities = window.renderCharities;
    window.renderCharities = function () { originalRenderCharities.apply(this,arguments); afterCharityRender(); };
    window.chooseCharity = function (index) {
      const charity = CHARITIES[index];
      if (!charity || !charity.verified) { setToast('Only verified charities can be selected.'); return; }
      toggleRecipient('charity',charity.name);
    };
    window.toggleCampaignRecipient = function (slug) { toggleRecipient('campaign',slug); };
    const originalCampaignCard = window.campaignCard;
    window.campaignCard = function (campaign,index,compact) {
      let html = originalCampaignCard.apply(this,arguments);
      if (campaign.slug) { const oldUrl='https://dotis.app/c/'+encodeURIComponent(campaign.slug); const newUrl=publicUrl(campaign.slug); html=html.split(oldUrl).join(newUrl).replace('data-url="'+newUrl+'"','data-url="'+newUrl+'" data-slug="'+safeText(campaign.slug)+'"'); }
      const state = getCampaignState(campaign);
      let extras='';
      if (campaign.ownCampaign && campaign.coverImage && !compact) extras += '<div class="dotis-campaign-cover-preview"><img src="'+campaign.coverImage+'" alt="Header image for '+safeText(campaign.name)+'"></div>';
      let actions='';
      if (state.running && campaign.slug) {
        const selected = selectedRecipients.includes('campaign:'+campaign.slug);
        const share = selectedRecipients.length ? (100/selectedRecipients.length).toFixed(1).replace(/\.0$/,'')+'%' : '100%';
        const label = compact ? (selected ? (replacementKey ? 'Selected' : 'In split · '+share) : (replacementKey ? 'Replace unavailable recipient' : 'Add to split')) : (selected?(replacementKey?'Already in monthly split':'Remove from monthly split'):(replacementKey?'Replace unavailable recipient':'Add campaign to monthly split'));
        const actionClass = compact ? (selected?'dotis-overview-in-split':'dotis-overview-add-split') : '';
        actions += '<button type="button" class="btn-ghost '+actionClass+'" aria-label="'+(selected?'Remove campaign from monthly split':'Add campaign to monthly split')+'" title="'+(selected?'Remove campaign from monthly split':'Add campaign to monthly split')+'" aria-pressed="'+selected+'" '+(replacementKey&&selected?'disabled':'')+' onclick="event.stopPropagation();toggleCampaignRecipient(\''+safeText(campaign.slug)+'\')">'+label+'</button>'+(!compact&&campaign.ownCampaign?'<span class="badge badge-green">Your campaign</span>':'');
      } else if (campaign.ownCampaign&&!compact) actions += '<span class="badge badge-amber">Awaiting admin review</span>';
      if (campaign.ownCampaign&&!compact) actions += '<label class="btn-ghost dotis-image-change" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 14v5h14v-5"/></svg>Change header image<input type="file" accept="image/*" aria-label="Change campaign header image" onchange="updateOwnCampaignImage(\''+safeText(campaign.slug)+'\',this)"></label>';
      if(actions) extras += '<div class="dotis-campaign-submit-action">'+actions+'</div>';
      if(extras){const infoEnd=compact?html.lastIndexOf('</div></div>'):html.indexOf('</div><span class="badge badge-');if(infoEnd>=0)html=html.slice(0,infoEnd)+extras+html.slice(infoEnd);}
      return html;
    };
    const originalRenderDonation = window.renderDonationRequestCard;
    window.renderDonationRequestCard = function () { originalRenderDonation.apply(this,arguments); refreshDashboardDonation(); };
    const originalRenderCampaigns = window.renderCampaigns;
    window.renderCampaigns = function () { originalRenderCampaigns.apply(this,arguments); replaceShareControls(document.getElementById('page-campaigns')); refreshDashboardDonation(); };
    const originalShowReport = window.showCampaignReport;
    window.showCampaignReport = function () {
      originalShowReport.apply(this,arguments);
      const root = document.getElementById('camp-report-panel');
      if (!root) return;
      const index = Number(arguments[0]), campaign = CAMPAIGNS[index];
      const box = root.querySelector('.report-campaign-link'), copy = box && box.querySelector('.copy-btn');
      if (copy && campaign && campaign.slug) { copy.dataset.slug = campaign.slug; copy.dataset.url = publicUrl(campaign.slug); const ref=box.querySelector('.ref-val'); if(ref)ref.textContent=publicUrl(campaign.slug); if(!box.querySelector('.dotis-share-button'))box.insertAdjacentHTML('beforeend','<button type="button" class="copy-btn dotis-share-button" onclick="shareCampaignLink(\''+safeText(campaign.slug)+'\')">Share</button>'); }
    };
    window.copyCampaignLink = copyPublicCampaignLink;
    window.shareCampaignLink = shareCampaignLink;
    window.copyCampaignShareLink = copyCampaignShareLink;
    window.nativeCampaignShare = nativeCampaignShare;
    window.closeCampaignShare = closeCampaignShare;
    window.openCampaignSubmit = openCampaignSubmit;
    window.closeCampaignSubmit = closeCampaignSubmit;
    window.submitUserCampaign = submitUserCampaign;
    window.updateOwnCampaignImage = updateOwnCampaignImage;
    window.updateSubmittedCharityImage = updateSubmittedCharityImage;
    window.submitCharity = submitUserCharity;
    const originalSubmissions=window.renderSubmissions;
    window.renderSubmissions=function(){originalSubmissions.apply(this,arguments);const host=document.getElementById('my-submissions');if(!host)return;host.querySelectorAll('.dotis-user-charity-submission').forEach(node=>node.remove());const mine=read(KEYS.charityApplications,[]).filter(item=>item.ownerEmail===currentUserEmail());if(mine.length){host.insertAdjacentHTML('beforeend',mine.map(item=>'<div class="proof-item dotis-user-charity-submission"><div><div class="proof-name">'+safeText(item.name)+'</div><div class="proof-desc">'+safeText(item.city ? item.city+', ' : '')+safeText(item.country)+' · Submitted '+safeText(item.submitted)+(item.coverImage?' · Header image attached':'')+'</div></div><span class="badge badge-amber">'+safeText(item.status)+'</span><label class="btn-ghost dotis-image-change">Change image<input type="file" accept="image/*" onchange="updateSubmittedCharityImage(\''+safeText(item.id)+'\',this)"></label></div>').join(''));}};
    window.findNearbyCharities = findNearbyCharities;
    window.openDotisTerms = openDotisTerms;
    window.closeDotisTerms = closeDotisTerms;
    window.openDotisPrivacy = openDotisPrivacy;
    window.closeDotisPrivacy = closeDotisPrivacy;
    window.prepareCampaignJoin = prepareCampaignJoin;
    const originalLogin=window.doLogin;
    window.doLogin=async function(){
      const result=await originalLogin.apply(this,arguments);
      if(S.key){
        let pending='';try{pending=localStorage.getItem(KEYS.pendingJoin)||'';}catch(_){}
        if(pending){
          try{localStorage.removeItem(KEYS.pendingJoin);}catch(_){}
          const target=campaignBySlug(pending);
          if(target&&getCampaignState(target).running){
            if(!selectedRecipients.includes('campaign:'+pending)){
              if(selectedRecipients.length<5){selectedRecipients.push('campaign:'+pending);persistRecipients();setToast(target.name+' added to your monthly split.');}
              else setToast('Choose a recipient to remove before adding this campaign.');
            }
            if(window.goPage)window.goPage('campaigns',document.querySelectorAll('.sb-link')[4]);
          }
        }
      }
      return result;
    };
  }

  function init() {
    normalizeSharedData();
    injectControls();
    installStyles();
    installWrappers();
    patchCampaignMarkup();
    if (typeof window.renderCampaigns === 'function') window.renderCampaigns();
    if (typeof window.renderSubmissions === 'function') window.renderSubmissions();
    refreshDashboardDonation();
    afterCharityRender();
    renderPublicCampaign();
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (document.getElementById('dotis-share-overlay')?.classList.contains('is-open')) closeCampaignShare();
      else if (document.getElementById('dotis-privacy-overlay')?.classList.contains('is-open')) closeDotisPrivacy();
      else if (document.getElementById('dotis-terms-overlay')?.classList.contains('is-open')) closeDotisTerms();
      else if (document.getElementById('dotis-campaign-submit-overlay')?.classList.contains('is-open')) closeCampaignSubmit();
    });
    window.addEventListener('storage', event => {
      if (![KEYS.applications,KEYS.charityApplications,KEYS.campaigns,KEYS.charityProfiles,KEYS.recipients,KEYS.exceptions,KEYS.inbox].includes(event.key)) return;
      if([KEYS.applications,KEYS.charityApplications,KEYS.campaigns,KEYS.charityProfiles].includes(event.key))normalizeSharedData();
      if(event.key===KEYS.recipients){selectedRecipients=read(KEYS.recipients,[]);if(!Array.isArray(selectedRecipients))selectedRecipients=[];S.selectedRecipients=selectedRecipients;S.charity=firstActiveCharity()||(CHARITIES.find(item=>item.verified)||{}).name||'';renderRecipientSummary();}
      if (typeof window.renderCampaigns === 'function') window.renderCampaigns();
      if (typeof window.renderCharities === 'function') window.renderCharities();
      refreshDashboardDonation();
      renderPublicCampaign();
    });
    setInterval(refreshDashboardDonation,60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
