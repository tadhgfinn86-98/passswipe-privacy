export const faqs = [
  {
    question: "What is an AI agent?",
    answer:
      "An AI agent is software that can take an instruction, gather the context it needs from your tools, decide on the right steps, and carry them out. Unlike a chatbot, it acts — booking the meeting, updating the record, sending the follow-up — and reports back with what it did.",
  },
  {
    question: "How does it work?",
    answer:
      "You connect the tools your team already uses and describe an outcome in plain language. SkyAgent breaks the request into steps, checks each one against your permissions, and executes. Anything that needs a human decision is surfaced for approval rather than guessed at.",
  },
  {
    question: "What tools can I connect?",
    answer:
      "Slack, Gmail, Notion, Google Calendar, Google Drive, HubSpot, GitHub and forty more out of the box. Anything with a public API can be added through custom connectors, and your agent adapts to a new tool as soon as it is linked.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. Data is encrypted in transit and at rest, scoped by role-based permissions, and never used to train shared models. Every action the agent takes is logged in a full audit trail, and enterprise workspaces add SSO, SCIM and regional data residency.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Anytime, from your billing settings, with no exit call and no cancellation fee. You keep access until the end of the period you have paid for, and you can export your workflow history on the way out.",
  },
  {
    question: "How much time can it save?",
    answer:
      "Teams on Pro report around twelve hours saved per person per week within the first month, concentrated in scheduling, inbox triage and status reporting. Your dashboard measures the real number for your workspace rather than asking you to trust an average.",
  },
] as const;
