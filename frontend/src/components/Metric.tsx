export function Metric({label,value,sub}:{label:string;value:string;sub?:string}){
  return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div>{sub&&<div className="metric-sub">{sub}</div>}</div>
}
