const key = 'hero.demo.patients.v1'
function list() {
  return wx.getStorageSync(key) || []
}
function write(patients) {
  wx.setStorageSync(key, patients)
}
function create(center, subject) {
  const patients = list()
  const id = JSON.stringify([center, subject])
  if (patients.some(p => p.id === id)) throw Error('该中心已有此受试者编号')
  patients.push({id, center, subject, dates:{}, records:{}})
  write(patients)
  return id
}
function update(id, change) {
  const patients = list()
  const patient = patients.find(p => p.id === id)
  if (!patient) throw Error('病例不存在')
  change(patient)
  write(patients)
}
module.exports = {list, create, update}
module.exports.seed = function(visits) {
  if (wx.getStorageSync(key)) return
  const patients=['D001','D002'].map(subject=>({id:JSON.stringify(['DEMO',subject]),center:'DEMO',subject,dates:{},records:{}}))
  const visitsToSeed=['诱导期(W1D1)','诱导期(W3D1)']
  for(const [i,name] of visitsToSeed.entries()){
    const v=visits.findIndex(x=>x.name===name)
    for(const [j,p] of patients.entries()){
      const date=i?'2026-03-18':'2026-03-04'
      p.dates[v]=date
      visits[v].forms.forEach((f,k)=>{
        if(!f.name.includes('给药'))return
        const drug=Number(f.name.includes('BCG'))
        if(j && drug && i)return
        const row=j && drug?{0:'否',7:'虚构病例，本次未给药'}:{0:'是',1:date,2:drug?'1':'60',4:drug?'示例单位':'mg',5:i?'是':'否',6:i?'是':'否',7:i?'虚构调整示例':''}
        p.records[v+'/'+k]={drug,rows:[row],status:'已填'}
      })
    }
  }
  write(patients)
}
