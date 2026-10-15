export default function ConsignmentBasisOfAccountingModule() {
  return (
    <main className="space-y-6 p-6">
      <div><h1 className="text-2xl font-semibold">Basis of Accounting</h1><p className="mt-1 text-sm text-muted-foreground">Consignment recognition and accounting treatment reference.</p></div>
      <section className="max-w-4xl rounded-lg border p-5">
        <ul className="list-disc space-y-3 pl-5 text-sm leading-6">
          <li><strong>Shipment is not a sale.</strong> Revenue is not recorded on delivery to the consignee. The goods remain inventory at cost until the consignee sells them to the end customer.</li>
          <li><strong>Revenue is recognized at sell-through.</strong> The principal records gross sales when the consignee reports the end-customer sale; commission is presented as a selling expense.</li>
          <li><strong>Listing and slotting fees.</strong> Payments to a consignee reduce revenue unless they buy a distinct service at fair value. Qualifying fees are held as prepaid and released over their listing period.</li>
          <li><strong>VAT and withholding.</strong> VAT follows the underlying sale or service. Withholding treatment and rates follow the saved Consignment policy and applicable tax advice.</li>
          <li><strong>Deductions.</strong> Promotional support and markdowns reduce revenue; spoilage claims and other deductions follow their approved accounting treatment and reduce the consignee balance.</li>
          <li><strong>Customer returns.</strong> A credit note reverses the original sale using its frozen price and cost basis. Resalable units return to consignee stock; other conditions follow the approved write-off treatment.</li>
          <li><strong>Early delisting.</strong> The unamortized fee leaves prepaid. Any refund becomes a receivable, and the unrecovered balance is recognized according to the fee treatment.</li>
          <li><strong>Shrinkage.</strong> Count shortages are billed to the consignee or expensed according to the agreement. Count overages require investigation and are not posted automatically.</li>
          <li><strong>Controls.</strong> Maker-checker approval, exposure limits, unique references, period close, reversal-only corrections, reconciliation, and an audit trail govern the workflow.</li>
        </ul>
      </section>
      <AlertNotice />
    </main>
  );
}

function AlertNotice() {
  return <p className="max-w-4xl rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">This is a working model for review, not approved accounting or tax policy. Have the organization’s accountant or auditor approve the policy elections and tax treatment before relying on them.</p>;
}
