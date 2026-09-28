# Research — Gym Management Software (Vizag / AP)

Research date: 28 Sep 2026. GymOS v1 is now built in `dev/` and deployed to Appwrite Sites (`gymos-web`).

| # | File | What's inside | Author |
|---|---|---|---|
| 01 | [01-product-plan.md](01-product-plan.md) | **Start here.** Executive summary; India and Vizag market; competitor tiers; the gaps we target; feature modules; automation playbooks; AI layer; end-to-end workflows; UX; architecture; pricing and go-to-market; roadmap; risks; open questions | Claude (synthesis) |
| 02 | [02-competitor-teardown.md](02-competitor-teardown.md) | About 25 vendors: pricing, WhatsApp route, UPI AutoPay, GST, biometric support, AI, languages; mined user complaints; 15 ranked gaps | Codex agent |
| 03 | [03-ai-rails-regulation-retention.md](03-ai-rails-regulation-retention.md) | How mature each vendor's AI is, and hype vs reality; WhatsApp pricing and rules; RBI e-mandate; GST; DPDP; TRAI DLT; retention and onboarding science | OpenCode agent (secondary source; verify before relying on it) |
| 04 | [04-build-plan.md](04-build-plan.md) | MVP build plan (superseded by the shipped app — see `dev/README.md`) | Claude |
| — | [../dev/README.md](../dev/README.md) | **The app**: setup, architecture, security model, deployment & DNS | Claude |
| — | [agent-prompts/](agent-prompts/) | The exact prompts given to the Codex and OpenCode agents, so the research can be re-run | — |

## Key facts to remember
- **Vizag:** about 367 gyms on Google Maps (708 on Justdial). About 97% are single-owner and about 87% have no website. Typical fees are about ₹1,500/month or ₹15,000–25,000/year.
- **GST on gym services:** 5% without ITC since 22 Sep 2025, under SAC 999723.
- **UPI AutoPay:** no extra authentication is needed for debits up to ₹15,000, and the member must get a pre-debit notice 24 hours before each debit (RBI e-mandate framework, 2026).
- **WhatsApp India rates:** marketing about ₹0.86/message; utility about ₹0.115–0.145/message. Service replies are free, and utility messages sent inside an open 24-hour window are free.
- **DPDP Act:** full compliance required by about 13 May 2027.

## Next steps
- Add DNS records `gym.avnix.in` and `*.gym.avnix.in` → 147.93.170.241 (Hostinger), then re-check domains in the admin console.
- Configure each gym's Twilio SMS service / WhatsApp sender, and WhatsApp Content templates for out-of-window reminders.
- Field validation: interview 15–20 Vizag gym owners and recruit 5 design partners (plan §10, §13).
