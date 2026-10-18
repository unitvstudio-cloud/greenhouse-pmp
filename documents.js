// Local document workflow. Sign-off records are not authenticated signatures.
let docSelected='',docFilter='';
const docClone=x=>JSON.parse(JSON.stringify(x));
function docEnsure(q=p()){if(!Array.isArray(q.documents))q.documents=[];return q.documents}
const docTemplate=id=>DOC_TEMPLATES.find(t=>t.id===id);
function docValidateProject(q){
 if(q.documents===undefined)return;
 if(!Array.isArray(q.documents))throw Error('문서 목록 형식 오류');
 const ids=new Set();
 for(const d of q.documents){
  const t=d&&docTemplate(d.templateId);
  if(!t||typeof d.id!=='string'||ids.has(d.id)||!Number.isSafeInteger(d.revision)||d.revision<1||!['초안','반려','검토 중','승인 대기','승인'].includes(d.status)||!Array.isArray(d.history)||!d.source||!['project','blank','example'].includes(d.source.mode))throw Error('문서 메타데이터 형식 오류');
  ids.add(d.id);
  const valid=x=>x&&typeof x.author==='string'&&x.values&&t.fields.every(f=>typeof x.values[f.key]==='string')&&Array.isArray(x.checks)&&x.checks.length===t.checklist.length&&x.checks.every(v=>typeof v==='boolean');
  if(!valid(d)||d.history.some(h=>!h||!valid(h.snapshot)||!Number.isSafeInteger(h.snapshot.revision)))throw Error('문서 본문 또는 이력 형식 오류');
 }
}
const docCurrent=()=>docEnsure().find(d=>d.id===docSelected);
function docPersist(){localStorage.setItem(KEY,JSON.stringify(state))}
let docTransactionDepth=0;
function docTransaction(fn){const before=docClone(state),sel=docSelected;docTransactionDepth++;try{const out=fn();if(docTransactionDepth===1)docPersist();return out}catch(e){state=before;docSelected=sel;throw e}finally{docTransactionDepth--}}
function docSafe(fn){try{fn();render()}catch(e){alert(e.message)}}
function docSnapshot(d){return docClone({revision:d.revision,status:d.status,values:d.values,checks:d.checks,author:d.author,reviewer:d.reviewer,approver:d.approver,source:d.source})}
function docEvent(d,action,actor,note){d.history.push({at:new Date().toISOString(),action,actor,note,snapshot:docSnapshot(d)})}
function docSeed(t,q){const rows=(key)=>JSON.stringify(q[key]||[],null,2),v={};
 const map={
 'PMP-01':[q.objective,'',q.scope,q.governance,q.governance],
 'PMP-04':['',q.scope+'\n'+q.start+' ~ '+q.end+'\n예산 '+won(q.budget),q.governance,'',q.decision],
 'PMP-06':[q.decision,q.governance,'',q.mmCadence,''],
 'PMP-07':[rows('stakeholders'),'','','',''],
 'PMP-09':[q.mmReport,q.mmCadence+' / '+q.mmChannel,q.pm,q.mmEscalation,''],
 'PMP-12':[q.scope,q.exclusions,q.criteria,'',q.governance],
 'PMP-16':[rows('tasks'),'','','',''],
 'PMP-17':[q.start+' ~ '+q.end,rows('tasks'),'','',''],
 'PMP-18':[iso(),rows('tasks'),'','',''],
 'PMP-20':[won(q.budget),'','','',''],
 'PMP-21':[iso()+' / '+won(q.budget),won(q.actualCost),'','',''],
 'PMP-22':[rows('resources'),'','','',''],
 'PMP-28':[rows('risks'),'','','',''],
 'PMP-31':[rows('mmMeetings'),'','','','']};
 t.fields.forEach((f,i)=>v[f.key]=String((map[t.id]||[])[i]||''));return v;
}
function docCreate(templateId,mode='project') {return docTransaction(()=>{
 const t=docTemplate(templateId);if(!t)throw Error('알 수 없는 서식입니다.');
 const values=mode==='example'?Object.fromEntries(t.fields.map(f=>[f.key,f.example])):mode==='blank'?Object.fromEntries(t.fields.map(f=>[f.key,''])):docSeed(t,p());
 const d={id:uid()+uid(),templateId,revision:1,status:'초안',values,checks:t.checklist.map(()=>false),author:'',reviewer:null,approver:null,source:{mode,project:p().name,at:new Date().toISOString()},history:[]};
 docEvent(d,'생성','시스템',mode==='example'?'가상 실무 예시':mode==='blank'?'빈 양식':'프로젝트 자료로 초안 생성; 미입력 항목 보완 필요');docEnsure().push(d);docSelected=d.id;return d.id;
})}
function docBatch(){docTransaction(()=>{for(const t of DOC_TEMPLATES)if(!docEnsure().some(d=>d.templateId===t.id))docCreate(t.id)});render()}
function docSave(values,author,note,checks){return docTransaction(()=>{
 const d=docCurrent();if(!d)throw Error('문서를 선택하세요.');
 if(!['초안','반려'].includes(d.status))throw Error('검토 중·승인 문서는 수정할 수 없습니다.');
 if(!author.trim())throw Error('작성자를 입력하세요.');
 const t=docTemplate(d.templateId);d.values=Object.fromEntries(t.fields.map(f=>[f.key,String(values[f.key]??'')]));d.author=author.trim();d.checks=t.checklist.map((_,i)=>!!checks[i]);
 d.reviewer=null;d.approver=null;d.status='초안';docEvent(d,'편집 저장',d.author,note.trim()||'내용 수정');
})}
function docTransition(action,actor,note){return docTransaction(()=>{
 const d=docCurrent();if(!d)throw Error('문서를 선택하세요.');actor=actor.trim();note=note.trim();
 if(!actor||!note)throw Error('처리자 이름과 의견을 모두 입력하세요.');
 if(action==='검토 요청'){
   if(!['초안','반려'].includes(d.status))throw Error('초안 또는 반려 문서만 요청할 수 있습니다.');
   if(!d.author||Object.values(d.values).some(v=>!v.trim())||!d.checks.every(Boolean))throw Error('작성자·모든 필드·체크리스트를 완료하세요. 해당 없음은 사유와 함께 적으세요.');
   if(d.source.mode==='example')throw Error('가상 예시는 승인할 수 없습니다. 빈 양식이나 프로젝트 초안을 사용하세요.');
   d.status='검토 중';d.reviewer=null;d.approver=null;
 }else if(action==='검토 완료'){
   if(d.status!=='검토 중'||actor===d.author)throw Error('검토 중 문서를 작성자와 다른 검토자가 처리해야 합니다.');
   d.status='승인 대기';d.reviewer={name:actor,note,at:new Date().toISOString(),revision:d.revision};
 }else if(action==='승인'){
   if(d.status!=='승인 대기'||actor===d.author)throw Error('검토 완료 후 작성자와 다른 승인자가 처리해야 합니다.');
   d.status='승인';d.approver={name:actor,note,at:new Date().toISOString(),revision:d.revision};
 }else if(action==='반려'){
   if(!['검토 중','승인 대기'].includes(d.status))throw Error('검토 또는 승인 대기 문서만 반려할 수 있습니다.');d.status='반려';d.reviewer=null;d.approver=null;
 }else if(action==='새 개정'){
   if(d.status!=='승인')throw Error('승인된 문서만 새 개정할 수 있습니다.');d.revision++;d.status='초안';d.reviewer=null;d.approver=null;d.checks=d.checks.map(()=>false);
 }else if(action==='요청 철회'){
   if(!['검토 중','승인 대기'].includes(d.status))throw Error('처리 중 문서만 철회할 수 있습니다.');d.status='초안';d.reviewer=null;d.approver=null;
 }else throw Error('지원하지 않는 처리입니다.');
 docEvent(d,action,actor,note);
})}
function docSaveUI(){const t=docTemplate(docCurrent().templateId);docSave(Object.fromEntries(t.fields.map(f=>[f.key,$('doc_'+f.key).value])),$('doc_author').value,$('doc_note').value,t.checklist.map((_,i)=>$('doc_check'+i).checked))}
function docActionUI(action){docSafe(()=>docTransition(action,$('doc_actor').value,$('doc_opinion').value))}
function docApproval(d){return `<table><tr><th>작성</th><th>검토</th><th>승인</th></tr><tr><td>${esc(d?.author||'성명 / 일자 / 서명:')}</td><td>${esc(d?.reviewer?d.reviewer.name+' / '+d.reviewer.at:'성명 / 일자 / 의견:')}</td><td>${esc(d?.approver?d.approver.name+' / '+d.approver.at:'성명 / 일자 / 의견:')}</td></tr></table>`}
function docGuide(t){return `<h3>목적 · 작성 시점</h3><p>${esc(t.purpose)} · ${esc(t.timing)}</p><h3>작성법</h3><ol>${t.guide.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`}
function docFields(t,values){return t.fields.map(f=>`<section class="df"><h3>${esc(f.label)}</h3><div class="value">${esc(values?.[f.key]||'\n\n')}</div></section>`).join('')}
function docChecklist(t,d){return `<h3>체크리스트</h3>${t.checklist.map((x,i)=>`<p>${d?.checks[i]?'[확인]':'[  ]'} ${esc(x)}</p>`).join('')}`}
const DOC_CSS=`@page{size:A4;margin:16mm}body{font:12px 'Malgun Gothic',sans-serif;color:#193b32;line-height:1.6;margin:0}h1{font-size:24px}h2{font-size:20px;border-bottom:2px solid #18745c;padding-bottom:8px}h3{font-size:13px;margin:10px 0 4px}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #bbcfc5;padding:8px;text-align:left;overflow-wrap:anywhere}p{margin:5px 0}.value{white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #d4dfd9;padding:8px;min-height:38px;color:#172e28}.df{break-inside:avoid}.sheet{break-before:page}.muted{color:#61766c}button{padding:10px;margin:10px}@media print{button{display:none}}`;
function docPrintHTML(d){const t=docTemplate(d.templateId);return docWrap(`${t.name} · 개정 ${d.revision}`,`<h1>${esc(t.name)}</h1><p>${esc(d.source.project)} / ${esc(t.id)} / 개정 ${d.revision} / 상태: ${esc(d.status)}</p><p>생성 자료: ${esc(d.source.mode)} / ${esc(d.source.at)}</p>${docGuide(t)}${docFields(t,d.values)}${docChecklist(t,d)}${docApproval(d)}<h3>검토·승인 의견</h3><p>${esc(d.reviewer?.note||'미검토')}</p><p>${esc(d.approver?.note||'미승인')}</p><h3>변경 이력</h3>${d.history.map(h=>`<p>${esc(h.at)} · r${h.snapshot.revision} · ${esc(h.action)} · ${esc(h.actor)} · ${esc(h.note)}</p>`).join('')}<p class="muted">로컬 처리 기록이며 본인 인증·전자서명 증명이 아닙니다.</p>`)}
function docWrap(title,body){return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${DOC_CSS}</style></head><body><button onclick="window.print()">인쇄 / PDF로 저장</button>${body}</body></html>`}
function docHandbook(){return docWrap('PMBOK 8판 기반 한국어 실무 서식 32종',`<h1>프로젝트 관리 실무 서식집</h1><h2>32종 · 한국어 · V4.0</h2><p>2026-10-18 / 온실 작기 프로젝트 적용</p><p>PMI 공식 개요에 제시된 7개 성과영역을 바탕으로 구성한 자체 실무 양식입니다. 공식 번역본 또는 필수 서식 목록이 아닙니다. 예시는 모두 가상이며 실제 실적이나 승인 기록이 아닙니다.</p><p>프로젝트의 규모와 위험에 따라 조정하고, 계약·조직의 승인 규칙과 함께 사용하세요.</p><p>출처: https://www.pmi.org/standards/pmbok (확인 2026-10-18)</p><h3>목차</h3><div style="columns:2;column-gap:20px">${DOC_TEMPLATES.map(t=>`<p>${t.id} ${esc(t.name)} · ${t.domain}</p>`).join('')}</div>`+DOC_TEMPLATES.map(t=>`<article class="sheet"><h2>${t.id} ${esc(t.name)}</h2><p>성과영역: ${t.domain} · 빈 양식</p><p>프로젝트: ____________________　문서번호: __________　개정: ____</p>${docGuide(t)}${docFields(t)}${docChecklist(t)}${docApproval()}</article><article class="sheet"><h2>${t.id} 작성 예시 · ${esc(t.name)}</h2><p>가상 온실 프로젝트 예시 / 실제 승인·실적 아님</p>${docFields(t,Object.fromEntries(t.fields.map(f=>[f.key,f.example])))}${docChecklist(t)}${docApproval()}<h3>적용 메모</h3><p>예시의 숫자·일정·인명은 해당 프로젝트의 검증된 자료로 바꾸고, 출처와 기준일을 남기세요. 누락 항목은 임의로 사실로 채우지 말고 담당자에게 확인합니다.</p></article>`).join(''))}
function docOpenPrint(book=false){const html=book?docHandbook():docPrintHTML(docCurrent());const w=window.open('','_blank');if(!w){alert('인쇄창을 열 수 없습니다. 팝업을 허용하세요.');return}w.document.open();w.document.write(html);w.document.close()}
function documentsPage(){const docs=docEnsure(),d=docCurrent(),t=d&&docTemplate(d.templateId);return panelOpen('문서관리 · 32종 실무 서식','프로젝트 자료로 초안 생성 → 편집 저장 → 검토 → 승인 → 새 개정. 자동생성은 저장된 자료를 배치하는 규칙 기반 기능입니다.')+`<p class="tabnote">승인은 이 브라우저에 남기는 업무 기록입니다. 이름 입력은 본인 인증이 아니며 다른 사용자와 자동 동기화되지 않습니다. v3 자료는 별도 보존됩니다.</p><div class="actions"><button onclick="docSafe(()=>docBatch())">없는 서식 32종 일괄 생성</button><button class="secondary" onclick="docOpenPrint(true)">32종 서식집 PDF / 인쇄</button><button class="secondary" onclick="exportJSON()">문서 포함 전체 백업</button></div><div class="grid" style="margin-top:15px"><label>서식 선택<select id="doc_template">${DOC_TEMPLATES.map(x=>`<option value="${x.id}">${x.id} ${esc(x.name)}</option>`).join('')}</select></label><label>생성 방법<select id="doc_mode"><option value="project">현재 프로젝트 자료</option><option value="blank">빈 양식</option><option value="example">가상 실무 예시 (승인 불가)</option></select></label></div><p><button onclick="docSafe(()=>docCreate($('doc_template').value,$('doc_mode').value))">문서 생성</button></p><label>문서 검색<input aria-label="문서 검색" value="${esc(docFilter)}" onchange="docFilter=this.value;render()" placeholder="서식명 또는 상태"></label><div class="scroll"><table><tr><th>문서</th><th>개정</th><th>상태</th><th>작성자</th><th>열기</th></tr>${docs.filter(x=>(docTemplate(x.templateId)?.name+' '+x.status).includes(docFilter)).map(x=>`<tr><td>${esc(docTemplate(x.templateId)?.name||x.templateId)}</td><td>${x.revision}</td><td>${esc(x.status)}</td><td>${esc(x.author)}</td><td><button data-doc="${esc(x.id)}" onclick="docSelected=this.dataset.doc;render()">열기</button></td></tr>`).join('')}</table></div>`+panelClose()+(t?panelOpen(`${t.id} ${esc(t.name)}`,`개정 ${d.revision} · ${esc(d.status)} · ${esc(d.source.project)}`)+docGuide(t)+`<details><summary>가상 작성 예시</summary>${docFields(t,Object.fromEntries(t.fields.map(f=>[f.key,f.example])))}</details><fieldset ${['초안','반려'].includes(d.status)?'':'disabled'} style="border:0;padding:0"><label>작성자<input id="doc_author" value="${esc(d.author)}"></label>${t.fields.map(f=>`<label class="field" style="margin:12px 0">${esc(f.label)}<textarea id="doc_${f.key}" rows="4">${esc(d.values[f.key])}</textarea></label>`).join('')}<h3>검토 체크리스트</h3>${t.checklist.map((x,i)=>`<label class="item"><span><input id="doc_check${i}" type="checkbox" style="width:auto" ${d.checks[i]?'checked':''}> ${esc(x)}</span></label>`).join('')}<label>변경 설명<input id="doc_note" placeholder="수정 이유·근거"></label><p><button onclick="docSafe(()=>docSaveUI())">편집 저장</button></p></fieldset><p class="muted">편집 후 반드시 저장한 다음 검토를 요청하세요. 다른 화면으로 이동하면 저장하지 않은 편집은 사라집니다.</p>${docApproval(d)}<div class="grid"><label>처리자<input id="doc_actor"></label><label>검토·승인·변경 의견<input id="doc_opinion"></label></div><div class="actions" style="margin-top:12px">${({'초안':['검토 요청'],'반려':['검토 요청'],'검토 중':['검토 완료','반려','요청 철회'],'승인 대기':['승인','반려','요청 철회'],'승인':['새 개정']}[d.status]||[]).map(a=>`<button onclick="docActionUI('${a}')">${a}</button>`).join('')}<button class="secondary" onclick="docOpenPrint()">저장된 문서 PDF / 인쇄</button></div><h3>변경 이력 · 당시 내용</h3>${d.history.slice().reverse().map(h=>`<details><summary>${esc(h.at)} · r${h.snapshot.revision} · ${esc(h.action)} · ${esc(h.actor)}</summary><p>${esc(h.note)}</p><p>상태: ${esc(h.snapshot.status)}</p>${docFields(t,h.snapshot.values)}${docApproval(h.snapshot)}</details>`).join('')}`+panelClose():'')}
areas.splice(areas.indexOf('데이터'),0,'문서관리');pages['문서관리']=documentsPage;
const docPreviousDuplicate=duplicate;duplicate=function(){docPreviousDuplicate();p().documents=[];save();render()};
