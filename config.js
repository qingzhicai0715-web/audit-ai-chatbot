/**
 * STUDY CONTENT — edit this file to change what participants see.
 *
 * Both conditions read exactly the same text and timing from here, so the only
 * difference between Condition A and Condition B is how the recommendation is revealed:
 *   A (/a): shown automatically as soon as processing finishes
 *   B (/b): hidden behind the "View AI Recommendation" button
 */
window.STUDY_CONFIG = {
  assistantName: 'Audit AI Assistant',
  assistantSubtitle: 'AI-enabled audit support tool',

  // First message from the assistant when the page opens (set to '' to hide it).
  greeting:
    'Hello. I can analyse the client documentation for this engagement. Send your request when you are ready.',

  // The auditor's request. It is pre-filled in the message box; the participant only clicks Send.
  auditorRequest:
    "Please evaluate management's goodwill impairment assumptions for the Retail CGU and provide a preliminary recommendation.",

  // true = the request is sent automatically when the page loads (no Send click needed).
  autoStart: false,

  // How long the AI "works" before the analysis is complete (seconds). Identical in both conditions.
  processingSeconds: 8,

  // Status lines shown one after another while the AI is processing.
  processingSteps: [
    "Reading management's impairment model",
    'Comparing revenue growth and discount rate with industry benchmarks',
    'Running sensitivity analysis on key assumptions',
    'Preparing preliminary recommendation',
  ],

  completeMessage: 'The AI analysis is complete.',
  recommendationLabel: 'Preliminary recommendation:',
  recommendationText: "Management's impairment assumptions appear reasonable.",

  // Condition B only.
  viewButtonLabel: 'View AI Recommendation',

  // Shown after processing finishes, only when the link contains ?return=<url> (e.g. back to Qualtrics).
  continueButtonLabel: 'Continue',
};
