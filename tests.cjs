const fs=require('fs'),vm=require('vm'),assert=require('assert');
const nodes={};let saved={},downloads=[];
const ctx={console,Date,Math,JSON,Number,String,Array,Object,Blob,setTimeout,clearTimeout,alert:()=>{},confirm:()=>true,prompt:()=>null,navigator:{},localStorage:{getItem:k=>saved[k]||null,setItem:(k,v)=>saved[k]=v},document:{getElementById:id=>nodes[id]||(nodes[id]={innerHTML:'',value:''})}};
Object.defineProperty(ctx,'top',{value:ctx,writable:false,configurable:false});
vm.createContext(ctx);vm.runInContext(fs.readFileSync('index.html','utf8').split('<script>')[1].split('</script>')[0],ctx);
function run(code){return vm.runInContext(code,ctx)}
run(`download=(name,blob)=>{}`);
let count=0;function test(name,code){run(code);count++;console.log('PASS '+name)}
test('All existing and new views render',`for(const name of Object.keys(pages)){view=name;render();if(!$('content').innerHTML)throw Error(name)}`);
test('Korean calendar day offset',`if(offset('2026-10-17',0)!=='2026-10-17'||offset('2026-10-17',1)!=='2026-10-18')throw Error('date');`);
test('Tomato, wild chive and generic templates',`for(const crop of ['토마토','달래','오이']){const q=blank(crop);if(q.crop!==crop||!q.tasks.length||!q.risks.length)throw Error(crop)}`);
test('Original V3 data receives additive defaults',`const q=blank();delete q.mmIncidents;const before=JSON.stringify(q.tasks);mmEnsure(q);if(q.mmAgreement!=='미합의'||JSON.stringify(q.tasks)!==before)throw Error('migration')`);
test('Incidents, meetings and feedback can be edited',`for(const key of ['mmIncidents','mmMeetings','mmFeedbackLog']){mmAdd(key);cell(key,0,'owner','담당자');if(p()[key][0].owner!=='담당자')throw Error(key)}`);
test('Risk and overdue alerts',`update('mmRiskReviewed',true);update('mmProbability',5);update('mmImpact',5);p().mmIncidents[0].due='2000-01-01';if(mmStats().score!==25||mmStats().late!==1||!advice().some(x=>x.title==='마이크로매니징 고위험'))throw Error('risk')`);
test('Closing incident clears overdue',`p().mmIncidents[0].status='종결';if(mmStats().late!==0)throw Error('closed')`);
test('HTML injection escaped',`p().mmCause='<img src=x onerror=alert(1)>';if(sponsorPage().includes('<img src=x'))throw Error('injection')`);
test('Copy resets approvals and incident histories',`update('mmAgreement','합의 완료');duplicate();if(p().mmAgreement!=='미합의'||p().mmIncidents.length||p().mmRiskReviewed)throw Error('copy')`);
test('Project isolation',`const first=state.projects[0];p().mmCause='복사 작기 원인';if(first.mmCause===p().mmCause)throw Error('isolation')`);
test('JSON roundtrip preserves sponsor data and original tasks',`save();const parsed=JSON.parse(localStorage.getItem(KEY));if(parsed.projects.length!==2||!parsed.projects[1].tasks.length||parsed.projects[1].mmCause!=='복사 작기 원인')throw Error('persist')`);
test('Sponsor HTML report generation',`mmReport()`);
test('Existing reports and exports',`downloadReport();exportJSON();exportCSV()`);
test('Deletion of new rows',`mmAdd('mmMeetings');delRow('mmMeetings',0);if(p().mmMeetings.length)throw Error('delete')`);
console.log(count+' tests passed');

