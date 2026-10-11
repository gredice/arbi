import {createHash} from 'node:crypto';
import {readFileSync,lstatSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
export const catalog=JSON.parse(readFileSync(new URL('./release-evidence-catalog.json',import.meta.url),'utf8'));
const text=v=>typeof v==='string'&&v.length>0&&v.length<=256;
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const commit=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function exact(v,keys){if(!object(v)||Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k)))throw Error('INVALID_EVIDENCE_SHAPE');}
function bounded(v,max=256){if(!Array.isArray(v)||v.length>max)throw Error('EVIDENCE_CAPACITY');}
const unique=values=>new Set(values).size===values.length;
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export const procedureDigest=procedure=>createHash('sha256').update(canonical({id:procedure.id,reviewerId:procedure.reviewerId,limits:procedure.limits})).digest('hex');
export function validateCatalog(){
  if(catalog.version!=='arbi.release-evidence-catalog/1.0'||!unique(catalog.tests.map(t=>t.id))||!unique(catalog.requirements.map(r=>r.id)))throw Error('INVALID_CATALOG');
  for(const requirement of catalog.requirements)if(!text(requirement.ownerRole)||!catalog.hazards.includes(requirement.hazard)||!catalog.tests.some(t=>t.requirements.includes(requirement.id)))throw Error('UNCOVERED_REQUIREMENT');
  for(const test of catalog.tests)if(!text(test.name)||!text(test.ownerRole)||!text(test.reviewerRole)||!catalog.stages.some(s=>s.id===test.stage)||!existsSync(resolve(root,test.definition))||!test.requirements.length||test.requirements.some(id=>!catalog.requirements.some(r=>r.id===id)))throw Error('INVALID_TEST_MAPPING');
  for(const stage of catalog.stages)if(!['entry','exit','instruments','stopConditions'].every(k=>Array.isArray(stage[k])&&stage[k].length)||!text(stage.acceptedConfiguration)||!text(stage.reviewer))throw Error('MISSING_STAGE_CRITERIA');
  return true;
}
function artifactPath(file){if(!text(file)||isAbsolute(file)||file.split(/[\\/]/).some(p=>p==='..'||p==='.'||!p))throw Error('INVALID_ARTIFACT_PATH');return file;}
function checkedArtifact(record,readArtifact){
  exact(record.artifact,['file','sha256']);if(!sha(record.artifact.sha256))throw Error('INVALID_ARTIFACT_IDENTITY');
  const bytes=readArtifact(artifactPath(record.artifact.file));if(!Buffer.isBuffer(bytes)||bytes.length>524288||createHash('sha256').update(bytes).digest('hex')!==record.artifact.sha256)throw Error('RAW_ARTIFACT_MISMATCH');
  const raw=JSON.parse(bytes.toString('utf8'));exact(raw,['version','testId','sourceCommit','configurationDigest','provenance','targetRevision','realFirmware','controlledSubstitutes','stopConditionsRespected','modelComparisonDigest','measurements']);
  if(raw.version!=='arbi.release-test-evidence/1.0'||raw.testId!==record.testId||raw.sourceCommit!==record.sourceCommit||raw.configurationDigest!==record.configurationDigest||!['source','simulation','physical-measurement'].includes(raw.provenance)||typeof raw.realFirmware!=='boolean'||typeof raw.controlledSubstitutes!=='boolean'||typeof raw.stopConditionsRespected!=='boolean')throw Error('RAW_ARTIFACT_IDENTITY');
  bounded(raw.measurements,64);return raw;
}
/** Evidence inventory only: never deploys, enables motion, or grants field authority. */
export function evaluateReleaseEvidence(input,{readArtifact=()=>{throw Error('RAW_ARTIFACT_UNAVAILABLE');}}={}){
  validateCatalog();exact(input,['version','release','records']);if(input.version!=='arbi.release-evidence-input/1.0')throw Error('INVALID_EVIDENCE_VERSION');
  const release=input.release;exact(release,['sourceCommit','configurationDigest','hardwareRevisions','ownerAssignments','procedures','recordingEnabled']);
  if(!commit(release.sourceCommit)||!(release.configurationDigest===null||sha(release.configurationDigest))||typeof release.recordingEnabled!=='boolean')throw Error('INVALID_RELEASE_IDENTITY');
  for(const map of [release.hardwareRevisions,release.ownerAssignments,release.procedures])if(!object(map)||Object.keys(map).length>64)throw Error('INVALID_RELEASE_BINDINGS');
  const roles=new Set(catalog.requirements.map(r=>r.ownerRole));for(const [role,id] of Object.entries(release.ownerAssignments))if(!roles.has(role)||!text(id))throw Error('INVALID_OWNER_ASSIGNMENT');
  const targets=new Set(catalog.tests.map(t=>t.target));for(const [target,revision] of Object.entries(release.hardwareRevisions))if(!targets.has(target)||!text(revision))throw Error('INVALID_TARGET_REVISION');
  for(const [stage,procedure] of Object.entries(release.procedures)){
    if(!catalog.stages.slice(2).some(s=>s.id===stage))throw Error('INVALID_STAGE_PROCEDURE');exact(procedure,['id','sha256','reviewerId','limits']);
    if(!text(procedure.id)||!sha(procedure.sha256)||!text(procedure.reviewerId)||!object(procedure.limits)||Object.keys(procedure.limits).length>64)throw Error('INVALID_STAGE_PROCEDURE');
    if(procedure.sha256!==procedureDigest(procedure))throw Error('PROCEDURE_DIGEST_MISMATCH');
    for(const limit of Object.values(procedure.limits)){exact(limit,['minimum','maximum','unit']);if(!Number.isFinite(limit.minimum)||!Number.isFinite(limit.maximum)||limit.minimum>limit.maximum||!text(limit.unit))throw Error('INVALID_MEASUREMENT_LIMIT');}
  }
  bounded(input.records);if(!unique(input.records.map(r=>r.testId)))throw Error('DUPLICATE_TEST_RECORD');
  const records=new Map();for(const record of input.records){
    exact(record,['testId','status','sourceCommit','configurationDigest','procedureSha256','artifact','review']);
    if(!catalog.tests.some(t=>t.id===record.testId)||!['passed','failed','not-applicable'].includes(record.status)||!commit(record.sourceCommit)||!(record.configurationDigest===null||sha(record.configurationDigest))||!(record.procedureSha256===null||sha(record.procedureSha256)))throw Error('INVALID_TEST_RECORD');
    if(record.review!==null){exact(record.review,['reviewerId','role','decision']);if(!text(record.review.reviewerId)||!text(record.review.role)||!['accepted','rejected'].includes(record.review.decision))throw Error('INVALID_REVIEW');}
    records.set(record.testId,record);
  }
  const rows=catalog.tests.map(test=>{
    const record=records.get(test.id),ownerId=release.ownerAssignments[test.ownerRole]??null;
    const row={testId:test.id,name:test.name,stage:test.stage,target:test.target,ownerRole:test.ownerRole,ownerId,status:'missing',reasons:[],artifactSha256:null};
    if(!record){row.reasons.push('evidence-missing');return row;}
    if(record.status==='not-applicable'){
      if(!test.recordingOnly||release.recordingEnabled||record.sourceCommit!==release.sourceCommit||record.configurationDigest!==release.configurationDigest||record.artifact!==null||record.review!==null||record.procedureSha256!==null){row.status='failed';row.reasons.push('invalid-not-applicable');}return row;
    }
    row.status=record.status;
    try{
      if(record.sourceCommit!==release.sourceCommit||record.configurationDigest!==release.configurationDigest)throw Error('RELEASE_IDENTITY_MISMATCH');
      if(!ownerId)throw Error('NAMED_OWNER_MISSING');
      if(!record.review||record.review.role!==test.reviewerRole||record.review.decision!=='accepted')throw Error('REVIEW_NOT_ACCEPTED');
      const raw=checkedArtifact(record,readArtifact);row.artifactSha256=record.artifact.sha256;
      const physical=catalog.stages.findIndex(s=>s.id===test.stage)>=2;
      if(!physical){if(raw.provenance!==test.stage.replace('unit-contract','source')||record.procedureSha256!==null)throw Error('SOURCE_PROVENANCE_MISMATCH');}
      else{
        const procedure=release.procedures[test.stage],revision=release.hardwareRevisions[test.target];
        if(!sha(release.configurationDigest)||!revision||raw.targetRevision!==revision||raw.provenance!=='physical-measurement')throw Error('PHYSICAL_IDENTITY_MISSING');
        if(!procedure||record.procedureSha256!==procedure.sha256||procedure.reviewerId===ownerId||record.review.reviewerId===ownerId)throw Error('INDEPENDENT_PROCEDURE_REVIEW_MISSING');
        if(!raw.stopConditionsRespected||(['secured-frame','installed-site'].includes(test.stage)&&raw.controlledSubstitutes)||(['pico','pod','edge','site'].includes(test.target)&&!raw.realFirmware))throw Error('PHYSICAL_SETUP_NOT_ACCEPTED');
        if(test.stage==='hardware-in-loop'&&!sha(raw.modelComparisonDigest))throw Error('MODEL_COMPARISON_MISSING');
        if(!unique(raw.measurements.map(m=>m.name)))throw Error('DUPLICATE_MEASUREMENT');
        for(const name of test.measurements){const measure=raw.measurements.find(m=>m.name===name),limit=procedure.limits[name];
          if(!measure||!limit)throw Error('MEASUREMENT_OR_PREDEFINED_LIMIT_MISSING');exact(measure,['name','value','unit','instrumentId','uncertainty']);
          if(!Number.isFinite(measure.value)||!Number.isFinite(measure.uncertainty)||measure.uncertainty<0||!text(measure.instrumentId)||measure.unit!==limit.unit||measure.value-measure.uncertainty<limit.minimum||measure.value+measure.uncertainty>limit.maximum)throw Error('MEASUREMENT_OUTSIDE_ACCEPTED_LIMIT');
        }
      }
    }catch(error){row.status=record.status==='failed'?'failed':'missing';row.reasons.push(error.message);}
    return row;
  });
  const disabled=rows.find(r=>r.testId==='recording-disabled');for(const row of rows.filter(r=>catalog.tests.find(t=>t.id===r.testId).recordingOnly)){
    if(!release.recordingEnabled&&disabled.status==='passed'&&row.status==='missing'&&(!records.has(row.testId)||records.get(row.testId).status==='not-applicable'&&row.reasons.length===0)){row.status='not-applicable';row.reasons=[];}
    else if(row.status==='missing'&&!release.recordingEnabled)row.reasons.push('recording-disabled-proof-missing');
  }
  const accepted=row=>['passed','not-applicable'].includes(row.status);
  let earlier=true;const stages=catalog.stages.map(stage=>{const tests=rows.filter(r=>r.stage===stage.id),complete=tests.every(accepted);const physical=catalog.stages.findIndex(s=>s.id===stage.id)>=2;const owners=tests.every(t=>t.ownerId!==null);const bindings=!physical||(sha(release.configurationDigest)&&release.procedures[stage.id]&&tests.filter(t=>t.status!=='not-applicable').every(t=>text(release.hardwareRevisions[t.target])));const entryEligible=earlier&&owners&&Boolean(bindings);earlier=entryEligible&&complete;return {id:stage.id,entryEligible,complete:entryEligible&&complete,criteria:stage};});
  const requirements=catalog.requirements.map(requirement=>{const tests=catalog.tests.filter(t=>t.requirements.includes(requirement.id)).map(t=>rows.find(r=>r.testId===t.id)),ownerId=release.ownerAssignments[requirement.ownerRole]??null;return {...requirement,ownerId,tests:tests.map(t=>t.testId),complete:ownerId!==null&&tests.every(accepted)};});
  return {version:'arbi.release-evidence-index/1.0',release,tests:rows,requirements,stages,complete:requirements.every(r=>r.complete),publicOperationReady:false,authorization:'separate-qualified-physical-and-site-authorization-required',blockers:rows.filter(r=>!accepted(r)).map(r=>({testId:r.testId,stage:r.stage,status:r.status,reasons:r.reasons}))};
}
export function draftInput(sourceCommit){return {version:'arbi.release-evidence-input/1.0',release:{sourceCommit,configurationDigest:null,hardwareRevisions:{},ownerAssignments:{},procedures:{},recordingEnabled:false},records:[]};}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [inputPath,output]=process.argv.slice(2);if(!inputPath||!output||process.argv.length!==4)throw Error('EXPECTED_INPUT_AND_EXCLUSIVE_OUTPUT');
  const out=resolve(output),parent=lstatSync(dirname(out));if(!parent.isDirectory()||(parent.mode&0o077))throw Error('PRIVATE_OUTPUT_DIRECTORY_REQUIRED');
  const draft=inputPath==='--draft';let input,base;
  if(draft){const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();if(git(['status','--porcelain']))throw Error('CLEAN_SOURCE_REQUIRED');input=draftInput(git(['rev-parse','HEAD']));base=root;}
  else{const path=resolve(inputPath),bytes=readFileSync(path);if(bytes.length>1048576)throw Error('INPUT_CAPACITY');input=JSON.parse(bytes.toString('utf8'));base=dirname(path);}
  const report=evaluateReleaseEvidence(input,{readArtifact:file=>{const path=resolve(base,artifactPath(file));if(relative(base,path).startsWith('..'))throw Error('INVALID_ARTIFACT_PATH');const stat=lstatSync(path);if(!stat.isFile()||stat.size>524288)throw Error('RAW_ARTIFACT_UNAVAILABLE');return readFileSync(path);}});
  writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({complete:report.complete,publicOperationReady:false,blockers:report.blockers.length}));if(!draft&&!report.complete)process.exitCode=1;
}
