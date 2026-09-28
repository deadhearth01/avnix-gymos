import { notFound } from "next/navigation";
import { Query } from "node-appwrite";
import { requireCap } from "@/lib/auth/session";
import { repo, NotFoundError } from "@/lib/data/repo";
import { T } from "@/lib/appwrite/schema";
import { mediaUrl } from "@/lib/media";
import { inr, fmtDate, fmtPhone } from "@/lib/format";
import { rupeesInWords, SAC_FITNESS } from "@/lib/domain/gst";
import type { Invoice, InvoiceItem, Member, Payment } from "@/lib/types";
import { InvoiceToolbar } from "./toolbar";
import "./print.css";

const STATES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other territory",
};

async function getInvoice(gymId: string, id: string) {
  try {
    return await repo(gymId).get<Invoice>(T.invoices, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: PageProps<"/billing/invoices/[id]">) {
  const { id } = await params;
  const ctx = await requireCap("billing.view");
  const invoice = await getInvoice(ctx.gymId, id);
  return { title: `Invoice ${invoice.number}` };
}

export default async function InvoicePage({ params }: PageProps<"/billing/invoices/[id]">) {
  const { id } = await params;
  const ctx = await requireCap("billing.view");
  const r = repo(ctx.gymId);
  const invoice = await getInvoice(ctx.gymId, id);
  const [member, paymentPage] = await Promise.all([
    r.find<Member>(T.members, invoice.memberId),
    r.list<Payment>(T.payments, [Query.equal("invoiceId", id), Query.orderAsc("paidAt")]),
  ]);
  let items: InvoiceItem[] = [];
  try {
    const parsed: unknown = invoice.items ? JSON.parse(invoice.items) : [];
    items = Array.isArray(parsed) ? (parsed as InvoiceItem[]) : [];
  } catch {
    /* Keep the invoice readable if old item JSON is damaged. */
  }
  const payments = paymentPage.rows;
  const gym = ctx.gym;
  const stateCode = gym.stateCode || gym.gstin?.slice(0, 2) || "37";
  const state = `${STATES[stateCode] ?? "India"} (${stateCode})`;
  const isIgst = invoice.igst > 0;
  const lineTotals = items.map((item, index) => {
    const last = index === items.length - 1;
    const priorAmount = items.slice(0, index).reduce((sum, x) => sum + x.amount, 0);
    const discount = last
      ? invoice.discount -
        items.slice(0, index).reduce((sum, x) => sum + (invoice.subtotal ? Math.round((x.amount / invoice.subtotal) * invoice.discount * 100) / 100 : 0), 0)
      : invoice.subtotal
        ? Math.round((item.amount / invoice.subtotal) * invoice.discount * 100) / 100
        : 0;
    const taxable = last
      ? invoice.taxable - (invoice.subtotal ? Math.round((priorAmount / invoice.subtotal) * invoice.taxable * 100) / 100 : 0)
      : invoice.subtotal
        ? Math.round((item.amount / invoice.subtotal) * invoice.taxable * 100) / 100
        : 0;
    return { item, discount, taxable };
  });
  const stamp = invoice.status === "partial" ? "PARTIALLY PAID" : invoice.status.toUpperCase();
  const totalTax = invoice.cgst + invoice.sgst + invoice.igst;
  return (
    <div data-invoice-page className="mx-auto max-w-[850px]">
      <InvoiceToolbar number={invoice.number} phone={member?.phone ?? invoice.memberPhone} />
      <article data-invoice-sheet className="relative overflow-hidden rounded-2xl border bg-white p-6 text-slate-900 shadow-sm sm:p-10">
        {invoice.status === "void" && (
          <div className="invoice-watermark" aria-hidden="true">
            VOID
          </div>
        )}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-900 pb-6">
          <div className="flex items-start gap-4">
            {gym.logoFileId && (
              <div
                role="img"
                aria-label={`${gym.name} logo`}
                className="size-16 shrink-0 bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${mediaUrl(gym.logoFileId, { width: 160 })})` }}
              />
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight">{gym.name}</h1>
              <p className="mt-1 max-w-xs text-xs leading-relaxed whitespace-pre-line text-slate-600">{gym.address || gym.city || ""}</p>
              <p className="text-xs text-slate-600">{fmtPhone(gym.phone)}</p>
              {gym.gstin && <p className="mt-1 text-xs font-semibold">GSTIN: {gym.gstin}</p>}
              <p className="text-xs">State: {state}</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold tracking-[.2em] text-slate-500 uppercase">Tax invoice</p>
            <p className="mt-2 text-lg font-bold">{invoice.number}</p>
            <p className="text-xs text-slate-600">Date: {fmtDate(invoice.issuedAt)}</p>
            <p className="mt-2 inline-block rounded border border-slate-300 px-2 py-1 text-xs font-bold tracking-wider">{stamp}</p>
          </div>
        </header>
        <div className="grid gap-5 border-b py-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Bill to</p>
            <p className="mt-2 font-semibold">{member?.name ?? invoice.memberName}</p>
            <p className="text-xs text-slate-600">{fmtPhone(member?.phone ?? invoice.memberPhone)}</p>
            {member?.code && <p className="text-xs text-slate-600">Member code: {member.code}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Supply details</p>
            <p className="mt-2 text-xs">Place of supply: {state}</p>
            <p className="text-xs">Service code (SAC): {SAC_FITNESS}</p>
          </div>
        </div>
        <div className="invoice-table-wrap mt-6 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-xs">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-50 text-left">
                <th className="px-2 py-2 font-semibold">Description</th>
                <th className="px-2 py-2 font-semibold">SAC</th>
                <th className="px-2 py-2 text-right font-semibold">Qty</th>
                <th className="px-2 py-2 text-right font-semibold">Rate</th>
                <th className="px-2 py-2 text-right font-semibold">Amount</th>
                <th className="px-2 py-2 text-right font-semibold">Discount</th>
                <th className="px-2 py-2 text-right font-semibold">Taxable</th>
              </tr>
            </thead>
            <tbody>
              {lineTotals.map(({ item, discount, taxable }, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="px-2 py-3 font-medium">{item.description}</td>
                  <td className="px-2 py-3">{item.sac || SAC_FITNESS}</td>
                  <td className="px-2 py-3 text-right">{item.qty}</td>
                  <td className="px-2 py-3 text-right">{inr(item.rate, true)}</td>
                  <td className="px-2 py-3 text-right">{inr(item.amount, true)}</td>
                  <td className="px-2 py-3 text-right">{inr(discount, true)}</td>
                  <td className="px-2 py-3 text-right font-semibold">{inr(taxable, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-[310px] space-y-2 text-xs">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{inr(invoice.subtotal, true)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd>− {inr(invoice.discount, true)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Taxable value</dt>
              <dd>{inr(invoice.taxable, true)}</dd>
            </div>
            {isIgst ? (
              <div className="flex justify-between">
                <dt>IGST ({invoice.taxRate}%)</dt>
                <dd>{inr(invoice.igst, true)}</dd>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <dt>CGST ({invoice.taxRate / 2}%)</dt>
                  <dd>{inr(invoice.cgst, true)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>SGST ({invoice.taxRate / 2}%)</dt>
                  <dd>{inr(invoice.sgst, true)}</dd>
                </div>
              </>
            )}
            {totalTax === 0 && <div className="text-right text-slate-500">No tax charged</div>}
            <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{inr(invoice.total, true)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Paid</dt>
              <dd>{inr(invoice.paid, true)}</dd>
            </div>
            <div className="flex justify-between font-bold">
              <dt>Balance due</dt>
              <dd>{inr(invoice.balance, true)}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-7 border-t pt-4">
          <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Amount in words</p>
          <p className="mt-1 text-sm font-medium">{rupeesInWords(invoice.total)}</p>
        </div>
        {payments.length > 0 && (
          <section className="mt-7">
            <h2 className="text-sm font-bold">Payment history</h2>
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Method</th>
                  <th className="py-2 font-medium">Reference</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.$id} className="border-b border-slate-100">
                    <td className="py-2">{fmtDate(p.paidAt)}</td>
                    <td className="py-2 capitalize">{p.method}</td>
                    <td className="py-2">{p.reference || "—"}</td>
                    <td className="py-2 text-right">{inr(p.amount, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {invoice.notes && <p className="mt-6 text-xs text-slate-600">Note: {invoice.notes}</p>}
        <footer className="mt-10 border-t pt-4 text-center text-[11px] leading-relaxed text-slate-500">
          <p>This is a computer-generated invoice.</p>
          <p>GST on gym services @5% without ITC.</p>
        </footer>
      </article>
    </div>
  );
}
