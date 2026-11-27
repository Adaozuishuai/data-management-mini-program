const {visits,defs}=require('../../catalog')
const db=require('../../store')
const {makeFields,controls}=require('./controls')
const drugs=['维迪西妥单抗','卡介苗（BCG）']
const doseFields=(drug)=>[
 ['是否给药',['是','否']],['实际给药日期',[]],['实际剂量',drug===0?['60','120','180','其他']:[]],
 ['其他剂量数值',[]],['剂量单位',[]],['是否延迟',['是','否']],['是否调整剂量',['是','否']],['原因说明',[]],['剂量调整原因',['不良事件','其他']]
]
Page({
 data:{screen:'home',center:'',subject:'',query:'',visits,review:false,creating:false,tab:'visits'},
 toggleCreate(){this.setData({creating:!this.data.creating})},
 selectTab(e){this.setData({tab:e.currentTarget.dataset.tab})},
 onLoad(){db.seed(visits);this.reload()},
 reload(){const q=this.data.query.trim();const all=db.list();this.setData({total:all.length,centers:new Set(all.map(p=>p.center)).size,patients:all.filter(p=>(p.center+' '+p.subject).includes(q))})},
 input(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value});if(e.currentTarget.dataset.key==='query')this.reload()},
 create(){const {center,subject}=this.data;if(!center.trim()||!subject.trim())return this.toast('请填写两个编号')
 try{this.open(db.create(center.trim(),subject.trim()));this.setData({center:'',subject:'',creating:false})}catch(e){this.toast(e.message)}},
 toast(title){wx.showToast({title,icon:'none'})},
 choose(e){this.setData({tab:'visits'});this.open(e.currentTarget.dataset.id)},
 open(id){const p=db.list().find(x=>x.id===id)
 const timeline=Object.entries(p.records).filter(([k,r])=>r.drug!==undefined).map(([k,r])=>{
 const [v,f]=k.split('/').map(Number);return {v,f,name:drugs[r.drug],date:r.rows[0][1]||p.dates[v]||'',state:({'是':'已给药','否':'未给药'})[r.rows[0][0]]||'草稿',visit:visits[v].name}
 }).sort((a,b)=>b.date.localeCompare(a.date))
 this.setData({screen:'patient',p,timeline})},
 visit(e){this.showVisit(Number(e.currentTarget.dataset.v))},
 showVisit(v){this.open(this.data.p.id)
 const forms=visits[v].forms.map(f=>({...f}))
 if(/诱导期|维持治疗期/.test(visits[v].name))for(const drug of drugs){if(!forms.some(f=>f.name.includes(drug)&&f.name.includes('给药')))forms.push({name:drug+'给药',pages:[],defId:-1,status:'按实际用药补录'})}
 forms.forEach((f,i)=>{f.saved=this.data.p.records[v+'/'+i]?.status||'待填'})
 this.setData({screen:'visit',v,forms})},
 date(e){try{db.update(this.data.p.id,p=>p.dates[this.data.v]=e.detail.value);this.showVisit(this.data.v)}catch(e){this.toast('日期保存失败')}},
 timeline(e){this.showVisit(e.currentTarget.dataset.v);this.edit(e)},
 edit(e){const f=Number(e.currentTarget.dataset.f),form=this.data.forms[f],drug=form.name.includes('给药')?(form.name.includes('BCG')?1:0):undefined
 const [source,base]=defs[form.defId]||['按实际给药补录',[]]
 const rawFields=drug===undefined?[...base,['补充记录（项目、结果、单位）',[]]]:doseFields(drug)
 const entry=this.data.p.records[this.data.v+'/'+f];const initial=form.name==='访视日期'?{0:this.data.p.dates[this.data.v]||''}:{}
 const fields=makeFields(rawFields,drug);
 const gate=fields.findIndex(field=>['受试者是否发生不良事件','是否有合并用药'].includes(field.label))
 if(gate>0)fields.unshift(fields.splice(gate,1)[0])
 if(drug!==undefined)fields.splice(7,0,fields.pop());
 const rows=form.name==='访视日期'?[initial]:entry?.rows||[{}];
 this.dirty=false
 this.setData({screen:'edit',f,form,drug:drug===undefined?-1:drug,fields,source,review:false,patientReport:form.name.includes('EORTC'),rows,groups:controls(fields,rows,drug??-1,form.name)})},
 updateRows(rows){
   this.dirty=true
   this.setData({rows,groups:controls(this.data.fields,rows,this.data.drug,this.data.form.name)})
 },
 value(e){
   const {r,i,choice,pick,note}=e.currentTarget.dataset
   const field=this.data.fields.find(f=>f.key===Number(i))
   const value=choice!==undefined?choice:pick?field.options[e.detail.value]:e.detail.value
   const rows=this.data.rows.slice()
   const row={...rows[r],[note?'note'+i:i]:value}
   if(!note && this.data.drug===0 && Number(i)===2 && ['60','120','180'].includes(value))row[4]='mg'
   rows[r]=row
   this.updateRows(rows)
 },
 add(){this.updateRows([...this.data.rows,{}])},
 save(e){const {p,v,f,rows,drug}=this.data;const status=e.currentTarget.dataset.status
 if(status==='已填'&&!rows.every(row=>Object.values(row).some(Boolean)))return this.toast('请填写记录或保存草稿')
 if(status==='已填'&&drug>=0&&(!rows[0][0]||(rows[0][0]==='是'&&(!rows[0][1]||!rows[0][2]||!rows[0][4]||(rows[0][2]==='其他'&&!rows[0][3])))))return this.toast('请核对给药状态、日期、剂量及单位')
 try{db.update(p.id,x=>{if(this.data.form.name==='访视日期')x.dates[v]=rows[0][0]||'';const activeRows=rows.map((row,r)=>{const clean={...row};for(const field of this.data.fields){if(!this.data.groups[r].some(g=>g.key===field.key)){delete clean[field.key];delete clean['note'+field.key]}else if(!/其他|其它|请描述|请说明/.test(row[field.key]||'') && field.options.includes(row[field.key]))delete clean['note'+field.key]}return clean});const record={rows:activeRows,status};if(drug>=0){record.drug=drug;if(rows[0][0]==='否')record.rows=[{0:'否',7:rows[0][7]||''}]}x.records[v+'/'+f]=record});this.dirty=false;this.showVisit(v);this.toast('已保存')}catch(e){this.toast('保存失败，请检查本地空间')}},
 source(){this.setData({review:!this.data.review})},
 back(){const go=()=>{if(this.data.screen==='edit')this.showVisit(this.data.v);else if(this.data.screen==='visit')this.open(this.data.p.id);else{this.setData({screen:'home'});this.reload()}}
 if(this.data.screen==='edit'&&this.dirty)wx.showModal({title:'放弃未保存的修改？',success:r=>{if(r.confirm)go()}});else go()}
})
