(function () {
  const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:wght@400;500;600;700&display=swap';
  const CSS = `
    .dotis-pdf-export{position:relative;display:inline-block;z-index:30}
    .dotis-pdf-export>summary{list-style:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:7px 11px;border:1px solid rgba(16,12,10,.18);border-radius:11px;background:var(--surface,var(--paper,#fff));color:var(--ink,#100C0A);font:700 10px 'DM Sans',sans-serif;letter-spacing:.035em;cursor:pointer;white-space:nowrap;transition:border-color .16s,color .16s,transform .16s}
    .dotis-pdf-export>summary::-webkit-details-marker{display:none}
    .dotis-pdf-export>summary:hover,.dotis-pdf-export[open]>summary{border-color:var(--flare,#E12612);color:var(--flare,#E12612);transform:translateY(-1px)}
    .dotis-pdf-export>summary:focus-visible{outline:2px solid var(--flare,#E12612);outline-offset:2px}
    .dotis-pdf-export>summary svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .dotis-pdf-export__menu{position:absolute;top:calc(100% + 6px);right:0;min-width:156px;padding:5px;border:1px solid rgba(16,12,10,.13);border-radius:12px;background:#fff;box-shadow:0 12px 28px rgba(16,12,10,.15);display:grid;gap:2px;z-index:9999}
    .dotis-pdf-export__menu button{display:block;width:100%;padding:9px 10px;border:0;border-radius:8px;background:transparent;color:#1B1411;font:600 10px 'DM Sans',sans-serif;text-align:left;cursor:pointer}
    .dotis-pdf-export__menu button:hover{background:#FDE8E3;color:#D92306}
    html[data-theme="dark"] .dotis-pdf-export>summary{background:#211e1b;color:#f7f3ec;border-color:rgba(255,255,255,.18)}
    html[data-theme="dark"] .dotis-pdf-export__menu{background:#211e1b;border-color:rgba(255,255,255,.16)}
    html[data-theme="dark"] .dotis-pdf-export__menu button{color:#f7f3ec}
    html[data-theme="dark"] .dotis-pdf-export__menu button:hover{background:rgba(225,38,18,.16);color:#ff9184}
    body.dark-mode .dotis-pdf-export>summary{background:#211e1b;color:#F4F0E9;border-color:rgba(255,255,255,.18)}
    body.dark-mode .dotis-pdf-export__menu{background:#211e1b;border-color:rgba(255,255,255,.16)}
    body.dark-mode .dotis-pdf-export__menu button{color:#F4F0E9}
    body.dark-mode .dotis-pdf-export__menu button:hover{background:rgba(225,38,18,.16);color:#ff9184}
    @media(max-width:560px){.dotis-pdf-export>summary{min-height:32px;padding:6px 9px;font-size:8px}}
  `;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt = (value, digits=0) => Number(value || 0).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const dateLabel = () => new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  const logoSrc = () => {
    const logo = [...document.querySelectorAll('img')].find(img => /dotis/i.test(img.alt || '') || /dotis-logo/i.test(img.currentSrc || img.src));
    return logo ? (logo.currentSrc || logo.src) : new URL('assets/dotis-logo.308dec626b81.webp', location.href).href;
  };

  function trendSvg(chart) {
    const vals = (chart && Array.isArray(chart.values) ? chart.values : []).map(Number).filter(Number.isFinite);
    const names = chart && Array.isArray(chart.labels) ? chart.labels : [];
    if (!vals.length) return '<div class="chart-empty">No activity has been recorded for this period.</div>';
    const w=960,h=250,left=48,right=18,top=16,bottom=36,iw=w-left-right,ih=h-top-bottom;
    const max=Math.max(1,...vals)*1.12;
    const pts=vals.map((v,i)=>[left+(vals.length<2?iw/2:i*iw/(vals.length-1)),top+ih-(Math.max(0,v)/max)*ih]);
    let line=`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for(let i=0;i<pts.length-1;i++){
      const [x1,y1]=pts[i],[x2,y2]=pts[i+1],p0=pts[i-1]||pts[i],p3=pts[i+2]||pts[i+1];
      const c1x=x1+(x2-p0[0])/6,c1y=y1+(y2-p0[1])/6,c2x=x2-(p3[0]-x1)/6,c2y=y2-(p3[1]-y1)/6;
      line+=` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
    const base=top+ih, area=`${line} L ${pts[pts.length-1][0].toFixed(1)} ${base} L ${pts[0][0].toFixed(1)} ${base} Z`;
    const ticks=[0,.5,1].map(f=>{const yy=top+ih*(1-f);return `<g><line x1="${left}" y1="${yy}" x2="${w-right}" y2="${yy}"/><text x="${left-8}" y="${yy+4}" text-anchor="end">${f===0?'0':fmt(max*f)}</text></g>`}).join('');
    const labelIndexes=[0,Math.round((vals.length-1)/4),Math.round((vals.length-1)/2),Math.round(3*(vals.length-1)/4),vals.length-1].filter((v,i,a)=>a.indexOf(v)===i);
    const xlabels=labelIndexes.map(i=>`<text x="${pts[i][0]}" y="${h-8}" text-anchor="middle">${esc(names[i] == null ? '' : names[i])}</text>`).join('');
    const markers=pts.map((p,i)=>i%Math.max(1,Math.round(vals.length/12))===0||i===vals.length-1?`<circle cx="${p[0]}" cy="${p[1]}" r="3.4"/>`:'' ).join('');
    return `<svg class="trend-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(chart.title || 'Report trend chart')}"><g class="grid">${ticks}</g><path class="area" d="${area}"/><path class="line" d="${line}"/>${markers}${xlabels}</svg>`;
  }

  function rowHtml(row) {
    const tone = row.tone === 'green' ? 'green' : row.tone === 'amber' ? 'amber' : 'red';
    const progress = Number.isFinite(Number(row.progress)) ? `<div class="row-progress"><span style="width:${Math.max(0,Math.min(100,Number(row.progress)))}%"></span></div>` : '';
    return `<article class="report-row ${tone}"><div class="row-copy"><strong>${esc(row.title || '')}</strong>${row.subtitle ? `<small>${esc(row.subtitle)}</small>` : ''}${progress}</div>${row.tag ? `<span class="row-tag ${tone}">${esc(row.tag)}</span>` : ''}${row.value ? `<b class="row-value">${esc(row.value)}</b>` : ''}</article>`;
  }

  function sectionHtml(section) {
    const rows = (section.rows || []).slice(0,4);
    return `<section class="report-section"><div class="section-head"><h2>${esc(section.title)}</h2>${section.meta ? `<span>${esc(section.meta)}</span>` : ''}</div>${rows.length ? rows.map(rowHtml).join('') : `<div class="report-empty">${esc(section.empty || 'No records are available for this period.')}</div>`}</section>`;
  }

  function reportHtml(data) {
    const generated = esc(data.generated || dateLabel());
    const cards = (data.cards || []).slice(0,3).map((card,i)=>`<article class="metric-card ${i===1?'green':''}"><span>${esc(card.label)}</span><strong>${esc(card.value)}</strong>${card.detail?`<small>${esc(card.detail)}</small>`:''}</article>`).join('');
    const logo = esc(data.logo || logoSrc());
    const subtitle = esc(data.subtitle || 'Dotis dashboard report');
    const chart = data.chart && (data.chart.values || []).length ? `<section class="chart-section"><div class="section-head"><h2>${esc(data.chart.title || 'Activity trend')}</h2><span>${esc(data.chart.range || '')}</span></div><div class="chart-card">${trendSvg(data.chart)}</div></section>` : '';
    const sections = (data.sections || []).map(sectionHtml).join('');
    const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${FONT_LINK}" rel="stylesheet">`;
    const css = `
      @page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{margin:0;min-height:100%;background:#FAF5EF;color:#1B1411;font-family:'DM Sans',Arial,sans-serif}body{font-size:9px}.report-page{width:210mm;min-height:297mm;padding:11mm 13mm 9mm;margin:0 auto;background:#FAF5EF;display:flex;flex-direction:column;gap:3.4mm}.screen-only{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px;background:#1B1411;color:#fff;font:12px 'DM Sans',sans-serif}.screen-only button{border:0;border-radius:999px;padding:8px 14px;background:#D92306;color:#fff;font:700 11px 'DM Sans',sans-serif;cursor:pointer}.report-header{display:flex;justify-content:space-between;align-items:center;min-height:13mm}.report-logo{display:block;width:39mm;height:auto;max-height:14mm;object-fit:contain;object-position:left center}.report-meta{text-align:right;display:grid;gap:1.5mm;color:#766C64;font-size:7px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.report-meta b{color:#D92306;font-size:6.3px;letter-spacing:.15em}.report-ribbon{display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:8mm;padding:2mm 4mm;border-radius:99px;background:#FDE8E3;color:#D92306;font-size:6.2px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.ribbon-left{display:flex;align-items:center;gap:2mm}.ribbon-dot{width:1.5mm;height:1.5mm;border-radius:50%;background:#D92306}.report-ribbon span:last-child{color:#766C64}.report-hero{display:flex;align-items:center;justify-content:space-between;gap:5mm;min-height:39mm;padding:6mm 7mm;border-radius:5mm;background:#1B1411;color:#fff}.hero-copy{min-width:0;flex:1}.hero-kicker{display:inline-flex;align-items:center;margin-bottom:3mm;padding:1.5mm 3mm;border-radius:99px;background:#D92306;color:#fff;font-size:5.7px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.report-hero h1{margin:0;color:#fff;font:24px/1.04 'Anton',Impact,sans-serif;letter-spacing:.15px}.report-hero p{margin:2mm 0 0;color:#D7CDC4;font:8px/1.45 'DM Sans',Arial,sans-serif}.hero-meta{margin-top:4mm;color:#A5968C;font-size:5.8px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.hero-meta strong{display:block;margin-top:1mm;color:#fff;font-size:7px;letter-spacing:0;text-transform:none}.hero-score{flex:0 0 37mm;min-height:27mm;padding:4mm;border-radius:4mm;background:#D92306;display:flex;flex-direction:column;justify-content:center}.hero-score span{color:rgba(255,255,255,.82);font-size:5.7px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.hero-score strong{display:block;margin:1.5mm 0;font:25px/1 'Anton',Impact,sans-serif;color:#fff}.hero-score small{color:#fff;font-size:6.5px}.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin:0 0 2mm}.section-head h2{margin:0;color:#1B1411;font:13px/1.1 'Anton',Impact,sans-serif}.section-head span{color:#766C64;font-size:5.8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3mm}.metric-card{min-height:20mm;padding:3mm 3mm 2.5mm 4mm;border:1px solid #ECE4DB;border-left:1.2mm solid #D92306;border-radius:3mm;background:#fff;display:flex;flex-direction:column;justify-content:space-between;gap:1mm}.metric-card.green{border-left-color:#466E5C}.metric-card span{color:#766C64;font-size:5.6px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.metric-card strong{font:14px/1 'Anton',Impact,sans-serif;color:#1B1411;overflow-wrap:anywhere}.metric-card small{color:#766C64;font-size:6.2px}.chart-card{height:42mm;padding:2mm 3mm 1mm;border:1px solid #ECE4DB;border-radius:3mm;background:#fff}.trend-svg{display:block;width:100%;height:100%;overflow:visible}.trend-svg .grid line{stroke:#ECE4DB;stroke-width:1}.trend-svg .grid text,.trend-svg text{font:12px 'DM Sans',Arial,sans-serif;fill:#A5968C}.trend-svg .area{fill:rgba(217,35,6,.08)}.trend-svg .line{fill:none;stroke:#D92306;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.trend-svg circle{fill:#fff;stroke:#D92306;stroke-width:2.2}.report-sections{display:grid;grid-template-columns:1fr;gap:3mm}.report-section{break-inside:avoid}.report-row{display:flex;align-items:center;gap:3mm;min-height:9.3mm;margin:0 0 1.6mm;padding:1.8mm 3mm;border:1px solid #ECE4DB;border-left:1.2mm solid #D92306;border-radius:2.5mm;background:#fff}.report-row.green{border-left-color:#466E5C}.report-row.amber{border-left-color:#B46E00}.row-copy{flex:1;min-width:0;display:grid;gap:1mm}.row-copy strong{color:#1B1411;font:700 7.5px/1.25 'DM Sans',Arial,sans-serif}.row-copy small{color:#766C64;font:6.3px/1.25 'DM Sans',Arial,sans-serif}.row-tag{flex:0 0 auto;padding:1.2mm 2mm;border-radius:99px;background:#FDE8E3;color:#D92306;font-size:5.4px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.row-tag.green{background:#D9EFE8;color:#466E5C}.row-tag.amber{background:#F5EBDC;color:#9A6500}.row-value{flex:0 0 auto;color:#1B1411;font:10px 'Anton',Impact,sans-serif;white-space:nowrap}.row-progress{height:1mm;border-radius:99px;background:#FDE8E3;overflow:hidden}.row-progress span{display:block;height:100%;border-radius:99px;background:#D92306}.report-empty{padding:4mm;border:1px dashed #D7CDC4;border-radius:3mm;color:#766C64;background:#fff;font-size:7px}.report-footer{margin-top:auto;padding-top:2.5mm;border-top:1px solid #ECE4DB;display:flex;justify-content:space-between;color:#766C64;font-size:6px;letter-spacing:.06em;text-transform:uppercase}
      @media screen{body{background:#e9e5df}.report-page{box-shadow:0 16px 48px rgba(27,20,17,.16)}.screen-only{position:sticky;top:0;z-index:5}}
      @media print{.screen-only{display:none!important}.report-page{height:297mm;min-height:297mm;margin:0;overflow:hidden;box-shadow:none;page-break-after:avoid}.report-footer{margin-top:auto}}
    `;
    const sectionsWrapped = sections ? `<div class="report-sections">${sections}</div>` : '';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.title || 'Dotis report')}</title>${fontLink}<style>${css}</style></head><body><div class="screen-only"><span>Ready to save this Dotis report as a PDF.</span><button type="button" onclick="window.print()">Print / Save PDF</button></div><main class="report-page"><header class="report-header"><img class="report-logo" src="${logo}" alt="Dotis"><div class="report-meta"><span>${esc(data.role || 'DOTIS REPORT')}</span><b>Generated · ${generated}</b></div></header><div class="report-ribbon"><span class="ribbon-left"><i class="ribbon-dot"></i>Dotis dashboard · ${esc(data.ribbon || 'Report export')}</span><span>${esc(data.range || 'Current snapshot')}</span></div><section class="report-hero"><div class="hero-copy"><span class="hero-kicker">${esc(data.kicker || 'REPORT')}</span><h1>${esc(data.title || 'Dotis report')}</h1><p>${subtitle}</p>${data.meta?`<div class="hero-meta">${esc(data.meta)}</div>`:''}</div><div class="hero-score"><span>${esc(data.heroLabel || 'TOTAL POINTS')}</span><strong>${esc(data.heroValue || '0')}</strong><small>${esc(data.heroDetail || '')}</small></div></section>${cards?`<section><div class="section-head"><h2>${esc(data.cardsTitle || 'At a glance')}</h2><span>${esc(data.cardsMeta || '')}</span></div><div class="metric-grid">${cards}</div></section>`:''}${chart}${sectionsWrapped}<footer class="report-footer"><span>DOTIS · ${esc(data.role || 'REPORT')}</span><span>${esc(data.footer || 'Dashboard export')}</span></footer></main></body></html>`;
  }

  function printReport(data) {
    const popup = window.open('', '_blank');
    if (!popup) {
      const msg = 'Allow pop-ups to open the PDF export preview.';
      if (typeof window.showToast === 'function') window.showToast(msg); else if (typeof window.toast === 'function') window.toast(msg);
      return;
    }
    popup.document.open();
    popup.document.write(reportHtml(data));
    popup.document.close();
    const fontsReady = popup.document.fonts && popup.document.fonts.ready ? popup.document.fonts.ready.catch(()=>{}) : Promise.resolve();
    const logo = popup.document.querySelector('.report-logo');
    const imageReady = logo ? (logo.complete ? Promise.resolve() : new Promise(resolve=>{logo.onload=resolve;logo.onerror=resolve})) : Promise.resolve();
    Promise.all([fontsReady,imageReady]).then(()=>window.setTimeout(()=>{if(!popup.closed){popup.focus();popup.print()}},220));
    const msg = 'Use “Save as PDF” in the print dialog to download this report.';
    if (typeof window.showToast === 'function') window.showToast(msg); else if (typeof window.toast === 'function') window.toast(msg);
  }

  window.dotisPrintPdfReport = printReport;
  window.dotisPdfExportMenu = function(pdfAction,csvAction,reportId,label='Export') {
    const id = reportId == null ? '' : ` data-report-id="${esc(reportId)}"`;
    return `<details class="dotis-pdf-export"><summary aria-label="${esc(label)} report formats" title="Choose a report format"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M5 16v4h14v-4"/></svg><span>${esc(label)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></summary><div class="dotis-pdf-export__menu" role="group" aria-label="Export formats"><button type="button" data-dotis-pdf-export="${esc(pdfAction)}"${id}>Save as PDF</button><button type="button" data-dotis-csv-export="${esc(csvAction)}"${id}>Download CSV</button></div></details>`;
  };

  document.addEventListener('click',function(event){
    const button=event.target.closest('[data-dotis-pdf-export],[data-dotis-csv-export]');
    if(!button)return;
    event.preventDefault();
    const details=button.closest('details');if(details)details.open=false;
    const action=button.dataset.dotisPdfExport||button.dataset.dotisCsvExport;
    const handler=window[action];if(typeof handler!=='function')return;
    const id=button.dataset.reportId;
    if(id!==undefined)handler(id);else handler();
  });

  function chartFromInstance(instance,title,range){
    if(!instance||!instance.data)return {title,range,labels:[],values:[]};
    return {title,range,labels:instance.data.labels||[],values:instance.data.datasets&&instance.data.datasets[0]?instance.data.datasets[0].data||[]:[]};
  }

  if (typeof CAMPAIGNS !== 'undefined' && typeof S !== 'undefined') {
    const overviewExport = document.querySelector('.overview-page-head > .overview-export-btn');
    if (overviewExport) overviewExport.outerHTML = window.dotisPdfExportMenu('exportUserOverviewPDF','exportOverviewReport',null,'Export');
    const originalShowCampaignReport = window.showCampaignReport;
    if (typeof originalShowCampaignReport === 'function') {
      window.showCampaignReport = function () {
        const result = originalShowCampaignReport.apply(this, arguments);
        const index = arguments[0];
        const csvButton = document.querySelector('#camp-report-panel .report-export-btn');
        if (csvButton) csvButton.outerHTML = window.dotisPdfExportMenu('exportUserCampaignPDF','exportCampaignReport',index,'Export');
        return result;
      };
    }

    window.exportUserOverviewPDF = function(){
      const model=buildOverviewChartModel(),campaigns=getOverviewCampaigns(),monthPoints=Number(getPointsEarnedForMonth(S._monthDate))||0,balance=Number(S._bal)||0,recipient=S.donationCharity||S.charity||'Not selected';
      const chart=charts&&charts['overview-performance-chart']?chartFromInstance(charts['overview-performance-chart'],model.title,model.tag):{title:model.title,range:model.tag,labels:model.labels||[],values:model.values||[]};
      const progressRows=campaigns.slice(0,4).map(c=>{const target=Number(c.pointsTarget)||0,raised=Number(c.pointsRaised)||0,pct=target?Math.min(100,Math.round(raised/target*100)):0;return {title:c.name,subtitle:`${c.charity} · ${(Number(c.participants)||0).toLocaleString()} participants`,value:`${fmt(raised)} / ${fmt(target)} pts`,tag:`${pct}%`,progress:pct,tone:'green'};});
      printReport({role:'USER REPORT',ribbon:'Your Dotis impact',range:model.tag||'Current month',kicker:'MONTHLY IMPACT',title:'My impact report',subtitle:'A clear summary of points earned, your monthly giving, and campaign progress.',meta:`Monthly recipient · ${recipient}`,heroLabel:'POINTS THIS MONTH',heroValue:fmt(monthPoints,2),heroDetail:`Lifetime balance · ${fmt(balance,2)} pts`,cardsTitle:'Giving snapshot',cards:[{label:'Lifetime balance',value:`${fmt(balance,2)} pts`,detail:'Available in your account'},{label:'Monthly recipient',value:recipient,detail:'Your current giving preference'},{label:'Campaigns followed',value:String(campaigns.length),detail:'Included in this report'}],chart,sections:[{title:'Campaign progress',meta:`${campaigns.length} campaigns`,rows:progressRows,empty:'Choose or follow a campaign to see progress here.'}],footer:'My impact report'});
    };

    window.exportUserCampaignPDF = function(index){
      const campaign=CAMPAIGNS[Number(index)];if(!campaign)return;
      const state=getCampaignState(campaign),history=campaign.reportHistory||{},raised=Number(campaign.pointsRaised)||0,target=Number(campaign.pointsTarget)||0,participants=Number(campaign.participants)||0,pct=target?Math.min(100,Math.round(raised/target*100)):0;
      const labels=history.labels||['Current'],values=history.points||[raised],people=history.participants||[participants];
      const rows=labels.slice(0,4).map((period,i)=>({title:period,subtitle:`${fmt(people[i]||0)} participants`,value:`${fmt(values[i]||0)} pts`,tone:'green'}));
      printReport({role:'USER REPORT',ribbon:'Campaign performance',range:history.range||'Campaign to date',kicker:'CAMPAIGN REPORT',title:campaign.name,subtitle:`Supporting ${campaign.charity} · ${state.label}`,meta:`${campaign.slug?'dotis.app/c/'+campaign.slug:'Campaign progress'}`,heroLabel:'POINTS RAISED',heroValue:fmt(raised),heroDetail:`of ${fmt(target)} pts · ${pct}% of goal`,cardsTitle:'Campaign snapshot',cards:[{label:'Participants',value:fmt(participants),detail:'Campaign contributors'},{label:'Campaign goal',value:`${fmt(target)} pts`,detail:'Dotis Points target'},{label:'Goal progress',value:`${pct}%`,detail:'Raised to date'}],chart:{title:'Points raised by period',range:history.range||'Campaign to date',labels,values},sections:[{title:'Campaign activity',meta:`${rows.length} periods`,rows,empty:'Campaign activity will appear here as points are raised.'}],footer:'Campaign report'});
    };
  }

  if (typeof D !== 'undefined' && typeof OVERVIEW_STATS !== 'undefined') {
    const replaceOverviewExport = function () {
      if (typeof currentPage !== 'undefined' && currentPage !== 'overview') return;
      const oldButton = document.querySelector('#page-content .export-action[onclick*="exportOverviewCsv"]');
      if (oldButton) oldButton.outerHTML = window.dotisPdfExportMenu('exportAdminOverviewPDF','exportOverviewCsv',null,'Export');
    };
    const pageContent = document.getElementById('page-content');
    if (pageContent && window.MutationObserver) {
      const observer = new MutationObserver(replaceOverviewExport);
      observer.observe(pageContent,{childList:true,subtree:true});
      replaceOverviewExport();
    }
    const originalOpenCampaignReport = window.openCampaignReport;
    if (typeof originalOpenCampaignReport === 'function') {
      window.openCampaignReport = function (id) {
        const result = originalOpenCampaignReport.apply(this,arguments);
        const csvButton = document.querySelector('#modal-root .campaign-report-meta .report-export');
        if (csvButton) csvButton.outerHTML = window.dotisPdfExportMenu('exportAdminCampaignPDF','exportCampaignReportCsv',id,'Export');
        return result;
      };
    }

    window.exportAdminOverviewPDF = function(){
      const chart=chartInstances&&chartInstances['overview-performance-chart'];
      const metric=overviewMetric||'points',metricLabel=OVERVIEW_STATS[metric]&&OVERVIEW_STATS[metric].label||'Dotis Points';
      let trend=chartFromInstance(chart,metricLabel,`Last ${overviewRange||30} days`);
      if(!trend.values.length)trend={title:metricLabel,range:`Last ${overviewRange||30} days`,labels:['May','Jun','Jul','Aug','Sep','Oct'],values:metric==='users'?[380,520,610,760,890,1040]:metric==='campaigns'?[31,34,33,37,39,42]:metric==='donations'?[12,18,15,23,21,30]:[16800,19200,22100,25800,29700,34600]};
      const pendingCampaigns=D.campaignApplications.filter(x=>x.status==='Pending').length,pendingCharities=D.charitySubmissions.filter(x=>x.status==='Pending').length,proofOpen=D.proofRequests.filter(x=>x.status!=='Completed').length,donations=overviewDonationTotals(30);
      const topCampaigns=D.campaigns.slice().sort((a,b)=>(Number(b.raised)||0)-(Number(a.raised)||0)).slice(0,2).map(c=>({title:c.name,subtitle:`${c.charity} · ${fmt(c.participants)} participants`,value:`${fmt(c.raised)} / ${fmt(c.target)} pts`,tag:`${c.target?Math.round(c.raised/c.target*100):0}%`,progress:c.target?Math.min(100,Math.round(c.raised/c.target*100)):0,tone:'green'}));
      printReport({role:'ADMIN REPORT',ribbon:'Platform snapshot',range:`Last ${overviewRange||30} days`,kicker:'ADMIN OVERVIEW',title:'Platform overview',subtitle:'A quick view of platform growth, charitable activity, and items requiring review.',meta:`Generated ${localReportTimestamp()}`,heroLabel:'DOTIS POINTS THIS MONTH',heroValue:fmt(OVERVIEW_STATS.points.current),heroDetail:`${overviewPercent(OVERVIEW_STATS.points.current,OVERVIEW_STATS.points.previous)} vs. previous 30 days`,cardsTitle:'At a glance',cards:[{label:'New users',value:fmt(OVERVIEW_STATS.users.current),detail:`${overviewPercent(OVERVIEW_STATS.users.current,OVERVIEW_STATS.users.previous)} vs previous period`},{label:'Active campaigns',value:fmt(OVERVIEW_STATS.campaigns.current),detail:'Across all causes'},{label:'Records due',value:fmt(donations.due),detail:'Awaiting proof or review'}],chart:trend,sections:[{title:'Action center',meta:`${pendingCampaigns+pendingCharities+proofOpen} open items`,rows:[{title:'Campaign applications',subtitle:'Pending review',value:String(pendingCampaigns),tag:'Pending',tone:'amber'},{title:'Charity applications',subtitle:'Pending verification',value:String(pendingCharities),tag:'Pending',tone:'amber'},{title:'Proof requests',subtitle:'Awaiting review',value:String(proofOpen),tag:'Open',tone:'red'}]},{title:'Campaign overview',meta:'Top active campaigns',rows:topCampaigns}],footer:'Platform overview'});
    };

    window.exportAdminCampaignPDF = function(id){
      const campaign=D.campaigns.find(c=>c.id===id);if(!campaign)return;
      const records=D.contributions.filter(x=>x.campaign===campaign.name).slice(0,4),target=Number(campaign.target)||0,raised=Number(campaign.raised)||0,progress=target?Math.min(100,Math.round(raised/target*100)):0;
      let chart=chartFromInstance(chartInstances&&chartInstances['campaign-report-chart'],'Daily contribution activity','Last 45 days');
      if(!chart.values.length)chart={title:'Contribution activity',range:'Campaign to date',labels:records.map(x=>x.date),values:records.map(x=>Number(x.points)||0)};
      const activityRows=records.map(x=>({title:x.ref,subtitle:`${x.date} · ${x.user}`,value:`${fmt(x.points,2)} pts`,tag:x.status,tone:x.status==='Recorded'?'green':x.status==='Flagged'?'red':'amber'}));
      printReport({role:'ADMIN REPORT',ribbon:'Campaign performance',range:'Campaign to date',kicker:'CAMPAIGN REPORT',title:campaign.name,subtitle:`Supporting ${campaign.charity} · ${campaign.status}`,meta:`${campaign.id} · ${campaign.organizer||'Campaign owner not listed'}`,heroLabel:'POINTS RAISED',heroValue:`${fmt(raised)} pts`,heroDetail:`of ${fmt(target)} pts · ${progress}% of goal`,cardsTitle:'Campaign snapshot',cards:[{label:'Participants',value:fmt(campaign.participants),detail:'Campaign contributors'},{label:'Campaign goal',value:`${fmt(target)} pts`,detail:'Dotis Points target'},{label:'Goal progress',value:`${progress}%`,detail:'Raised to date'}],chart,sections:[{title:'Linked contributions',meta:`${records.length} shown`,rows:activityRows,empty:'No contribution records are linked to this campaign yet.'}],footer:'Campaign report'});
    };
  }
})();
