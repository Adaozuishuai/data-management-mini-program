// Keys are the original column positions so existing local records remain readable.
function visible(field, row, drug, name) {
  const key = field.key
  if (drug >= 0) {
    if (key === 0) return true
    if (key === 7) return row[0] === '否' || row[6] === '是' || !!row[7]
    if (key === 8) return row[0] === '是' && row[6] === '是'
    if (key === 3) return row[0] !== '否' && row[2] === '其他'
    return row[0] === '是' || (!row[0] && !!row[key])
  }
  const gate = name === '不良事件' ? 13 : name === '合并用药' ? 10 : -1
  if (gate >= 0 && key !== gate && row[gate] === '否') return false
  if (name === '不良事件' && (key === 10 || key === 11) && row[9] === '否') return false
  if (name === '合并用药' && key === 9 && row[8] === '是') return false
  if (name === '妊娠检查' && key < 5 && key > 0) {
    return row[0] ? row[0] === (key === 2 ? '否' : '是') : !!row[key]
  }
  return true
}
function controls(fields, rows, drug, name) {
  return rows.map(row => fields.filter(field => visible(field,row,drug,name)).map(field => {
    const value=row[field.key] || ''
    const legacy=!!value && field.options.length>0 && !field.options.includes(value)
    const unitLocked=drug===0 && field.key===4 && ['60','120','180'].includes(row[2]) && row[4]==='mg'
    const detail=/其他|其它|请描述|请说明/.test(value) && field.options.includes(value) && drug<0
    return {...field,value,legacy,unitLocked,detail,note:row['note'+field.key]||'',
      label:drug>=0 && field.key===7 ? (row[0]==='否'?'未给药原因':'原因说明'):field.label}
  }))
}
function makeFields(base, drug) {
  return base.map(([label,options],key)=>{
    const type=options.length ? (options.length<=7 && options.every(v=>v.length<=14)?'choice':'picker')
      : /日期|死亡时间/.test(label)?'date'
      : /检测值|分值|^剂量$|^实际剂量$|^其他剂量数值$|^(体温|体重|身高|脉搏|呼吸频率|收缩压|舒张压|年龄)$/.test(label)?'number':'text'
    return {label,options,key,type,display:options.map(v=>drug===0 && key===2 && v!=='其他'?v+' mg':v)}
  })
}
module.exports={makeFields,controls}
