"use client";
import { useCallback,useEffect,useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShipmentEditor } from "./components/ShipmentEditor";
import { getShipment,listShipments,ShipmentError } from "./providers/shipments.api";
import type { ShipmentDetail,ShipmentPage } from "./shipment-types";
export default function ShipmentsModule(){
 const [data,setData]=useState<ShipmentPage|null>(null),[search,setSearch]=useState(""),[query,setQuery]=useState(""),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState<ShipmentError|null>(null),[editor,setEditor]=useState<{detail:ShipmentDetail|null;editing:boolean;key:string}|null>(null);
 const refresh=useCallback(async()=>{setLoading(true);setError(null);try{setData(await listShipments(query,page));}catch(cause){setError(cause instanceof ShipmentError?cause:new ShipmentError("Unable to load shipments.",503));}finally{setLoading(false);}},[query,page]);
 useEffect(()=>{void refresh();},[refresh]);
 const open=async(id:number,editing:boolean)=>{if(loading)return;setLoading(true);try{const detail=await getShipment(id);setEditor({detail,editing:editing&&detail.summary.editable,key:crypto.randomUUID()});}catch(cause){setError(cause instanceof ShipmentError?cause:new ShipmentError("Unable to open shipment.",503));}finally{setLoading(false);}};
 const denied=error?.status===401||error?.status===403;
 return <main className="min-w-0 flex-1 space-y-4 overflow-y-auto p-6"><div className="flex justify-between"><h1 className="text-2xl font-semibold">Shipments</h1>{!denied&&<Button disabled={loading} onClick={()=>setEditor({detail:null,editing:true,key:crypto.randomUUID()})}>Create shipment draft</Button>}</div><p>Prepare drafts against Active agreements. Preview and submission do not change inventory or the ledger. Calculation contracts are awaiting verification.</p>
 {error&&<p role="alert" className="text-destructive">{denied?"You do not have access to Shipments.":error.message}</p>}
 {!denied&&<><form className="flex gap-2" onSubmit={event=>{event.preventDefault();setPage(1);setQuery(search.trim());}}><Input aria-label="Search shipments" value={search} onChange={event=>setSearch(event.target.value)}/><Button disabled={loading}>Search</Button><Button type="button" variant="outline" disabled={loading} onClick={()=>void refresh()}>Refresh</Button></form>
 <div className="overflow-x-auto rounded border"><table className="w-full text-sm"><thead><tr>{["Shipment","Date","Agreement","Delivery reference","Status","Actions"].map(label=><th key={label} className="p-2 text-left">{label}</th>)}</tr></thead><tbody>{data?.items.map(item=><tr key={item.id} className="border-t"><td className="p-2">{item.number}</td><td>{item.documentDate??"Not set"}</td><td>{item.agreementId?`#${item.agreementId}`:"Not set"}</td><td>{item.deliveryReference??"Not set"}</td><td>{item.status}</td><td className="space-x-2"><Button variant="outline" disabled={loading} onClick={()=>void open(item.id,false)}>View {item.number}</Button>{item.editable&&<Button variant="outline" disabled={loading} onClick={()=>void open(item.id,true)}>Edit {item.number}</Button>}</td></tr>)}</tbody></table></div>{!loading&&data?.items.length===0&&<p>No shipments found.</p>}<div className="flex gap-3"><Button disabled={loading||page===1} variant="outline" onClick={()=>setPage(p=>p-1)}>Previous</Button><span>Page {page} | {data?.total??0} records</span><Button disabled={loading||!data||page*data.pageSize>=data.total} variant="outline" onClick={()=>setPage(p=>p+1)}>Next</Button></div></>}
 {editor&&!denied&&<ShipmentEditor key={editor.key} initial={editor.detail} editing={editor.editing} onClose={()=>setEditor(null)} onSaved={()=>void refresh()}/>}
 </main>;
}
