import type { ShipmentDetail,ShipmentDraft,ShipmentPreview,ShipmentPage,ShipmentChoices,ShipmentPostCommand } from "../shipment-types";
export class ShipmentError extends Error { constructor(message:string,readonly status:number,readonly fieldErrors:Record<string,string>={},readonly preview?:ShipmentPreview){super(message);} }
async function request<T>(path="",init?:RequestInit):Promise<T>{const response=await fetch(`/api/fm/consignment/shipments${path}`,{...init,credentials:"include",cache:"no-store"});const body=await response.json().catch(()=>null);if(!response.ok)throw new ShipmentError(body?.message||"Unable to load shipment.",response.status,body?.fieldErrors,body?.preview);return body;}
const json=(body:unknown,method="POST")=>({method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
export const listShipments=(search:string,status:string,page:number,pageSize=25)=>request<ShipmentPage>(`?${new URLSearchParams({search,status,page:String(page),pageSize:String(pageSize)})}`);
export const getShipment=(id:number)=>request<ShipmentDetail>(`/${id}`);
export const saveShipment=(id:number|null,draft:ShipmentDraft)=>request<ShipmentDetail>(id?`/${id}`:"",json(draft,id?"PUT":"POST"));
export const previewShipment=(draft:ShipmentDraft)=>request<ShipmentPreview>("/preview",json(draft));
export const submitShipment=(id:number,version:number)=>request<ShipmentDetail>(`/${id}/submit`,json({version}));
export const postingPreview=(id:number)=>request<ShipmentPreview>(`/${id}/posting-preview`);
export const postShipment=(id:number,command:ShipmentPostCommand)=>request<ShipmentDetail>(`/${id}/post`,json(command));
export const rejectShipment=(id:number,version:number,reason:string)=>request<ShipmentDetail>(`/${id}/reject`,json({version,reason}));
export const shipmentChoices=(kind:string,search:string,page:number,signal?:AbortSignal)=>request<ShipmentChoices>(`/choices/${kind}?${new URLSearchParams({search,page:String(page),pageSize:"25"})}`,{signal});
