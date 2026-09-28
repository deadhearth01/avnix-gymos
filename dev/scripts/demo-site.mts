/** Website content for the Iron Paradise demo gym (shared by seed-demo and one-off patches). */
export const DEMO_SITE = {
  tagline: "Lift heavy. Leave lighter.",
  heroText: "A 6,000 sq ft strength floor in MVP Colony with coaches who know your name, your numbers and your excuses.",
  about:
    "Iron Paradise is where Vizag comes to get strong. Imported racks and plates, a full cardio deck and certified coaches on the floor from 5 AM — whether it’s your first squat or your next deadlift PR.",
  heroFileId: "preset:hero-deadlift",
  amenities: [
    "Certified trainers",
    "Imported strength equipment",
    "Cardio deck",
    "Personal training",
    "Diet plans",
    "Steam & lockers",
    "Ample parking",
    "Women-only batch",
  ],
  hours: [
    { days: "Mon – Sat", open: "05:00", close: "22:00" },
    { days: "Sunday", open: "06:00", close: "12:00" },
  ],
  trainers: [
    { name: "Kiran Varma", role: "Head coach, strength", experience: "9 years coaching", instagram: "kiran.lifts", photoFileId: "preset:trainer-kiran" },
    {
      name: "Sravani Reddy",
      role: "Women’s fitness & Zumba",
      experience: "6 years coaching",
      instagram: "sravani.moves",
      photoFileId: "preset:trainer-sravani",
    },
    { name: "Arjun Naidu", role: "Personal training", experience: "4 years coaching", instagram: "arjun.trains", photoFileId: "preset:trainer-arjun" },
  ],
  gallery: ["preset:spotting", "preset:hero-ropes", "preset:kettlebell", "preset:cardio-deck", "preset:stretch-zone", "preset:lockers", "preset:weights-rack"],
  faqs: [
    { q: "Do you offer a free trial?", a: "Yes. Book a free trial session online and a coach will show you around and train with you." },
    { q: "Is there a women-only batch?", a: "Yes, 7–9 AM every weekday, coached by Sravani." },
    { q: "Can I pause my membership?", a: "You can freeze your membership for travel or illness; your expiry date moves forward automatically." },
  ],
  socials: { instagram: "https://instagram.com/", google: "https://maps.google.com/?q=MVP+Colony+Visakhapatnam" },
  showPrices: true,
  showTrial: true,
};
