"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PolicyChoiceSelect } from "./components/PolicyChoiceSelect";
import { getPolicy, getPolicyReadiness, savePolicy, PolicyError } from "./providers/policies.api";
import type { PolicyChoice, PolicyDetail } from "./policy-types";
export default function PoliciesModule() {
  const [policy,setPolicy]=useState<PolicyDetail | null>(null),[warehouse,setWarehouse]=useState<PolicyChoice | null>(null),[source,setSource]=useState<PolicyChoice | null>(null),[destination,setDestination]=useState<PolicyChoice | null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState<PolicyError | null>(null),[notice,setNotice]=useState("");
  const accept=(data: PolicyDetail) => {setPolicy(data);setWarehouse(data.warehouse ?? (data.warehouseBranchId?{id:data.warehouseBranchId,code:"",name:"Unavailable branch",status:"INELIGIBLE",classification:"",eligible:false,reason:"Saved branch could not be resolved."}:null));setSource(data.warehouseAccount ?? (data.warehouseAccountId?{id:data.warehouseAccountId,code:"",name:"Unavailable account",status:"INELIGIBLE",classification:"",eligible:false,reason:"Saved account could not be resolved."}:null));setDestination(data.consignmentAccount ?? (data.consignmentAccountId?{id:data.consignmentAccountId,code:"",name:"Unavailable account",status:"INELIGIBLE",classification:"",eligible:false,reason:"Saved account could not be resolved."}:null));};
  const fail=(cause: unknown) => setError(cause instanceof PolicyError?cause:new PolicyError("Unable to reach the service. Reload settings before saving again.",503));
  const reload=async () => {setBusy(true);setError(null);try{accept(await getPolicy());}catch(cause){fail(cause);}finally{setBusy(false);}};
  useEffect(()=>{let active=true;getPolicy().then(data=>{if(active)accept(data);}).catch(cause=>{if(active)fail(cause);});return()=>{active=false;};},[]);
  const denied=error?.status===401||error?.status===403;
  const save=async()=>{if(!policy||busy)return;setBusy(true);setError(null);setNotice("");try{accept(await savePolicy({version:policy.version,warehouseBranchId:warehouse?.id??null,warehouseAccountId:source?.id??null,consignmentAccountId:destination?.id??null}));setNotice("Policy saved. Shipment posting remains blocked until all contracts are verified.");}catch(cause){fail(cause);}finally{setBusy(false);}};
  const check=async()=>{if(busy)return;setBusy(true);setError(null);try{const readiness=await getPolicyReadiness();setPolicy(current=>current?{...current,readiness}:current);setNotice("Readiness checked against saved settings. Save edited selections before checking again.");}catch(cause){fail(cause);}finally{setBusy(false);}};
  return <main className="flex-1 space-y-5 overflow-y-auto p-6"><div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Policies</h1><Button variant="outline" disabled={busy} onClick={()=>void reload()}>Reload settings</Button></div>
    <p>Configure the source warehouse and inventory accounts for shipments. Incomplete settings can be saved.</p>
    {error && <p role="alert" className="text-destructive">{denied?"You do not have access to Policies.":error.message}</p>}{notice && <p role="status">{notice}</p>}
    {!policy&&!error&&<p>Loading settings...</p>}
    {policy&&!denied&&<><div className="max-w-3xl space-y-5">
      <PolicyChoiceSelect label="Source warehouse" kind="branches" selected={warehouse} disabled={busy} error={error?.fieldErrors.warehouseBranchId} onSelect={setWarehouse}/>
      <PolicyChoiceSelect label="Warehouse inventory account (credit)" kind="accounts" selected={source} disabled={busy} error={error?.fieldErrors.warehouseAccountId} onSelect={setSource}/>
      <PolicyChoiceSelect label="Inventory on consignment account (debit)" kind="accounts" selected={destination} disabled={busy} error={error?.fieldErrors.consignmentAccountId} onSelect={setDestination}/>
      <div className="rounded border p-3"><h2 className="font-semibold">Stock source: Official warehouse running inventory</h2><p>Read lineage is identified. Stock movement and UOM integration await verification.</p></div>
      <div className="rounded border p-3"><h2 className="font-semibold">Valuation: Awaiting verification</h2><p>Accounting and Inventory must confirm the cost source, method, UOM and precision. Saving settings does not enable posting.</p></div>
      <div className="flex gap-2"><Button disabled={busy||error?.status===409||error?.status===503} onClick={()=>void save()}>Save policy</Button><Button variant="outline" disabled={busy} onClick={()=>void check()}>Check shipment readiness</Button></div>
      <p className="text-sm">Version {policy.version} | Updated by {policy.updatedBy??"Not recorded"} | {policy.updatedAt??"Not recorded"}</p>
    </div><section className="space-y-2 rounded border p-4"><h2 className="font-semibold">Shipment posting blocked</h2><ul className="list-disc pl-5">{policy.readiness.blockers.map(blocker=><li key={blocker.code+blocker.field}>{blocker.message}</li>)}</ul></section></>}
  </main>;
}
