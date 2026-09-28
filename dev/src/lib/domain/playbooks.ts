/**
 * Automation playbooks. Pure data + rendering — imported by the app, the
 * journey engine and the scheduled Appwrite Function (bundled with esbuild).
 */

export type PlaybookKey = "welcome" | "payment_receipt" | "renewal" | "expiry_day" | "dues" | "inactivity" | "birthday" | "winback" | "trial_reminder";

export type PlaybookDef = {
  key: PlaybookKey;
  title: string;
  description: string;
  trigger: "event" | "schedule";
  category: "Onboarding" | "Renewals" | "Payments" | "Engagement" | "Leads";
  /** day offsets used by scheduled playbooks (meaning depends on playbook) */
  defaultOffsets?: number[];
  offsetsLabel?: string;
  defaultEnabled: boolean;
  en: string;
  te: string;
  variables: string[];
};

export const PLAYBOOKS: PlaybookDef[] = [
  {
    key: "welcome",
    title: "Welcome message",
    description: "Sent the moment a new member joins — sets the tone for the first 30 days.",
    trigger: "event",
    category: "Onboarding",
    defaultEnabled: true,
    en: "Hi {{name}}, welcome to {{gym}}! 🎉 Your {{plan}} membership is active till {{expiry}}. Reply here anytime if you need help. Let's get started 💪",
    te: "హాయ్ {{name}}, {{gym}}కి స్వాగతం! 🎉 మీ {{plan}} మెంబర్‌షిప్ {{expiry}} వరకు యాక్టివ్‌గా ఉంటుంది. ఏదైనా సహాయం కావాలంటే ఇక్కడే రిప్లై చేయండి. మొదలుపెడదాం 💪",
    variables: ["name", "gym", "plan", "expiry"],
  },
  {
    key: "payment_receipt",
    title: "Payment receipt",
    description: "Confirms every payment with the amount, invoice number and validity.",
    trigger: "event",
    category: "Payments",
    defaultEnabled: true,
    en: "Thank you {{name}}! We received {{amount}} at {{gym}} (invoice {{invoice}}). Your membership is valid till {{expiry}}.",
    te: "ధన్యవాదాలు {{name}}! {{gym}}లో {{amount}} అందింది (ఇన్వాయిస్ {{invoice}}). మీ మెంబర్‌షిప్ {{expiry}} వరకు చెల్లుతుంది.",
    variables: ["name", "gym", "amount", "invoice", "expiry"],
  },
  {
    key: "renewal",
    title: "Renewal reminders",
    description: "A gentle ladder of reminders before a membership ends.",
    trigger: "schedule",
    category: "Renewals",
    defaultOffsets: [7, 3, 1],
    offsetsLabel: "days before expiry",
    defaultEnabled: true,
    en: "Hi {{name}}, your {{plan}} membership at {{gym}} ends in {{days}} day(s) on {{expiry}}. Renew now to keep your streak going 🔥",
    te: "హాయ్ {{name}}, {{gym}}లో మీ {{plan}} మెంబర్‌షిప్ {{days}} రోజుల్లో ({{expiry}}) ముగుస్తుంది. మీ స్ట్రీక్ కొనసాగించడానికి ఇప్పుడే రెన్యూ చేయండి 🔥",
    variables: ["name", "gym", "plan", "days", "expiry"],
  },
  {
    key: "expiry_day",
    title: "Expiry-day notice",
    description: "A clear heads-up on the day a membership expires.",
    trigger: "schedule",
    category: "Renewals",
    defaultEnabled: true,
    en: "Hi {{name}}, your membership at {{gym}} expires today. Renew today to continue without a break. See you at the gym!",
    te: "హాయ్ {{name}}, {{gym}}లో మీ మెంబర్‌షిప్ ఈరోజుతో ముగుస్తుంది. విరామం లేకుండా కొనసాగడానికి ఈరోజే రెన్యూ చేయండి. జిమ్‌లో కలుద్దాం!",
    variables: ["name", "gym"],
  },
  {
    key: "dues",
    title: "Dues follow-up",
    description: "Polite reminders for pending balances — no awkward calls from the desk.",
    trigger: "schedule",
    category: "Payments",
    defaultOffsets: [3],
    offsetsLabel: "repeat every N days while a balance is pending",
    defaultEnabled: true,
    en: "Hi {{name}}, a balance of {{amount}} is pending on your {{gym}} account. You can pay at the front desk or via UPI. Thank you! 🙏",
    te: "హాయ్ {{name}}, {{gym}}లో మీ ఖాతాలో {{amount}} బకాయి ఉంది. ఫ్రంట్ డెస్క్‌లో లేదా UPI ద్వారా చెల్లించవచ్చు. ధన్యవాదాలు! 🙏",
    variables: ["name", "gym", "amount"],
  },
  {
    key: "inactivity",
    title: "We miss you",
    description: "Nudges active members who stopped showing up — the #1 early churn signal.",
    trigger: "schedule",
    category: "Engagement",
    defaultOffsets: [7, 14],
    offsetsLabel: "days without a visit",
    defaultEnabled: true,
    en: "Hey {{name}}, we've missed you at {{gym}}! It's been {{days}} days — even a 30-minute session helps. See you today? 💪",
    te: "హాయ్ {{name}}, {{gym}}లో మిమ్మల్ని మిస్ అవుతున్నాం! {{days}} రోజులైంది — 30 నిమిషాల చిన్న వర్కౌట్ కూడా చాలా సహాయపడుతుంది. ఈరోజు కలుద్దామా? 💪",
    variables: ["name", "gym", "days"],
  },
  {
    key: "birthday",
    title: "Birthday wishes",
    description: "A warm wish on their birthday. Small touch, big loyalty.",
    trigger: "schedule",
    category: "Engagement",
    defaultEnabled: true,
    en: "Happy birthday, {{name}}! 🎂 Wishing you a strong and healthy year ahead from all of us at {{gym}}.",
    te: "పుట్టినరోజు శుభాకాంక్షలు, {{name}}! 🎂 {{gym}} టీమ్ తరఫున మీకు ఆరోగ్యకరమైన, బలమైన సంవత్సరం కావాలని కోరుకుంటున్నాం.",
    variables: ["name", "gym"],
  },
  {
    key: "winback",
    title: "Win-back",
    description: "Re-invites members whose plan lapsed, at the moments they're most likely to return.",
    trigger: "schedule",
    category: "Renewals",
    defaultOffsets: [7, 30],
    offsetsLabel: "days after expiry",
    defaultEnabled: false,
    en: "Hi {{name}}, your fitness journey at {{gym}} is one step away. Come back this week and we'll help you restart strong. Reply YES and we'll call you.",
    te: "హాయ్ {{name}}, {{gym}}లో మీ ఫిట్‌నెస్ ప్రయాణం ఒక్క అడుగు దూరంలోనే ఉంది. ఈ వారం తిరిగి రండి, మళ్లీ బలంగా మొదలుపెట్టడానికి మేము సహాయం చేస్తాం. YES అని రిప్లై చేయండి, మేము కాల్ చేస్తాం.",
    variables: ["name", "gym"],
  },
  {
    key: "trial_reminder",
    title: "Trial reminder",
    description: "Reminds leads about their booked trial — cuts no-shows sharply.",
    trigger: "schedule",
    category: "Leads",
    defaultEnabled: true,
    en: "Hi {{name}}, a reminder of your free trial at {{gym}} on {{trial}}. Carry water and comfortable shoes. See you! 📍 {{address}}",
    te: "హాయ్ {{name}}, {{trial}}న {{gym}}లో మీ ఉచిత ట్రయల్ ఉంది. నీళ్ల బాటిల్, సౌకర్యవంతమైన షూస్ తీసుకురండి. కలుద్దాం! 📍 {{address}}",
    variables: ["name", "gym", "trial", "address"],
  },
];

export const PLAYBOOK_BY_KEY = Object.fromEntries(PLAYBOOKS.map((p) => [p.key, p])) as Record<PlaybookKey, PlaybookDef>;

export type AutomationConfig = { offsets?: number[]; contentSid?: string };

export function render(template: string, vars: Record<string, string | number | null | undefined>) {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
      const v = vars[k];
      return v === null || v === undefined || v === "" ? "" : String(v);
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .trim();
}
