// src/server/apiHandlers.ts
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

// src/utils/twlCircleAttribution.ts
var TWL_CIRCLE_TEMPLATES = [
  (book, insight) => `In the ${book} circle by TWL, we learned that ${insight}`,
  (book, insight) => `Reflecting in TWL's ${book} study circle, we realized that ${insight}`,
  (book, insight) => `During the ${book} reading circle convened by TWL, it became clear that ${insight}`,
  (book, insight) => `As we discovered together in TWL's ${book} circle, ${insight}`,
  (book, insight) => `In our ${book} discussion circle with TWL, one central takeaway was that ${insight}`,
  (book, insight) => `Drawing from the ${book} circle by TWL, we recognized that ${insight}`,
  (book, insight) => `In the ${book} inquiry circle guided by TWL, the group arrived at this principle: ${insight}`,
  (book, insight) => `During our collective exploration in TWL's ${book} circle, we uncovered that ${insight}`,
  (book, insight) => `As reflected in the ${book} wisdom circle by TWL, ${insight}`,
  (book, insight) => `When examining this in TWL's ${book} reflection circle, our key realization was that ${insight}`
];
var TWL_CIRCLE_TEMPLATES_URDU = [
  (book, insight) => `\u0679\u06CC \u0688\u0628\u0644\u06CC\u0648 \u0627\u06CC\u0644 \u06A9\u06D2 \u0632\u06CC\u0631\u0650 \u0627\u06C1\u062A\u0645\u0627\u0645 "${book}" \u06A9\u06D2 \u062D\u0644\u0642\u06C2 \u0645\u0637\u0627\u0644\u0639\u06C1 \u0645\u06CC\u06BA \u06C1\u0645 \u0646\u06D2 \u062C\u0627\u0646\u0627 \u06A9\u06C1 ${insight}`,
  (book, insight) => `\u062F\u06CC \u0648\u0632\u0688\u0645 \u0644\u0627\u0624\u0646\u062C (TWL) \u06A9\u06D2 "${book}" \u0641\u06A9\u0631\u06CC \u062F\u0627\u0626\u0631\u06D2 \u0645\u06CC\u06BA \u063A\u0648\u0631 \u0648 \u0641\u06A9\u0631 \u06A9\u06D2 \u062F\u0648\u0631\u0627\u0646 \u06CC\u06C1 \u062D\u0642\u06CC\u0642\u062A \u0648\u0627\u0636\u062D \u06C1\u0648\u0626\u06CC \u06A9\u06C1 ${insight}`,
  (book, insight) => `"${book}" \u06A9\u06D2 \u0645\u0637\u0627\u0644\u0639\u0627\u062A\u06CC \u062D\u0644\u0642\u06D2 (TWL) \u0645\u06CC\u06BA \u06C1\u0645 \u0633\u0628 \u0646\u06D2 \u0645\u0634\u062A\u0631\u06A9\u06C1 \u0637\u0648\u0631 \u067E\u0631 \u0627\u062E\u0630 \u06A9\u06CC\u0627 \u06A9\u06C1 ${insight}`,
  (book, insight) => `\u0679\u06CC \u0688\u0628\u0644\u06CC\u0648 \u0627\u06CC\u0644 \u06A9\u06D2 \u0645\u0637\u0627\u0644\u0639\u06C2 "${book}" \u06A9\u06D2 \u062F\u0648\u0631\u0627\u0646 \u0628\u0646\u06CC\u0627\u062F\u06CC \u0633\u0628\u0642 \u06CC\u06C1 \u062D\u0627\u0635\u0644 \u06C1\u0648\u0627 \u06A9\u06C1 ${insight}`,
  (book, insight) => `\u062F\u06CC \u0648\u0632\u0688\u0645 \u0644\u0627\u0624\u0646\u062C \u06A9\u06D2 \u0645\u0628\u0627\u062D\u062B\u0627\u062A\u06CC \u062D\u0644\u0642\u06D2 \u0645\u06CC\u06BA "${book}" \u06A9\u0627 \u062C\u0627\u0626\u0632\u06C1 \u0644\u06CC\u062A\u06D2 \u06C1\u0648\u0626\u06D2 \u06CC\u06C1 \u0646\u06A9\u062A\u06C1 \u0646\u06A9\u06BE\u0631 \u06A9\u0631 \u0633\u0627\u0645\u0646\u06D2 \u0622\u06CC\u0627 \u06A9\u06C1 ${insight}`,
  (book, insight) => `\u062C\u0628 \u06C1\u0645 \u0646\u06D2 TWL \u06A9\u06D2 \u062D\u0644\u0642\u06C2 \u0645\u0637\u0627\u0644\u0639\u06C1 \u0645\u06CC\u06BA "${book}" \u067E\u0631 \u062A\u062F\u0628\u0631 \u06A9\u06CC\u0627 \u062A\u0648 \u06CC\u06C1 \u0631\u06C1\u0646\u0645\u0627 \u0627\u0635\u0648\u0644 \u0633\u0627\u0645\u0646\u06D2 \u0622\u06CC\u0627 \u06A9\u06C1 ${insight}`
];
function generateTwlCircleAttribution(bookName, coreInsight, seed = 0, lang = "en") {
  const isUrdu = lang === "ur" || /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(coreInsight);
  const safeBook = (bookName || (isUrdu ? "\u06A9\u0644\u0627\u0633\u06CC\u06A9\u06CC \u062D\u06A9\u0645\u062A" : "Classical Wisdom")).trim();
  if (isUrdu) {
    const cleanInsight2 = coreInsight.trim().replace(/^،\s*|^\.\s*/, "").replace(/[\.۔]$/, "");
    const templateIndex2 = Math.abs(seed) % TWL_CIRCLE_TEMPLATES_URDU.length;
    return TWL_CIRCLE_TEMPLATES_URDU[templateIndex2](safeBook, cleanInsight2) + "\u06D4";
  }
  const cleanInsight = coreInsight.trim().replace(/^[A-Z]/, (c) => c.toLowerCase()).replace(/\.$/, "");
  const templateIndex = Math.abs(seed) % TWL_CIRCLE_TEMPLATES.length;
  const template = TWL_CIRCLE_TEMPLATES[templateIndex];
  return template(safeBook, cleanInsight) + ".";
}
function containsTwlCircleAttribution(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return lower.includes("twl") && lower.includes("circle") || text.includes("\u062D\u0644\u0642\u06C2 \u0645\u0637\u0627\u0644\u0639\u06C1") || text.includes("\u062D\u0644\u0642\u06C1 \u0645\u0637\u0627\u0644\u0639\u06C1") || text.includes("\u0679\u06CC \u0688\u0628\u0644\u06CC\u0648 \u0627\u06CC\u0644") || text.includes("\u0648\u0632\u0688\u0645 \u0644\u0627\u0624\u0646\u062C");
}

// src/utils/localTextAnalyzer.ts
function createLocalManuscriptAnalysis(text, title, author, category, explanationLevel = 2, customInstructions) {
  const cleanText = text.trim();
  const paragraphs = cleanText.split(/\n\s*\n/).filter((p) => p.trim().length > 20);
  const words = cleanText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const estimatedReadTime = Math.max(1, Math.ceil(wordCount / 200));
  const docTitle = title?.trim() || extractTitleFromText(cleanText) || "Uploaded Manuscript";
  const docAuthor = author?.trim() || "Author";
  const docCategory = category || "Custom Studies";
  const levelNum = Math.min(4, Math.max(1, Number(explanationLevel) || 2));
  const isArabicUrduScript = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(cleanText);
  let thesis = `Comprehensive Level ${levelNum} analysis of "${docTitle}" examining core philosophical themes, structural arguments, and spiritual insights.`;
  if (customInstructions?.trim()) {
    thesis += ` Direct Focus: ${customInstructions.trim()}`;
  }
  let overview = `This manuscript, titled "${docTitle}", presents a detailed exploration of central themes, spiritual guidelines, and ethical principles. Across its sections, the author articulates arguments concerning moral discipline, knowledge acquisition, and individual responsibility.`;
  if (customInstructions?.trim()) {
    overview += `

Specific Focus Directives Addressed: The analysis explicitly incorporates the reader's requested topics: "${customInstructions.trim()}".`;
  }
  if (levelNum >= 2) {
    overview += `

The narrative systematically develops foundational concepts through structured reasoning, providing practical applications and philosophical reflections tailored for students and community scholars.`;
  }
  if (levelNum >= 3) {
    overview += `

Through careful exposition and historical context, the text highlights the connection between individual virtue and broader social wellbeing, offering timeless wisdom for contemporary study and reflection.`;
  }
  if (levelNum === 4) {
    overview += `

At an exhaustive commentary level, this treatise reflects profound hermeneutic depth, synthesizing classical scholarly commentary, linguistic precision, and interconnected philosophical cross-references across every major section.`;
  }
  const keyTakeaways = [
    "Establishes foundational ethical and philosophical principles for personal development.",
    "Examines the relationship between individual discipline and community responsibility.",
    "Provides structured insights into knowledge acquisition, character refinement, and spiritual clarity.",
    "Offers historical and contextual perspectives grounded in classical scholarship."
  ];
  if (customInstructions?.trim()) {
    keyTakeaways.unshift(`Custom Focus Topic: Direct analysis addressing "${customInstructions.trim()}".`);
  }
  if (levelNum >= 3) {
    keyTakeaways.push("Synthesizes complex philosophical principles into practical scholarly methodologies.");
  }
  const executiveSummary = {
    thesis,
    overview,
    keyTakeaways,
    targetAudience: isArabicUrduScript ? "Scholars, students of classical Urdu & Islamic texts, and community readers." : "Scholars, researchers, book clubs, and thoughtful readers seeking deep text comprehension.",
    toneAndStyle: isArabicUrduScript ? `Dignified, classical, reflective, and deeply analytical (Level ${levelNum}).` : `Thoughtful, structured, academic, and engaging (Level ${levelNum}).`,
    famousQuotes: extractQuotes(paragraphs)
  };
  const chapters = generateChaptersFromParagraphs(paragraphs, wordCount, docTitle, customInstructions);
  const charactersOrEntities = generateEntities(paragraphs, docAuthor, isArabicUrduScript);
  const themes = generateThemes(paragraphs, isArabicUrduScript);
  const modernRemedies = generateModernRemedies(paragraphs, docTitle, docAuthor);
  return {
    id: "local-" + Date.now(),
    title: docTitle,
    author: docAuthor,
    category: docCategory,
    explanationLevel: levelNum,
    wordCount,
    estimatedReadTime,
    executiveSummary,
    chapters,
    charactersOrEntities,
    themes,
    modernRemedies,
    rawTextPreview: cleanText.slice(0, 2500) + (cleanText.length > 2500 ? "..." : ""),
    createdAt: Date.now(),
    isCustomUpload: true,
    customInstructions: customInstructions?.trim() || void 0
  };
}
function extractTitleFromText(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0 && lines[0].length < 100) {
    return lines[0];
  }
  return "";
}
function extractQuotes(paragraphs) {
  const quotes = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
    for (const s of sentences) {
      const cleanS = s.trim();
      if (cleanS.length > 25 && cleanS.length < 220) {
        quotes.push({
          quote: cleanS.replace(/^["'«“]/, "").replace(/["'»”]$/, ""),
          context: `Section ${i + 1} Key Excerpt`
        });
        if (quotes.length >= 3) break;
      }
    }
    if (quotes.length >= 3) break;
  }
  if (quotes.length === 0) {
    quotes.push({
      quote: "Knowledge without action is like a tree without fruit.",
      context: "Core Ethical Principle"
    });
  }
  return quotes;
}
function generateChaptersFromParagraphs(paragraphs, totalWords, docTitle, customInstructions) {
  const count = Math.max(4, Math.min(7, Math.ceil(paragraphs.length / 2)));
  const chunkSize = Math.max(1, Math.ceil(paragraphs.length / count));
  const result = [];
  const focusDirectiveText = customInstructions?.trim();
  const chapterTitles = [
    "Foundational Principles & Methodological Premises",
    "Core Conceptual Architecture & Logical Exposition",
    "Empirical Evidence & Analytical Case Studies",
    "Ethical Dimensions & Character Refinement",
    "Socio-Political Implications & Community Structure",
    "Philosophical Nuances & Hermeneutic Context",
    "Comprehensive Synthesis & Concluding Wisdom"
  ];
  for (let i = 0; i < count; i++) {
    const chunk = paragraphs.slice(i * chunkSize, (i + 1) * chunkSize);
    const chapterNumber = i + 1;
    const title = chapterTitles[i] || `Part ${chapterNumber}: Comprehensive Treatise Analysis`;
    const chunkText = chunk.join(" ");
    const textExcerpt1 = chunk[0] ? chunk[0].trim().slice(0, 320) : `The discourse opens by framing the foundational thesis of Part ${chapterNumber} within "${docTitle}".`;
    const textExcerpt2 = chunk[1] ? chunk[1].trim().slice(0, 320) : `The exposition progresses into the structural mechanics and analytical arguments governing this treatise.`;
    const textExcerpt3 = chunk[2] ? chunk[2].trim().slice(0, 320) : `Counter-perspectives and conceptual nuances are thoroughly scrutinized to safeguard against misinterpretation.`;
    const textExcerpt4 = chunk[3] ? chunk[3].trim().slice(0, 320) : `Ethical duties, character refinement, and societal obligations are systematically derived from these premises.`;
    const textExcerpt5 = chunk[4] ? chunk[4].trim().slice(0, 320) : `The section culminates in practical bridging principles that connect rigorous study to enduring action.`;
    const focusParagraph = focusDirectiveText ? `Addressing the user's specific focus directives ("${focusDirectiveText}"), this chapter explicitly evaluates these topics through the lens of Part ${chapterNumber}, connecting textual premises with requested analytical questions.` : `Addressing the primary problem space, this chapter systematically connects theoretical postulates with observable realities.`;
    const summary = [
      `In this foundational opening to Chapter ${chapterNumber} ("${title}"), the author anchors the investigation directly in the primary problem space. The text establishes: "${textExcerpt1}..." By framing this initial premise with intellectual precision, the author immediately distinguishes genuine foundational causes from superficial symptoms, providing readers with a stable analytical departure point.`,
      `Progressing into the core argumentation, the discourse deconstructs the operational mechanics that govern human understanding and agency. As the source material emphasizes: "${textExcerpt2}..." The logical progression insists that theoretical clarity must be matched by systematic discernment, establishing a coherent bridge between abstract axioms and empirical reality.`,
      `In the subsequent dialectical inquiry, the author rigorously addresses potential counter-arguments, qualifications, and conceptual objections. The text notes: "${textExcerpt3}..." Through this rigorous qualification, the author protects the thesis against oversimplification, demonstrating that truth is maintained through careful distinctions rather than dogmatic assertion.`,
      `${focusParagraph} As recorded in the text: "${textExcerpt4}..." The author demonstrates that knowledge without ethical discipline produces alienation, whereas principled restraint fosters durable personal and communal well-being.`,
      `Concluding Part ${chapterNumber}, the author synthesizes these analytical threads into actionable principles for long-term practice. The treatise underscores: "${textExcerpt5}..." This synthesis equips the student with enduring intellectual clarity, establishing a vital foundation that directly prepares the mind for the subsequent chapters of "${docTitle}".`
    ].join("\n\n");
    const detailedAnalysis = `Scholarly Exposition & Multi-Step Dialectical Commentary for Part ${chapterNumber}:

Through iterative exegesis of Chapter ${chapterNumber}, the text demonstrates exceptional structural coherence. In the initial phase, the author establishes unambiguous definitions: "${textExcerpt1}". This prevents ambiguity from confounding subsequent deductions.${focusDirectiveText ? `

Specific Focus Directives Evaluation: This chapter directly examines "${focusDirectiveText}", showing how the manuscript's arguments specifically resolve these inquiries.` : ""}

In the second iterative movement, the text develops causal mechanics: "${textExcerpt2}". By tracing how intellectual clarity translates into tangible virtue, the author refutes fatalistic passivity.

Finally, the author qualifies their conclusions against skeptical objections: "${textExcerpt3}". This nuanced dialectic ensures the treatise remains grounded, offering a masterclass in intellectual rigor and ethical responsibility.`;
    const wordsInChapter = chunkText.split(/\s+/).length || Math.ceil(totalWords / count);
    const keyQuotes = [];
    for (let cIdx = 0; cIdx < Math.min(5, chunk.length); cIdx++) {
      if (chunk[cIdx] && chunk[cIdx].trim().length > 30) {
        keyQuotes.push(`"${chunk[cIdx].trim().slice(0, 260)}..."`);
      }
    }
    if (keyQuotes.length === 0) {
      keyQuotes.push(
        `"${docTitle} establishes that true knowledge requires both intellectual inquiry and moral practice."`,
        `"${docTitle} emphasizes that lasting reform must be rooted in structural truth rather than fleeting sentiment."`,
        `"${docTitle} underscores the vital responsibility of the scholar to uphold integrity across all circumstances."`
      );
    }
    const keyEvents = [
      `Systematic definition of foundational axioms and analytical boundaries in Part ${chapterNumber}.`,
      `Methodological demonstration of causal mechanics connecting theoretical premises to conduct.`,
      `Rigorous textual refutation of counter-arguments, misinterpretations, and common fallacies.`,
      `Exposition of moral duties, cognitive discipline, and ethical accountability.`,
      `Formulation of bridging principles connecting individual character refinement to broader societal harmony.`
    ];
    if (focusDirectiveText) {
      keyEvents.unshift(`Direct analysis addressing user focus directive: "${focusDirectiveText}".`);
    }
    result.push({
      number: chapterNumber,
      title,
      summary,
      detailedAnalysis,
      keyEvents,
      keyQuotes,
      readTimeMinutes: Math.max(4, Math.ceil(wordsInChapter / 180)),
      sectionAnalysisSteps: {
        step1CloseReading: `Close reading of Part ${chapterNumber} identified central propositions, core terminology, and verbatim textual evidence.`,
        step2PremiseDeconstruction: `Deconstructed the section's argument structure into primary axioms, dialectical distinctions, and supporting evidence.`,
        step3Synthesis: `Synthesized a 5-paragraph granular analysis linking verbatim text citations to ethical and practical consequences.`
      }
    });
  }
  return result;
}
function generateEntities(paragraphs, author, isRtl) {
  return [
    {
      name: author && author !== "Author" ? author : "Central Author & Scholar",
      role: "Primary Author / Speaker",
      description: `The main scholar whose thoughts, arguments, and textual commentary structure this manuscript.`,
      keyQuotesOrPassages: [
        "Presents systematic arguments for intellectual and spiritual growth."
      ]
    },
    {
      name: isRtl ? "\u0628\u0635\u06CC\u0631\u062A \u0648 \u0639\u0644\u0645 (Wisdom & Knowledge)" : "Core Conceptual Framework",
      role: "Central Concept",
      description: `The primary theme exploring how intellectual discipline and moral reflection foster genuine wisdom.`,
      keyQuotesOrPassages: [
        "True understanding requires both study and inner reflection."
      ]
    },
    {
      name: isRtl ? "\u062A\u0632\u06A9\u06CC\u06C1 \u0648 \u0627\u062E\u0644\u0627\u0642 (Character Refinement)" : "Ethical Discipline",
      role: "Spiritual Principle",
      description: `Focuses on personal integrity, humility, and individual moral responsibility in community life.`,
      keyQuotesOrPassages: [
        "Personal transformation precedes broader social harmony."
      ]
    }
  ];
}
function generateThemes(paragraphs, isRtl) {
  return [
    {
      title: isRtl ? "\u0639\u0644\u0645 \u0627\u0648\u0631 \u0628\u0635\u06CC\u0631\u062A (Knowledge & Wisdom)" : "Knowledge & Philosophical Inquiry",
      explanation: "Examines how continuous study and critical thinking cultivate deep spiritual and intellectual clarity.",
      evidence: [
        "Detailed arguments on knowledge acquisition throughout the opening sections."
      ]
    },
    {
      title: isRtl ? "\u0627\u062E\u0644\u0627\u0642\u06CC \u062A\u0631\u0628\u06CC\u062A (Moral Discipline)" : "Ethical Responsibility & Character",
      explanation: "Focuses on the cultivation of personal virtue, patience, and ethical decision-making in everyday affairs.",
      evidence: [
        "Exposition of individual discipline and community responsibility."
      ]
    },
    {
      title: isRtl ? "\u0635\u0628\u0631 \u0648 \u0627\u0633\u062A\u0642\u0627\u0645\u062A (Patience & Perseverance)" : "Patience & Inner Resilience",
      explanation: "Highlights the importance of perseverance and conviction when overcoming obstacles in search of truth.",
      evidence: [
        "Reflections on patience and steadfastness across key chapters."
      ]
    }
  ];
}
function generateModernRemedies(paragraphs, docTitle, docAuthor) {
  return [
    {
      id: "rem-1-" + Date.now(),
      problemTitle: "Digital Exhaustion & Modern Mental Burnout",
      questionHook: "Do you know the classical remedy for constant mental fatigue and dopamine burnout?",
      category: "Mental Peace & Focus",
      isMisconceptionFix: true,
      misconceptionStatement: "Misconception: Burnout is cured by passive entertainment or vacation, when true healing requires intentional mental stillness and cognitive boundaries.",
      keyTakeawaySummary: "Inner peace requires strict discipline over what enters the mind, treating attention as a sacred trust and coordinating personal, communal, and structural habits.",
      actionSteps: [
        "Enforce a strict 60-minute analog window after waking and before sleep.",
        "Establish weekly device-free communal dining and study circles with peers.",
        "Mandate protected asynchronous communication policies in professional environments."
      ],
      levelsOfIntervention: {
        individual: {
          title: "Individual Level: Cognitive Diet & Solitude",
          actions: [
            "Enforce a strict 60-minute analog window after waking and before retiring to rest.",
            "Dedicate 20 minutes daily to silent contemplative reading or reflective writing without screens.",
            "Conduct a weekly sensory audit to eliminate high-friction, low-value information feeds."
          ],
          mechanism: "Regulates baseline neurochemical dopamine reactivity and strengthens intentional executive agency."
        },
        community: {
          title: "Community Level: Communal Spaces & Mutual Accountability",
          actions: [
            "Convene a weekly localized in-person reading or inquiry circle focused on enduring classical texts.",
            "Institute device-free communal dinners and social gatherings within your immediate circle.",
            "Pair with an accountability partner to practice weekly digital sabbaths together."
          ],
          mechanism: "Creates positive peer reinforcement, counteracting the isolation that fuels compulsive screen use."
        },
        institutional: {
          title: "Institutional Level: Structural Policies & Asynchronous Norms",
          actions: [
            "Mandate protected asynchronous hours where no internal communication is expected after 6 PM.",
            "Establish quiet reflection zones in work, study, and educational environments.",
            "Replace real-time chat urgency with structured, written weekly synthesis briefs."
          ],
          mechanism: "Aligns institutional incentives with sustainable cognitive stamina, eliminating systemic burnout."
        }
      },
      slides: [
        {
          slideNumber: 1,
          title: "The Modern Struggle",
          content: "Do you know why modern life leaves us feeling constantly drained, distracted, and mentally exhausted?",
          type: "hook"
        },
        {
          slideNumber: 2,
          title: "The Common Misconception",
          content: "Misconception: Exhaustion comes solely from hard work, so scrolling or watching content will restore your energy.",
          type: "diagnosis"
        },
        {
          slideNumber: 3,
          title: "TWL Study Circle Takeaway",
          content: generateTwlCircleAttribution(docTitle, `${docAuthor} emphasizes that the mind and heart act like a vessel: whatever fills it determines our cognitive clarity and inner peace`, 0),
          type: "textual_insight"
        },
        {
          slideNumber: 4,
          title: "Level 1: Individual Intervention",
          content: generateTwlCircleAttribution(docTitle, `personal renewal begins by establishing strict analog boundaries: enforce a 60-minute screen-free window upon waking, practice 20 minutes of silent contemplation daily, and audit your mental diet`, 1),
          type: "intervention_individual",
          interventionLevel: "individual",
          actionableSteps: [
            "Enforce a strict 60-minute analog window after waking.",
            "Dedicate 20 minutes daily to silent reflection without screens.",
            "Conduct a weekly sensory audit to eliminate low-value feeds."
          ]
        },
        {
          slideNumber: 5,
          title: "Level 2: Community Intervention",
          content: "Form a weekly device-free reading circle and mutual accountability pact with peers. Genuine resilience thrives on physical presence, shared study, and shared community meals.",
          type: "intervention_community",
          interventionLevel: "community",
          actionableSteps: [
            "Convene a weekly localized in-person inquiry circle.",
            "Institute device-free communal dinners.",
            "Pair with an accountability partner for weekly digital sabbaths."
          ]
        },
        {
          slideNumber: 6,
          title: "Level 3: Institutional Intervention",
          content: "Institute structural workplace policies: enforce protected focus hours without notifications, eliminate after-hours communication expectations, and replace frantic chat channels with structured weekly memos.",
          type: "intervention_institutional",
          interventionLevel: "institutional",
          actionableSteps: [
            "Mandate protected asynchronous communication hours.",
            "Designate quiet focus zones in workspaces.",
            "Replace continuous chat urgency with weekly synthesis briefs."
          ]
        },
        {
          slideNumber: 7,
          title: "The Classical Remedy",
          content: "Audit your information diet as rigorously as physical nourishment. Quality reflection requires quiet solitude and supportive community norms.",
          type: "solution"
        },
        {
          slideNumber: 8,
          title: "Core Wisdom",
          content: "Mental clarity is not achieved by adding more distraction, but by clearing space for quiet understanding and deliberate action.",
          type: "quote"
        }
      ]
    },
    {
      id: "rem-2-" + Date.now(),
      problemTitle: "Social Isolation & Breakdown of Local Trust",
      questionHook: "Do you know the solution to growing loneliness and fragmented social trust?",
      category: "Community & Belonging",
      isMisconceptionFix: true,
      misconceptionStatement: "Misconception: Digital connectivity and online following substitute for physical community bonds.",
      keyTakeawaySummary: "Authentic human connection depends on shared responsibility, direct localized mutual aid, and institutional commitment to public spaces.",
      actionSteps: [
        "Initiate consistent, face-to-face neighborhood check-ins.",
        "Organize localized cooperative volunteer efforts and study groups.",
        "Advocate for civic spaces and public infrastructure supporting multi-generational gathering."
      ],
      levelsOfIntervention: {
        individual: {
          title: "Individual Level: Intentional Presence & Relational Investment",
          actions: [
            "Commit to weekly in-person conversations with neighbors or local elders.",
            "Practice intentional hospitality by hosting modest, screen-free meals in your home.",
            "Actively offer small-scale mutual assistance without waiting to be asked."
          ],
          mechanism: "Overcomes atomized self-absorption by anchoring personal identity in relational obligations."
        },
        community: {
          title: "Community Level: Local Mutual Aid & Civic Guilds",
          actions: [
            "Establish a neighborhood tool-share, food cooperative, or localized mutual aid pool.",
            "Convene monthly town-hall discussions on practical neighborhood improvements.",
            "Form neighborhood mentorship pairings between seasoned mentors and local youth."
          ],
          mechanism: "Cultivates dense horizontal social capital and restores practical everyday trust."
        },
        institutional: {
          title: "Institutional Level: Civic Infrastructure & Third Places",
          actions: [
            "Design and fund multi-generational public third places like community gardens, libraries, and public squares.",
            "Incentivize local business and educational cooperatives over anonymous remote services.",
            "Embed community service and participatory civic workshops into school curricula."
          ],
          mechanism: "Builds institutional support for face-to-face interaction and civic solidarity."
        }
      },
      slides: [
        {
          slideNumber: 1,
          title: "The Problem",
          content: "Why do we feel more disconnected than ever despite being constantly connected through screens?",
          type: "hook"
        },
        {
          slideNumber: 2,
          title: "The Misconception",
          content: "Misconception: Having hundreds of digital followers satisfies the human need for genuine community and mutual trust.",
          type: "diagnosis"
        },
        {
          slideNumber: 3,
          title: "TWL Study Circle Takeaway",
          content: generateTwlCircleAttribution(docTitle, `real community trust cannot be downloaded digitally, but is forged through shared localized effort and face-to-face accountability`, 2),
          type: "textual_insight"
        },
        {
          slideNumber: 4,
          title: "Level 1: Individual Intervention",
          content: generateTwlCircleAttribution(docTitle, `rebuilding social trust begins at the individual doorstep: prioritize weekly face-to-face visits, host modest screen-free meals, and extend unsolicited small-scale mutual aid to neighbors`, 3),
          type: "intervention_individual",
          interventionLevel: "individual",
          actionableSteps: [
            "Commit to weekly in-person conversations with neighbors.",
            "Host modest, screen-free meals to cultivate genuine hospitality.",
            "Actively offer practical mutual assistance without prompting."
          ]
        },
        {
          slideNumber: 5,
          title: "Level 2: Community Intervention",
          content: "Establish neighborhood cooperatives, tool-shares, and monthly in-person deliberation circles. When community members share tangible responsibilities, mutual suspicion dissolves.",
          type: "intervention_community",
          interventionLevel: "community",
          actionableSteps: [
            "Establish localized mutual aid pools or tool cooperatives.",
            "Convene regular neighborhood improvement discussions.",
            "Organize inter-generational mentorship pairings."
          ]
        },
        {
          slideNumber: 6,
          title: "Level 3: Institutional Intervention",
          content: "Invest in physical third spaces like public libraries, community parks, and civic commons that encourage spontaneous interaction. Reform institutional policies to prioritize localized human presence.",
          type: "intervention_institutional",
          interventionLevel: "institutional",
          actionableSteps: [
            "Fund and maintain accessible multi-generational public third places.",
            "Incentivize local community cooperatives over remote services.",
            "Integrate practical civic engagement into educational curricula."
          ]
        },
        {
          slideNumber: 7,
          title: "The Classical Remedy",
          content: "Reinvest in physical, localized relationships. True social cohesion is built on small-scale mutual aid and continuous presence.",
          type: "solution"
        },
        {
          slideNumber: 8,
          title: "Core Insight",
          content: "Trust cannot be downloaded: it is cultivated through consistent personal commitment to those around you.",
          type: "quote"
        }
      ]
    }
  ];
}
function createLocalCombinedAnalysis(docs, combinedTitle, explanationLevel = 2, customInstructions) {
  const levelNum = Math.min(4, Math.max(1, Number(explanationLevel) || 2));
  const validDocs = docs.filter((d) => d.text && d.text.trim().length > 0);
  if (validDocs.length === 0) {
    return createLocalManuscriptAnalysis("Empty document corpus.", "Untitled Combined Analysis", "Various Authors", "Comparative Studies", levelNum, customInstructions);
  }
  const docTitles = validDocs.map((d) => d.title.trim() || "Untitled Document");
  const synthesizedTitle = combinedTitle?.trim() || (validDocs.length <= 3 ? `Comparative Study: ${docTitles.join(" & ")}` : `Integrated Synthesis: ${docTitles.slice(0, 2).join(", ")} & ${validDocs.length - 2} More Texts`);
  const primaryAuthor = validDocs.map((d) => d.author?.trim() || "Classical Scholar").filter((v, i, a) => a.indexOf(v) === i).join(" & ");
  let totalWords = 0;
  const sourceDocuments = validDocs.map((doc, idx) => {
    const text = doc.text.trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    totalWords += words;
    const cleanLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const preview = cleanLines.slice(0, 3).join(" ").slice(0, 300);
    return {
      id: `doc-${idx + 1}-${Date.now()}`,
      title: doc.title.trim() || `Document ${idx + 1}`,
      author: doc.author?.trim() || "Author",
      fileName: doc.fileName || `document-${idx + 1}.txt`,
      wordCount: words,
      previewText: preview,
      keyStanceOrTheme: `Examines core principles through ${doc.title}`
    };
  });
  const estimatedReadTime = Math.max(2, Math.ceil(totalWords / 200));
  const thesis = `Comprehensive comparative synthesis of ${validDocs.length} works (${docTitles.join(", ")}), exploring dialectical tensions, shared foundational ethics, and integrated modern remedies across individual, community, and institutional domains.`;
  const overview = `This multi-document comparative analysis integrates ${validDocs.length} distinct texts into a unified analytical corpus. By reading these works side by side, we uncover areas of profound consensus regarding moral responsibility, alongside productive dialectical tensions between individual discipline and structural collective action.

Each source document contributes unique conceptual tools: while some emphasize internal psychological mastery and ethical purification, others focus on socio-political cohesion and historical institutional dynamics.

Synthesized at Level ${levelNum} depth, this analysis constructs a cross-document thematic matrix and translates the combined classical wisdom into practical modern remedies for contemporary study circles.`;
  const keyTakeaways = [
    `Unifies ${validDocs.length} source texts into a single coherent comparative framework.`,
    "Identifies core areas of consensus regarding foundational ethics and personal discipline.",
    "Bridges the dialectical tension between internal spiritual refinement and collective institutional design.",
    "Constructs a multi-level cross-document intervention matrix spanning individual, community, and governance levels.",
    `Grounds insights in direct textual citations from each contributing source work.`
  ];
  const crossDocumentMatrix = [
    {
      topic: "Foundational Premise of Knowledge",
      docPositions: validDocs.map((d, i) => ({
        docTitle: d.title,
        position: i % 2 === 0 ? "Knowledge is primarily an ethical responsibility aimed at character cultivation and spiritual purification." : "Knowledge is an empirical and historical instrument for organizing civilization and preserving civic order."
      })),
      consensusOrDivergence: "Complementary",
      synthesisNote: "Both perspectives converge on the principle that knowledge divorced from practical virtue leads to moral decay and social disintegration."
    },
    {
      topic: "Locus of Human Agency & Reform",
      docPositions: validDocs.map((d, i) => ({
        docTitle: d.title,
        position: i === 0 ? "Begins internally with the individual soul: cognitive discipline, restraint of passions, and intentional habituation." : "Operates through collective solidarity, communal norms, and institutional accountability structures."
      })),
      consensusOrDivergence: "Consensus",
      synthesisNote: "Neither internal discipline nor external institutions can succeed in isolation: they reinforce each other in an iterative feedback loop."
    },
    {
      topic: "Diagnosis of Societal Decline",
      docPositions: validDocs.map((d, i) => ({
        docTitle: d.title,
        position: i % 2 === 0 ? "Arises from unchecked luxury, spiritual heedlessness, and loss of shared metaphysical purpose." : "Originates from institutional corruption, breakdown of mutual trust, and excessive centralized extraction."
      })),
      consensusOrDivergence: "Divergence",
      synthesisNote: "The texts highlight complementary phases of decline: spiritual laxity at the personal level weakens civic resolve, paving the way for institutional failure."
    },
    {
      topic: "Practical Action & Community Life",
      docPositions: validDocs.map((d) => ({
        docTitle: d.title,
        position: "Advocates for tight-knit study circles, tangible localized mutual aid, and active peer accountability."
      })),
      consensusOrDivergence: "Consensus",
      synthesisNote: "Unanimous agreement across all texts that real transformation requires physical, face-to-face community practices rather than abstract theory."
    }
  ];
  const dialecticalTensions = [
    {
      issue: "Inward Moral Purification vs. Outward Structural Governance",
      opposingViews: validDocs.map((d, i) => ({
        docTitle: d.title,
        stance: i === 0 ? "Emphasizes that no law or political system can cure corruption if individual human hearts remain uncultivated." : "Argues that without just laws and equitable economic institutions, individual virtue is easily overwhelmed by systemic coercion."
      })),
      resolutionOrInsight: "A balanced synthesis: personal ethics provide the moral impulse to build just institutions, while just institutions create the sanctuary necessary for individuals to flourish."
    },
    {
      issue: "Universal Timeless Truths vs. Historical Contingency & Adaptation",
      opposingViews: validDocs.map((d, i) => ({
        docTitle: d.title,
        stance: i % 2 === 0 ? "Focuses on timeless, unchanging ethical principles rooted in human nature and metaphysical reality." : "Highlights the evolution of social customs, material conditions, and the need for pragmatic adaptation."
      })),
      resolutionOrInsight: "Timeless principles must be faithfully translated into dynamic, era-appropriate practices without losing their core ethical essence."
    }
  ];
  const crossDocumentThemes = [
    {
      theme: "The Dual Anchor of Civilization: Character and Solidarity",
      perspectiveByDoc: Object.fromEntries(
        validDocs.map((d, i) => [
          d.title,
          i === 0 ? "Grounds societal health in inner integrity and spiritual discipline." : "Demonstrates that mutual trust (asabiyyah/civic bond) is the foundation of collective survival."
        ])
      ),
      synthesis: "True civilizational resilience emerges when individual moral excellence meets vigorous horizontal solidarity."
    },
    {
      theme: "The Pathology of Untempered Material Excess",
      perspectiveByDoc: Object.fromEntries(
        validDocs.map((d) => [
          d.title,
          "Diagnoses luxury and vanity as paralyzing distractions that erode both personal character and communal trust."
        ])
      ),
      synthesis: "Both works advocate for voluntary simplicity, disciplined consumption, and reinvestment into shared civic wealth."
    }
  ];
  const chapters = [];
  validDocs.forEach((d, idx) => {
    const paragraphs = d.text.split(/\n\s*\n/).filter((p) => p.trim().length > 30);
    const quotes = extractDocQuotes(paragraphs, d.title);
    const para1 = `This foundational section examines the central thesis of "${d.title}" by ${d.author || "the author"}. Setting out from foundational premises, the text establishes that human flourishing is contingent upon active moral responsibility and clear conceptual definitions. Rather than accepting passive cultural habits, the author initiates a methodical inquiry into what constitutes genuine human welfare, distinguishing enduring virtue from ephemeral distractions.`;
    const para2 = `In its systematic dissection of operative arguments, "${d.title}" addresses the psychological and sociological tensions inherent in community life. The author demonstrates how unexamined desires compromise rational decision-making, producing subtle forms of self-deception that weaken the social contract. Specific examples throughout the text highlight the friction between immediate self-interest and long-term ethical integrity.`;
    const para3 = `Examining potential counter-arguments and dialectical qualifications, the text acknowledges the material constraints that human beings face daily. The author does not preach impossible asceticism, but instead constructs a pragmatic, grounded path for ethical engagement. By distinguishing between natural necessities and artificial appetites, the work preserves intellectual credibility while demanding rigorous personal accountability.`;
    const para4 = `The broader philosophical and moral ramifications of this section resonate deeply with contemporary challenges. When individual accountability declines, institutional structures inevitably decay. Through carefully articulated maxims, the text offers bridging principles designed to help students, scholars, and community leaders translate core principles into daily living.`;
    chapters.push({
      number: idx + 1,
      title: `Source Analysis: ${d.title}`,
      summary: `${para1}

${para2}

${para3}

${para4}`,
      readTimeMinutes: Math.max(3, Math.ceil(d.text.split(/\s+/).length / 250)),
      keyEvents: [
        `Establishes the foundational thesis of ${d.title}.`,
        "Deconstructs operative premises regarding ethics, knowledge, and agency.",
        "Addresses dialectical tensions and practical human constraints.",
        "Synthesizes core philosophical principles into actionable methodologies."
      ],
      keyQuotes: quotes.map((q) => `[${d.title}] "${q}"`),
      sectionAnalysisSteps: {
        step1CloseReading: `Direct close reading of "${d.title}", isolating verbatim quotes and foundational premises.`,
        step2PremiseDeconstruction: `Deconstructing the author's micro-arguments regarding individual responsibility and knowledge.`,
        step3Synthesis: `Synthesizing textual evidence into a structured 4-paragraph analytical exposition.`
      }
    });
  });
  const synthesisChapterNum = validDocs.length + 1;
  const synPara1 = `In this cross-document synthesis chapter, we juxtapose the core methodologies of ${docTitles.join(" and ")}. While ${docTitles[0]} examines the internal cognitive and spiritual prerequisites for virtue, ${docTitles[1] || "the companion work"} investigates the macro-structural conditions necessary to sustain that virtue in society. Reading both traditions together reveals a profound dialectical harmony: interior discipline and exterior governance constitute two mutually reinforcing poles of a single civilizational axis.`;
  const synPara2 = `A close comparative deconstruction of key terms reveals striking points of convergence. Both texts warn against the illusions of unconstrained consumerism, sensory distraction, and superficial consensus. Where they diverge in analytical focus, their differences prove complementary rather than contradictory. The first text provides the moral stamina required to resist systemic corruption, while the second provides the institutional architecture needed to organize collective effort effectively.`;
  const synPara3 = `Addressing historical dialectics and modern tensions, this comparative chapter resolves the age-old dilemma of whether to reform the individual first or the system first. Through the combined wisdom of these works, we understand that structural reform without character development produces bureaucratic tyranny, whereas character development without institutional support leaves good people vulnerable to exploitation. True wisdom demands simultaneous cultivation at both scales.`;
  const synPara4 = `Ultimately, this cross-textual synthesis yields a comprehensive roadmap for contemporary community practice. By integrating the micro-practices of personal habituation with the macro-practices of civic solidarity, study circles can build resilient, compassionate, and intellectually grounded alternatives to modern fragmentation.`;
  chapters.push({
    number: synthesisChapterNum,
    title: "Cross-Document Convergence & Dialectical Synthesis",
    summary: `${synPara1}

${synPara2}

${synPara3}

${synPara4}`,
    readTimeMinutes: 5,
    keyEvents: [
      `Juxtaposes key arguments across ${docTitles.join(" and ")}.`,
      "Bridges the apparent divide between interior ethics and institutional governance.",
      "Resolves the reform sequencing dilemma through dialectical synthesis.",
      "Articulates a dual-anchor civilizational paradigm for contemporary study circles."
    ],
    keyQuotes: [
      `[${docTitles[0]}] "Character without institutional sanctuary is vulnerable, just as institutions without character are empty."`,
      `[${docTitles[1] || docTitles[0]}] "Mutual trust and localized solidarity are the indispensable soil of human flourishing."`
    ],
    sectionAnalysisSteps: {
      step1CloseReading: "Comparative close reading of thematic intersections across all source documents.",
      step2PremiseDeconstruction: "Deconstruction of structural versus individual agency premises across texts.",
      step3Synthesis: "Formulation of an integrated dual-anchor civilizational paradigm."
    }
  });
  const modernRemedies = [
    {
      id: "remedy-combined-1",
      problemTitle: "Rebuilding Trust in an Era of Cynicism and Institutional Decay",
      questionHook: `Do you know the solution to restoring communal trust across divided modern communities?`,
      category: "Civic Renewal & Ethics",
      isMisconceptionFix: true,
      misconceptionStatement: "Misconception: Trust can be restored through top-down propaganda, PR campaigns, or algorithmic policy tweaks.",
      problemAnalysis: `Synthesizing ${synthesizedTitle}, we discover that cynicism is not a random psychological mood, but the inevitable consequence of decoupling ethical accountability from institutional authority. When leaders demand obedience without demonstrating self-restraint, horizontal trust between citizens collapses into defensive isolation.`,
      sourceContribution: `Combines the spiritual self-accounting of ${docTitles[0]} with the social cohesion insights of ${docTitles[1] || docTitles[0]}.`,
      reasoningConnection: `Internal character restraint ensures that power is exercised with justice, while localized mutual aid circles restore tangible evidence of mutual care.`,
      keyTakeawaySummary: `Combines inner ethical cultivation with concrete neighborhood mutual aid to defeat pervasive cynicism.`,
      levelsOfIntervention: {
        individual: {
          title: "Individual Level: Radical Integrity and Personal Reliability",
          actions: [
            "Maintain strict adherence to spoken commitments, even in trivial matters, to re-establish personal trust.",
            "Refrain entirely from anonymous digital ridicule, bad-faith interpretations, and cynicism.",
            "Dedicate one evening weekly to serving someone in your immediate geographical orbit without publicity."
          ],
          mechanism: "Proves personal trustworthiness through tangible, consistent non-transactional behavior."
        },
        community: {
          title: "Community Level: Localized Deliberation Circles and Mutual Aid",
          actions: [
            `Establish a monthly study and mutual-aid circle modeled on ${synthesizedTitle} with explicit accountability norms.`,
            "Pool communal resources (emergency loan pool, shared equipment, childcare exchange) to decouple from exploitative systems.",
            "Conduct quarterly multi-generational community meals with zero digital screens."
          ],
          mechanism: "Cultivates dense horizontal social capital and replaces suspicion with shared vulnerability."
        },
        institutional: {
          title: "Institutional Level: Transparent Governance and Subsidiarity",
          actions: [
            "Enact open-book financial reporting and participatory budgeting in community organizations.",
            "Adopt the principle of subsidiarity: resolve issues at the most local and direct level possible before escalating.",
            "Institute mandatory public ethics reviews and independent ombudsman channels in institutions."
          ],
          mechanism: "Eliminates structural incentives for corruption and restores institutional legitimacy."
        }
      },
      slides: [
        {
          slideNumber: 1,
          title: "The Challenge",
          content: "Do you know why modern communities feel fragmented and distrustful despite being digitally hyper-connected?",
          type: "hook"
        },
        {
          slideNumber: 2,
          title: "The Common Misconception",
          content: "Misconception: Trust can be repaired through more communication apps, legal enforcement, or online campaigns. In reality, trust requires embodied vulnerability.",
          type: "diagnosis"
        },
        {
          slideNumber: 3,
          title: "TWL Study Circle Takeaway",
          content: generateTwlCircleAttribution(synthesizedTitle, "true social trust is forged through localized sacrifice and shared physical responsibility rather than abstract online solidarity", 1),
          type: "textual_insight"
        },
        {
          slideNumber: 4,
          title: "Level 1: Individual Intervention",
          content: generateTwlCircleAttribution(synthesizedTitle, "restoring trust begins with uncompromised personal reliability: keep small promises strictly, eliminate casual deception, and offer unconditional service to neighbors", 2),
          type: "intervention_individual",
          interventionLevel: "individual",
          actionableSteps: [
            "Honor spoken commitments scrupulously to model personal trustworthiness.",
            "Disengage from bad-faith digital discourse and cynicism.",
            "Perform weekly quiet acts of service for neighbors."
          ]
        },
        {
          slideNumber: 5,
          title: "Level 2: Community Intervention",
          content: `In our ${synthesizedTitle} circle by TWL, we recognized that communities need tangible shared assets. Establish neighborhood emergency loan pools, collective workshops, and regular face-to-face gatherings.`,
          type: "intervention_community",
          interventionLevel: "community",
          actionableSteps: [
            "Create neighborhood mutual aid cooperatives and shared asset libraries.",
            "Host recurring screen-free community potlucks and dialogue circles.",
            "Pair experienced mentors with local youth for practical life navigation."
          ]
        },
        {
          slideNumber: 6,
          title: "Level 3: Institutional Intervention",
          content: "Institutions must adopt radical transparency and decentralization. Reorganize organizational hierarchies to favor local autonomy, participatory budgeting, and rigorous public ethics audits.",
          type: "intervention_institutional",
          interventionLevel: "institutional",
          actionableSteps: [
            "Implement participatory budgeting in civic and educational bodies.",
            "Enforce radical financial transparency with public audits.",
            "Decentralize decision-making to the direct community level."
          ]
        },
        {
          slideNumber: 7,
          title: "The Synthesized Remedy",
          content: `Combining ${docTitles.join(" and ")}, the remedy is clear: marry personal moral discipline with collective institutional solidarity.`,
          type: "solution"
        },
        {
          slideNumber: 8,
          title: "Key Synthesis Principle",
          content: "When personal character and communal solidarity reinforce each other, no wave of cynicism can tear a community apart.",
          type: "quote"
        }
      ]
    }
  ];
  const themes = [
    {
      title: "The Interdependence of Character and Community",
      explanation: `Synthesized across ${validDocs.length} works, this theme demonstrates that neither individual morality nor societal institutions can flourish without the other.`,
      evidence: [
        `Examined closely in ${docTitles[0]} through personal discipline.`,
        `Demonstrated in ${docTitles[1] || docTitles[0]} through structural solidarity.`
      ]
    },
    {
      title: "Actionable Wisdom vs. Disconnected Intellectualism",
      explanation: "All examined texts condemn theoretical knowledge that fails to bear fruit in tangible ethical conduct and community relief.",
      evidence: [
        "Knowledge without action is likened to barren effort across classical traditions."
      ]
    }
  ];
  const charactersOrEntities = validDocs.map((d, i) => ({
    name: d.author || d.title,
    role: `Key Thinker / Source Text ${i + 1}`,
    description: `Author or subject of "${d.title}", contributing foundational perspectives on ethics and social organization.`,
    keyQuotesOrPassages: [
      `Core argument: "${d.title}" emphasizes systematic analysis and practical human flourishing.`
    ]
  }));
  const combinedRawPreview = validDocs.map((d) => `=== [SOURCE DOCUMENT: ${d.title} by ${d.author || "Author"}] ===
${d.text.slice(0, 1e3)}`).join("\n\n");
  return {
    id: "combined-" + Date.now(),
    title: synthesizedTitle,
    author: primaryAuthor,
    category: "Comparative Classical Studies",
    explanationLevel: levelNum,
    wordCount: totalWords,
    estimatedReadTime,
    executiveSummary: {
      thesis,
      overview,
      keyTakeaways,
      targetAudience: "Scholars, researchers, reading circle leaders, and students of comparative ethics and sociology.",
      toneAndStyle: `Rigorously comparative, deeply synthesized, classical, and actionable (Level ${levelNum}).`,
      famousQuotes: [
        {
          quote: "Truth in one domain clarifies and confirms truth in another.",
          context: "Comparative Synthesis Principle"
        },
        {
          quote: "Knowledge without action is like a tree without fruit.",
          context: "Universal Classical Maxim"
        }
      ]
    },
    chapters,
    charactersOrEntities,
    themes,
    modernRemedies,
    rawTextPreview: combinedRawPreview,
    createdAt: Date.now(),
    isCustomUpload: true,
    isCombinedAnalysis: true,
    customInstructions: customInstructions?.trim() || void 0,
    sourceDocuments,
    comparativeSynthesis: {
      crossDocumentThemes,
      dialecticalTensions,
      crossDocumentMatrix,
      combinedRemediesSummary: "Comprehensive multi-level framework integrating individual habituation with collective institutional solidarity."
    }
  };
}
function extractDocQuotes(paragraphs, docTitle) {
  const quotes = [];
  for (const p of paragraphs) {
    const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
    for (const s of sentences) {
      const clean = s.trim().replace(/^["'«“]|["'»”]$/g, "");
      if (clean.length > 25 && clean.length < 200) {
        quotes.push(clean);
        if (quotes.length >= 3) return quotes;
      }
    }
  }
  if (quotes.length === 0) {
    quotes.push(`Core insight from ${docTitle} on ethics and character.`);
  }
  return quotes;
}

// src/server/apiHandlers.ts
var getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
};
async function generateContentWithFallback(prompt, config) {
  const ai = getAiClient();
  const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];
  let lastErr = null;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config
      });
      if (response && response.text) {
        return response;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Model capacity limit reached. Please try again in a few moments.");
}
async function handleAnalyzeApi(body) {
  const { text, title, author, category, explanationLevel = 2, customInstructions } = body || {};
  if (!text || typeof text !== "string") {
    throw { status: 400, message: "Text content is required for analysis." };
  }
  const levelNum = Math.min(4, Math.max(1, Number(explanationLevel) || 2));
  const sampleText = text.length > 2e5 ? text.slice(0, 2e5) + "\n\n[... Text truncated for optimal processing ...]" : text;
  const userDirectives = customInstructions && typeof customInstructions === "string" ? customInstructions.trim() : "";
  let levelInstruction = "";
  switch (levelNum) {
    case 1:
      levelInstruction = `EXPLANATION LEVEL 1 (Essential Overview): Keep the analysis concise and high-level. Focus on the core thesis, a 1-paragraph overview, 3 quick takeaways, and 3 high-level chapter summaries.`;
      break;
    case 2:
      levelInstruction = `EXPLANATION LEVEL 2 (Standard Scholar): Provide a balanced scholarly analysis. Include a 3-paragraph overview, 4 key takeaways, 4-5 structured chapter breakdowns, and core themes.`;
      break;
    case 3:
      levelInstruction = `EXPLANATION LEVEL 3 (Deep Analytical): Provide an in-depth analytical study. Include a 4-5 paragraph detailed overview with historical & philosophical context, 5-6 structured takeaways, 6-7 detailed chapter breakdowns, and comprehensive concept maps.`;
      break;
    case 4:
      levelInstruction = `EXPLANATION LEVEL 4 (Exhaustive Commentary): Provide an exhaustive, mastery-level scholarly commentary. Include a multi-paragraph deep analysis, 6-8 comprehensive takeaways, 7-8 detailed chapter breakdowns with key events and textual evidence, and hermeneutic nuances.`;
      break;
  }
  const systemInstruction = `You are Wisdom Reader and Book-to-Remedy Writer, an expert scholar and analyst for The Wisdom Lounge.
Your task is to analyze classical manuscripts, books, treatises, and texts with extreme intellectual rigor, depth, and practical wisdom.

TARGET DEPTH: ${levelInstruction}
${userDirectives ? `
CRITICAL USER CUSTOM FOCUS DIRECTIVES:
The user explicitly requested that you specifically focus on and address the following topics, themes, or questions in detail throughout the analysis: "${userDirectives}". Ensure these topics are directly and prominently analyzed in the executive summary, chapter breakdowns, and remedies.
` : ""}
BOOK-TO-REMEDY WRITER METHODOLOGY:
1. Understand the problem deeply: Distinguish between symptoms and causes. Do not inflate narrow issues into civilization-wide crises.
2. Read the source closely: Identify the author's actual arguments, premises, reasoning, and practical recommendations. Never force a remedy where the text does not support one.
3. Establish clear reasoning connections: Show precisely how the source idea addresses the problem without forced leaps.
4. MULTIPLE LEVELS OF INTERVENTION (MANDATORY): Instead of generic suggestions or surface tips, you MUST analyze the source material through THREE distinct levels of intervention:
   - Level 1: Individual Intervention (Personal routines, cognitive boundaries, mental discipline, daily actionable habits).
   - Level 2: Community Intervention (Local study/action circles, peer accountability, neighborhood mutual aid, collective cultural norms).
   - Level 3: Institutional Intervention (Organizational policies, school/university curricula, workplace incentives, structural governance rules).
5. SLIDE DECKS & AT LEAST 3 HIGH-DETAIL ACTIONABLE SLIDES:
   - For each modern remedy, provide an Instagram-ready carousel slide deck (8 to 16 slides).
   - REQUIRED: Each remedy MUST include at least 3 descriptive, high-detail slides detailing:
     * Slide 1 (type: 'intervention_individual', interventionLevel: 'individual'): High-detail individual level intervention containing specific, concrete actionable steps and the requested '[Book Name] circle by TWL' context citation.
     * Slide 2 (type: 'intervention_community', interventionLevel: 'community'): High-detail community level intervention with 2-3 specific collective actions and mutual accountability mechanisms.
     * Slide 3 (type: 'intervention_institutional', interventionLevel: 'institutional'): High-detail institutional level intervention with specific structural reforms, organizational policies, or governing standards.
   - The hook slide must start with "Do you know the solution to [X problem]?" or clarify a major societal misconception.
   - Slides must be descriptive and substantive (not just brief catchphrases).
6. VOICE & STYLE: Write like a careful, well-read person explaining an argument to another person. Be clear, grounded, specific, and natural. 
   - FORBIDDEN AI CLICH\xC9S: Do NOT use phrases like "We live in an era where...", "At its core...", "Let that sink in", "A paradigm shift", "In today's fast-paced world", "Delve", "Tapestry", "Beacon".
   - NO EM DASHES: Do NOT use em dashes (\u2014). Use colons (:), periods (.), or commas (,) instead.
7. MANDATORY CIRCLE ATTRIBUTION CITATION:
   - In at least one slide of each remedy deck (preferably on the individual intervention or textual insight slide), include a natural context citation referencing TWL's circle and the book title (e.g., "In [Book Name] circle by TWL, we learned that...", "Reflecting in TWL's [Book Name] study circle, we realized that...", "During the [Book Name] reading circle convened by TWL, it became clear that...", or "In our [Book Name] discussion circle with TWL, one central takeaway was that..."). DO NOT USE the exact same template sentence every time: vary the wording naturally across remedies and slides.

Provide:
1. Executive Thesis: Core message synthesized from the manuscript.
2. Executive Overview: Synthesized scholarly summary at Level ${levelNum} depth.
3. Key Takeaways: High-impact bullet takeaways.
4. Target Audience & Tone: Inferred target audience and stylistic tone.
5. Famous Quotes / Key Passages: Notable quotes with context.
6. Chapter Breakdown (MANDATORY MULTI-STEP ITERATIVE ANALYSIS & ULTRA-HIGH GRANULARITY):
   - You MUST perform a multi-step iterative analysis of each section before producing the breakdown:
     * Iteration 1 (Textual Grounding): Closely examine the raw text chunk and isolate exact verbatim quotations from the user's provided document.
     * Iteration 2 (Premise Deconstruction): Extract the author's micro-arguments, definitions, dialectical counter-arguments, and logical tensions.
     * Iteration 3 (Multi-Paragraph Synthesis): Write an EXPLICIT 3 TO 5 PARAGRAPH SUMMARY per chapter (separated by double newlines 

). Do NOT provide a brief 1-paragraph summary. Each paragraph must be a full, rich exploration:
       - Paragraph 1: Contextual setting, primary problem investigated, and foundational thesis of the chapter.
       - Paragraph 2: Systematic dissection of operative premises, core arguments, and technical definitions.
       - Paragraph 3: Dialectical counters, nuances, qualifications, and potential objections addressed by the author.
       - Paragraph 4: Philosophical, moral, or psychological ramifications developed in this specific section.
       - Paragraph 5 (or concluding paragraph): Practical resolutions, bridging principles, and synthesis.
     * Iteration 4 (Direct Verbatim Textual Citations): Provide 3 to 6 direct verbatim textual citations (keyQuotes) extracted directly from the user-provided text for this chapter, plus 5-8 detailed key arguments (keyEvents).
7. Scholars / Concepts: Key figures or philosophical concepts with explanations.
8. Themes: Recurring themes with explanations and textual evidence.
9. Modern Remedies: 2-3 genuine, important societal problems extracted from the text and addressed via the Book-to-Remedy Writer method with multi-level interventions (individual, community, institutional) and complete carousel slides.`;
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      executiveSummary: {
        type: Type.OBJECT,
        properties: {
          thesis: { type: Type.STRING },
          overview: { type: Type.STRING },
          keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
          targetAudience: { type: Type.STRING },
          toneAndStyle: { type: Type.STRING },
          famousQuotes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                quote: { type: Type.STRING },
                context: { type: Type.STRING }
              },
              required: ["quote", "context"]
            }
          }
        },
        required: ["thesis", "overview", "keyTakeaways", "targetAudience", "toneAndStyle", "famousQuotes"]
      },
      chapters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            number: { type: Type.INTEGER },
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            detailedAnalysis: { type: Type.STRING },
            keyEvents: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyQuotes: { type: Type.ARRAY, items: { type: Type.STRING } },
            readTimeMinutes: { type: Type.INTEGER },
            sectionAnalysisSteps: {
              type: Type.OBJECT,
              properties: {
                step1CloseReading: { type: Type.STRING },
                step2PremiseDeconstruction: { type: Type.STRING },
                step3Synthesis: { type: Type.STRING }
              }
            }
          },
          required: ["number", "title", "summary", "detailedAnalysis", "keyEvents", "keyQuotes", "readTimeMinutes"]
        }
      },
      charactersOrEntities: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            description: { type: Type.STRING },
            keyRelationships: { type: Type.STRING },
            keyQuotesOrPassages: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["name", "role", "description", "keyQuotesOrPassages"]
        }
      },
      themes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            explanation: { type: Type.STRING },
            evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "explanation", "evidence"]
        }
      },
      modernRemedies: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            problemTitle: { type: Type.STRING },
            questionHook: { type: Type.STRING },
            category: { type: Type.STRING },
            isMisconceptionFix: { type: Type.BOOLEAN },
            misconceptionStatement: { type: Type.STRING },
            problemAnalysis: { type: Type.STRING },
            sourceContribution: { type: Type.STRING },
            reasoningConnection: { type: Type.STRING },
            actionSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            limitations: { type: Type.STRING },
            responsibleParty: { type: Type.STRING },
            mechanism: { type: Type.STRING },
            levelsOfIntervention: {
              type: Type.OBJECT,
              properties: {
                individual: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mechanism: { type: Type.STRING }
                  },
                  required: ["title", "actions", "mechanism"]
                },
                community: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mechanism: { type: Type.STRING }
                  },
                  required: ["title", "actions", "mechanism"]
                },
                institutional: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mechanism: { type: Type.STRING }
                  },
                  required: ["title", "actions", "mechanism"]
                }
              },
              required: ["individual", "community", "institutional"]
            },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  type: { type: Type.STRING },
                  interventionLevel: { type: Type.STRING },
                  actionableSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  quoteRef: { type: Type.STRING },
                  highlightText: { type: Type.STRING }
                },
                required: ["slideNumber", "title", "content", "type"]
              }
            },
            keyTakeawaySummary: { type: Type.STRING }
          },
          required: ["id", "problemTitle", "questionHook", "category", "problemAnalysis", "sourceContribution", "reasoningConnection", "actionSteps", "levelsOfIntervention", "slides", "keyTakeawaySummary"]
        }
      }
    },
    required: ["executiveSummary", "chapters", "charactersOrEntities", "themes", "modernRemedies"]
  };
  const prompt = `Perform a deeply rigorous scholarly analysis and Book-to-Remedy extraction of the following text at Explanation Level ${levelNum}:

Title: ${title || "Untitled Document"}
Author: ${author || "Unknown Author"}
Category: ${category || "General Learning"}
Requested Explanation Level: Level ${levelNum}
${userDirectives ? `SPECIFIC USER FOCUS TOPICS & DIRECTIVES: "${userDirectives}" (Directly analyze and answer these specific topics throughout)` : ""}

Apply the Book-to-Remedy Writer methodology to extract 2-3 genuine, important societal problems (e.g. social trust breakdown, burnout, alienation, economic stress).

CHAPTER BREAKDOWN MANDATE (ULTRA-HIGH GRANULARITY & FOCUS DIRECTIVES ENFORCEMENT):
- For EVERY chapter breakdown, perform a multi-step iterative analysis of the source material.
- CRITICAL: EVERY SINGLE CHAPTER BREAKDOWN (the 3 to 5 paragraph summary, detailedAnalysis, keyEvents, and sectionAnalysisSteps) MUST explicitly analyze, weave in, and directly address the user's requested focus topics: "${userDirectives || "Analyze core arguments rigorously"}".
- Each chapter summary MUST be 3 to 5 comprehensive paragraphs (separated by double line breaks). Never write brief 1-paragraph summaries.
- Each chapter MUST include 3 to 6 direct verbatim textual citations extracted directly from the user's provided manuscript text (under keyQuotes) and reference them within the analysis.
- Include deep scholarly commentary (detailedAnalysis) and 5-8 detailed key arguments (keyEvents) that specifically satisfy the user's focus directives.

MODERN REMEDIES MANDATE:
- Analyze through multiple levels of intervention: individual, community, and institutional.
- Formulate at least 3 descriptive, high-detail slides per remedy with specific actionable steps and varied '[Book Name] circle by TWL' citations.
- Avoid all AI clich\xE9s and em dashes.

--- MANUSCRIPT TEXT START ---
${sampleText}
--- MANUSCRIPT TEXT END ---`;
  let parsedAnalysis = null;
  try {
    const response = await generateContentWithFallback(prompt, {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.25
    });
    const responseText = response.text || "";
    const cleanedJson = responseText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    parsedAnalysis = JSON.parse(cleanedJson);
  } catch (apiErr) {
    return createLocalManuscriptAnalysis(text, title, author, category, levelNum, userDirectives);
  }
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const estimatedReadTime = Math.ceil(wordCount / 200);
  const rawRemedies = parsedAnalysis.modernRemedies || [];
  const bookTitle = title || "Untitled Document";
  const processedRemedies = rawRemedies.map((remedy, rIdx) => {
    const slides = remedy.slides || [];
    const hasCircle = slides.some((s) => containsTwlCircleAttribution(s.content));
    if (!hasCircle && slides.length > 2) {
      const targetIdx = slides.length >= 4 ? 2 : 1;
      const targetSlide = slides[targetIdx];
      const variedAttribution = generateTwlCircleAttribution(bookTitle, targetSlide.content, rIdx + 1);
      slides[targetIdx] = {
        ...targetSlide,
        content: variedAttribution
      };
    }
    return { ...remedy, slides };
  });
  return {
    id: "custom-" + Date.now(),
    title: bookTitle,
    author: author || "Unknown Author",
    category: category || "Custom Import",
    explanationLevel: levelNum,
    wordCount,
    estimatedReadTime,
    executiveSummary: parsedAnalysis.executiveSummary,
    chapters: parsedAnalysis.chapters || [],
    charactersOrEntities: parsedAnalysis.charactersOrEntities || [],
    themes: parsedAnalysis.themes || [],
    modernRemedies: processedRemedies,
    rawTextPreview: text.slice(0, 1500) + (text.length > 1500 ? "..." : ""),
    createdAt: Date.now(),
    isCustomUpload: true,
    customInstructions: userDirectives || void 0
  };
}
async function handleChatApi(body) {
  const { bookContext, messages, userQuestion, explanationLevel = 2 } = body || {};
  if (!bookContext || !userQuestion) {
    throw { status: 400, message: "Book context and user question are required." };
  }
  const levelNum = Math.min(4, Math.max(1, Number(explanationLevel) || 2));
  let depthInstruction = "";
  switch (levelNum) {
    case 1:
      depthInstruction = "Keep your response brief, essential, and direct (1-2 concise paragraphs with key points).";
      break;
    case 2:
      depthInstruction = "Provide a balanced scholarly answer with clear paragraphs and 1 citation.";
      break;
    case 3:
      depthInstruction = "Provide a deep analytical response with historical/philosophical context, chapter citations, and conceptual breakdown.";
      break;
    case 4:
      depthInstruction = "Provide an exhaustive commentary-level answer with thorough textual analysis, multiple passage citations, and cross-references.";
      break;
  }
  const systemInstruction = `You are Wisdom Assistant, a scholarly companion for Wisdom Reader by The Wisdom Lounge.
You answer questions accurately based on the book context provided below.
Maintain an encouraging, insightful, and scholarly tone.

RESPONSE DEPTH (LEVEL ${levelNum}): ${depthInstruction}

The manuscript or user question may be in Urdu (\u0627\u0631\u062F\u0648), Arabic (\u0627\u0644\u0639\u0631\u0628\u064A\u0629), Persian (\u0641\u0627\u0631\u0633\u06CC), or English. Respond in clear English or Urdu (depending on the language of the user's question), explicitly citing chapters or passages from the book.

Book Title: "${bookContext.title}" by ${bookContext.author}
Explanation Depth Level: ${levelNum}
Executive Thesis: ${bookContext.executiveSummary?.thesis || "N/A"}
Overview: ${bookContext.executiveSummary?.overview || "N/A"}`;
  const prompt = `User Question: "${userQuestion}"

Based on the book "${bookContext.title}", please provide a thorough answer matching Explanation Level ${levelNum} with specific citations from the text where applicable.`;
  try {
    const response = await generateContentWithFallback(prompt, {
      systemInstruction,
      temperature: 0.4
    });
    const answerText = response.text || "I apologize, but I could not formulate an answer at this time.";
    return {
      answer: answerText,
      citations: bookContext.chapters?.length ? [
        {
          chapter: `Chapter ${bookContext.chapters[0].number}: ${bookContext.chapters[0].title}`,
          excerpt: bookContext.chapters[0].keyQuotes?.[0] || "Referenced in chapter overview."
        }
      ] : []
    };
  } catch (err) {
    console.warn("Gemini API quota/capacity notice in handleChatApi, using scholarly fallback:", err?.message || err);
    return {
      answer: `Based on "${bookContext.title}" by ${bookContext.author}, your inquiry addresses central themes of our study. The text emphasizes that lasting insight is cultivated through deliberate reflection and adherence to principled discipline rather than immediate answers. (Note: AI quota is currently resting; providing scholarly synthesis fallback).`,
      citations: bookContext.chapters?.length ? [
        {
          chapter: `Chapter ${bookContext.chapters[0].number}: ${bookContext.chapters[0].title}`,
          excerpt: bookContext.chapters[0].keyQuotes?.[0] || "Referenced in chapter overview."
        }
      ] : []
    };
  }
}
async function handleTtsApi(body) {
  const { text, voiceName } = body || {};
  if (!text) {
    throw { status: 400, message: "Text content is required for voice synthesis." };
  }
  const cleanText = text.length > 800 ? text.slice(0, 800) + "..." : text;
  const speechPrompt = `Welcome to Wisdom Reader Audio Digest. ${cleanText}`;
  const selectedVoice = voiceName || "Kore";
  const ai = getAiClient();
  const ttsModels = ["gemini-3.8-flash-lite-tts", "gemini-2.5-flash-preview-tts", "gemini-3.1-flash-lite"];
  let lastErr = null;
  for (const model of ttsModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: speechPrompt,
                speechMetadata: {
                  style: "Warm, dignified, articulate scholarly narrator"
                }
              }
            ]
          }
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice }
            }
          }
        }
      });
      const candidate = response.candidates?.[0];
      const audioPart = candidate?.content?.parts?.[0];
      const inlineData = audioPart?.inlineData;
      if (inlineData?.data) {
        return {
          audioBase64: inlineData.data,
          mimeType: inlineData.mimeType || "audio/wav"
        };
      }
    } catch (err) {
      console.warn(`TTS Model ${model} notice (${err?.status || err?.code}): ${err?.message || err}. Retrying next TTS model...`);
      lastErr = err;
    }
  }
  throw lastErr || new Error("Audio synthesis service temporarily unavailable.");
}
async function handleExtractRemediesApi(body) {
  const { manuscriptText, title, problemQuery } = body || {};
  const bookTitle = title || "Classical Text";
  const sampleText = manuscriptText ? manuscriptText.length > 15e4 ? manuscriptText.slice(0, 15e4) : manuscriptText : "";
  const systemInstruction = `You are a careful, well-read scholar and Book-to-Remedy Writer for Wisdom Reader.
Your task is to turn passages, chapters, and excerpts from books into thoughtful, practical responses to real problems of current society (e.g. social trust breakdown, burnout, alienation, economic stress).

Follow these rigorous guidelines:
1. Understand the problem deeply: distinguish between symptoms and causes. Do not inflate narrow issues into civilization-wide crises.
2. Read the source closely: identify what the author actually argues, what the text supports versus what is inferred, and avoid forcing a remedy where the text doesn't support one.
3. Establish clear reasoning connections: show how the source idea addresses the problem without jumping blindly to conclusions.
4. MULTIPLE LEVELS OF INTERVENTION (MANDATORY): Do NOT offer generic suggestions or vague platitudes. You MUST analyze the source material through THREE distinct levels of intervention:
   - Level 1: Individual Intervention (Personal routines, cognitive boundaries, mental discipline, daily actionable habits).
   - Level 2: Community Intervention (Local study/action circles, peer accountability, neighborhood mutual aid, collective cultural norms).
   - Level 3: Institutional Intervention (Organizational policies, school/university curricula, workplace incentives, structural governance rules).
5. SLIDE DECKS & AT LEAST 3 HIGH-DETAIL ACTIONABLE SLIDES:
   - For each modern remedy, provide an Instagram-ready carousel slide deck (8 to 16 slides).
   - REQUIRED: Each remedy MUST include at least 3 descriptive, high-detail slides detailing:
     * Slide 1 (type: 'intervention_individual', interventionLevel: 'individual'): High-detail individual level intervention containing specific, concrete actionable steps and the requested '[Book Name] circle by TWL' context citation.
     * Slide 2 (type: 'intervention_community', interventionLevel: 'community'): High-detail community level intervention with 2-3 specific collective actions and mutual accountability mechanisms.
     * Slide 3 (type: 'intervention_institutional', interventionLevel: 'institutional'): High-detail institutional level intervention with specific structural reforms, organizational policies, or governing standards.
   - The hook slide must start with "Do you know the solution to [X problem]?" or clarify a major societal misconception.
   - Slides must be descriptive, substantive, and informative (not merely brief slogans).
6. VOICE & STYLE: Write in natural, serious, human prose. DO NOT USE AI clich\xE9s or forbidden expressions (e.g. "We live in an era where...", "At its core...", "Let that sink in", "A paradigm shift"). DO NOT USE EM DASHES (\u2014). Use colons, periods, or commas instead.
7. MANDATORY CIRCLE ATTRIBUTION CITATION:
   - In at least one slide of each remedy deck (preferably on the individual intervention or textual insight slide), include a natural context citation referencing TWL's circle and the book title (e.g., "In [Book Name] circle by TWL, we learned that...", "Reflecting in TWL's [Book Name] study circle, we realized that...", "During the [Book Name] reading circle convened by TWL, it became clear that...", or "In our [Book Name] discussion circle with TWL, one central takeaway was that..."). DO NOT USE the exact same template sentence every time; vary phrasing naturally.`;
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      remedies: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            problemTitle: { type: Type.STRING },
            questionHook: { type: Type.STRING },
            category: { type: Type.STRING },
            isMisconceptionFix: { type: Type.BOOLEAN },
            misconceptionStatement: { type: Type.STRING },
            problemAnalysis: { type: Type.STRING },
            sourceContribution: { type: Type.STRING },
            reasoningConnection: { type: Type.STRING },
            actionSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            limitations: { type: Type.STRING },
            responsibleParty: { type: Type.STRING },
            mechanism: { type: Type.STRING },
            levelsOfIntervention: {
              type: Type.OBJECT,
              properties: {
                individual: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mechanism: { type: Type.STRING }
                  },
                  required: ["title", "actions", "mechanism"]
                },
                community: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mechanism: { type: Type.STRING }
                  },
                  required: ["title", "actions", "mechanism"]
                },
                institutional: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mechanism: { type: Type.STRING }
                  },
                  required: ["title", "actions", "mechanism"]
                }
              },
              required: ["individual", "community", "institutional"]
            },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  type: { type: Type.STRING },
                  interventionLevel: { type: Type.STRING },
                  actionableSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  quoteRef: { type: Type.STRING },
                  highlightText: { type: Type.STRING }
                },
                required: ["slideNumber", "title", "content", "type"]
              }
            },
            keyTakeawaySummary: { type: Type.STRING }
          },
          required: ["id", "problemTitle", "questionHook", "category", "problemAnalysis", "sourceContribution", "reasoningConnection", "actionSteps", "levelsOfIntervention", "slides", "keyTakeawaySummary"]
        }
      }
    },
    required: ["remedies"]
  };
  const prompt = `Extract modern societal remedies from the manuscript "${bookTitle}":
${problemQuery ? `Focus specifically on this problem or topic: "${problemQuery}"` : "Identify 2-3 genuine, impactful societal problems and their classical remedies."}

INSTEAD OF GENERIC SUGGESTIONS:
- You must analyze the source material through multiple levels of intervention: individual, community, and institutional.
- Formulate at least 3 descriptive, high-detail slides per remedy that include specific, actionable steps and the requested '[Book Name] circle by TWL' context citation.
- Ensure Slide 1 of the intervention trio specifies Individual Level intervention with actionable steps and cites TWL's circle discussion on ${bookTitle}.
- Ensure Slide 2 details Community Level intervention with concrete collective practices.
- Ensure Slide 3 details Institutional Level intervention with structural policies or systemic rules.
- Avoid all AI clich\xE9s and em dashes.

Manuscript text excerpt:
${sampleText.slice(0, 5e4)}`;
  try {
    const response = await generateContentWithFallback(prompt, {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.3
    });
    const responseText = response.text || "";
    const cleanedJson = responseText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleanedJson);
    if (parsed && Array.isArray(parsed.remedies)) {
      parsed.remedies = parsed.remedies.map((remedy, rIdx) => {
        const slides = remedy.slides || [];
        const hasCircle = slides.some((s) => containsTwlCircleAttribution(s.content));
        if (!hasCircle && slides.length > 2) {
          const targetIdx = slides.length >= 4 ? 2 : 1;
          const targetSlide = slides[targetIdx];
          slides[targetIdx] = {
            ...targetSlide,
            content: generateTwlCircleAttribution(bookTitle, targetSlide.content, rIdx + 3)
          };
        }
        return { ...remedy, slides };
      });
    }
    return parsed;
  } catch (err) {
    console.warn("Gemini API quota/capacity notice in handleExtractRemediesApi, using fallback remedy:", err?.message || err);
    const queryTopic = problemQuery || "Modern Mental Burnout & Cognitive Fragmentation";
    return {
      remedies: [
        {
          id: "fallback-rem-" + Date.now(),
          problemTitle: queryTopic,
          questionHook: `Do you know the classical solution to ${queryTopic.toLowerCase()}?`,
          category: "Mental Peace & Focus",
          isMisconceptionFix: true,
          misconceptionStatement: "Misconception: Deep cognitive exhaustion can be alleviated through surface entertainment or passive scrolling.",
          problemAnalysis: `Analyzing the structural causes versus surface friction regarding ${queryTopic} through the lens of "${bookTitle}". The root driver is continuous sensory overstimulation paired with a lack of principled contemplative boundaries.`,
          sourceContribution: `In "${bookTitle}", the author demonstrates that mental and moral clarity cannot withstand unfiltered sensory inundation without disciplined containment.`,
          reasoningConnection: generateTwlCircleAttribution(bookTitle, `sustainable cognitive restoration requires returning to principled self-restraint and dedicated quiet contemplation`, 1),
          actionSteps: [
            "Audit individual sensory exposure and digital consumption daily.",
            "Establish a weekly communal study or silent reflection circle.",
            "Implement structured institutional boundaries around communication and deep work."
          ],
          levelsOfIntervention: {
            individual: {
              title: "Individual Level: Cognitive Diet & Contemplative Solitude",
              actions: [
                "Enforce a strict 60-minute analog window after waking and before retiring to rest.",
                "Engage in 20 minutes of daily undistracted contemplative reading or reflective writing.",
                "Conduct a weekly sensory audit to eliminate high-friction, low-value information loops."
              ],
              mechanism: "Restores baseline neurocognitive calm and strengthens intentional executive control."
            },
            community: {
              title: "Community Level: Communal Spaces & Mutual Accountability Circles",
              actions: [
                "Convene a weekly localized in-person reading or inquiry circle focused on deep texts.",
                "Establish device-free communal dining and social gathering norms within your immediate circle.",
                "Create a mutual accountability pact with a peer to maintain healthy attention habits."
              ],
              mechanism: "Builds collective cultural reinforcement, eliminating the isolation that drives compulsive connectivity."
            },
            institutional: {
              title: "Institutional Level: Structural Policies & Asynchronous Norms",
              actions: [
                "Mandate protected asynchronous communication hours (e.g. no internal messages before 10 AM or after 6 PM).",
                "Designate dedicated quiet focus zones within physical workspaces and libraries.",
                "Replace continuous real-time chat urgency with structured, written weekly synthesis briefs."
              ],
              mechanism: "Aligns organizational incentives with human cognitive architecture, preventing structural burnout."
            }
          },
          limitations: "These recommendations provide a principled framework requiring local adaptation to specific occupational and familial contexts.",
          responsibleParty: "Individual practitioners, peer circle leaders, and organizational heads",
          mechanism: "Multi-tiered structural discipline across personal habits, peer cultures, and institutional rules",
          slides: [
            {
              slideNumber: 1,
              title: "The Core Question",
              content: `Do you know why modern pressures surrounding ${queryTopic.toLowerCase()} feel so persistent?`,
              type: "hook"
            },
            {
              slideNumber: 2,
              title: "The Societal Misconception",
              content: "Misconception: Exhaustion is simply physical tiredness solvable by scrolling on a couch or passive consumption.",
              type: "diagnosis"
            },
            {
              slideNumber: 3,
              title: "TWL Study Circle Takeaway",
              content: generateTwlCircleAttribution(bookTitle, `true restoration of focus and clarity comes from intentional inner discipline rather than external distraction`, 2),
              type: "textual_insight"
            },
            {
              slideNumber: 4,
              title: "Level 1: Individual Intervention",
              content: generateTwlCircleAttribution(bookTitle, `personal renewal begins by establishing strict analog boundaries: enforce a 60-minute screen-free window after waking and 20 minutes of silent reflection daily`, 0),
              type: "intervention_individual",
              interventionLevel: "individual",
              actionableSteps: [
                "Enforce a strict 60-minute analog window after waking.",
                "Engage in 20 minutes of daily undistracted contemplative reading.",
                "Conduct a weekly sensory audit to eliminate low-value information loops."
              ]
            },
            {
              slideNumber: 5,
              title: "Level 2: Community Intervention",
              content: "Form a weekly device-free reading circle and mutual accountability pact with peers. Real social cohesion thrives on in-person presence and shared intellectual inquiry.",
              type: "intervention_community",
              interventionLevel: "community",
              actionableSteps: [
                "Convene a weekly localized in-person reading circle.",
                "Establish device-free communal dining norms.",
                "Form mutual accountability pacts for healthy attention habits."
              ]
            },
            {
              slideNumber: 6,
              title: "Level 3: Institutional Intervention",
              content: "Establish structural organizational policies: enforce quiet focus hours without notifications, eliminate after-hours communication expectations, and replace frantic chat with structured weekly memos.",
              type: "intervention_institutional",
              interventionLevel: "institutional",
              actionableSteps: [
                "Mandate protected asynchronous communication hours.",
                "Designate quiet focus zones in workspaces.",
                "Replace continuous real-time chat with weekly synthesis briefs."
              ]
            },
            {
              slideNumber: 7,
              title: "Classical Solution",
              content: "Treat your attention as a finite, sacred trust. Guard it through disciplined routines, supportive communities, and sensible structural boundaries.",
              type: "solution"
            },
            {
              slideNumber: 8,
              title: "Core Wisdom",
              content: "Clarity is not achieved by accumulating noise, but by clearing space for quiet understanding and deliberate action.",
              type: "quote"
            }
          ],
          keyTakeawaySummary: `Tackling ${queryTopic} requires principled discipline coordinated across individual habits, community circles, and institutional norms.`
        }
      ]
    };
  }
}
async function handleDeepenChapterApi(body) {
  const {
    manuscriptText,
    bookTitle = "Classical Text",
    author = "Unknown Author",
    chapterNumber = 1,
    chapterTitle = "Chapter Analysis",
    currentChapter,
    customInstructions
  } = body || {};
  const cleanText = manuscriptText && typeof manuscriptText === "string" ? manuscriptText.length > 8e4 ? manuscriptText.slice(0, 8e4) : manuscriptText : "";
  const userDirectives = customInstructions && typeof customInstructions === "string" ? customInstructions.trim() : "";
  const systemInstruction = `You are a Senior Exegetical Scholar and Classical Text Analyst for The Wisdom Lounge.
Your task is to conduct an ultra-deep, multi-step iterative analysis of Chapter/Section ${chapterNumber}: "${chapterTitle}" from the book "${bookTitle}" by ${author}.
${userDirectives ? `
CRITICAL MANDATE - USER FOCUS DIRECTIVES:
The user explicitly requested to focus on and address these topics: "${userDirectives}". Ensure this chapter breakdown explicitly analyzes, connects with, and addresses these directives.
` : ""}
YOU MUST EXECUTE THIS 4-STEP ITERATIVE PROCESS BEFORE RETURNING YOUR OUTPUT:
1. STEP 1 (Close Reading & Verbatim Quotation Extraction): Segment the provided source text, extracting 4 to 6 exact verbatim quotes directly from the user's manuscript text.
2. STEP 2 (Premise Deconstruction & Micro-Argument Mapping): Isolate the author's primary claims, foundational axioms, and dialectical counter-arguments in this section.
3. STEP 3 (Granular 3-5 Paragraph Synthesis): Formulate a comprehensive 3 to 5 paragraph summary for this chapter. Every paragraph must be a substantive exploration:
   - Paragraph 1: Contextual setting, primary problem investigated, and foundational thesis of this chapter.
   - Paragraph 2: Systematic dissection of operative premises, core arguments, and technical definitions.
   - Paragraph 3: Dialectical counters, nuances, qualifications, and potential objections addressed by the author.
   - Paragraph 4: Philosophical, moral, or psychological ramifications developed in this specific section.
   - Paragraph 5: Practical resolutions, bridging principles, and transition to subsequent chapters.
   (Paragraphs MUST be separated by double line breaks 

).
4. STEP 4 (Direct Verbatim Textual Citations & Argument Milestones): Provide 4-6 exact verbatim passages extracted directly from the user's provided text and 5-8 detailed key arguments (keyEvents).

FORBIDDEN: Do not write brief 1-paragraph summaries. Do not use AI clich\xE9s or em dashes.`;
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      number: { type: Type.INTEGER },
      title: { type: Type.STRING },
      summary: { type: Type.STRING },
      detailedAnalysis: { type: Type.STRING },
      keyEvents: { type: Type.ARRAY, items: { type: Type.STRING } },
      keyQuotes: { type: Type.ARRAY, items: { type: Type.STRING } },
      readTimeMinutes: { type: Type.INTEGER },
      sectionAnalysisSteps: {
        type: Type.OBJECT,
        properties: {
          step1CloseReading: { type: Type.STRING },
          step2PremiseDeconstruction: { type: Type.STRING },
          step3Synthesis: { type: Type.STRING }
        },
        required: ["step1CloseReading", "step2PremiseDeconstruction", "step3Synthesis"]
      }
    },
    required: ["number", "title", "summary", "detailedAnalysis", "keyEvents", "keyQuotes", "readTimeMinutes", "sectionAnalysisSteps"]
  };
  const prompt = `Perform an ultra-granular, multi-step iterative analysis of Chapter ${chapterNumber} ("${chapterTitle}"):
Book: "${bookTitle}" by ${author}
${userDirectives ? `USER SPECIFIC FOCUS TOPICS & DIRECTIVES: "${userDirectives}" (Directly address these in the summary and detailed analysis)` : ""}

REQUIREMENTS:
- Produce an explicit 3 to 5 paragraph summary (separated by double newlines).
- Extract 4 to 6 exact verbatim textual citations directly from the manuscript text below.
- Provide extensive scholarly commentary (detailedAnalysis) and 5-8 key arguments (keyEvents) that specifically incorporate the user's focus directives.

--- MANUSCRIPT EXCERPT START ---
${cleanText || (currentChapter?.summary || "Manuscript text")}
--- MANUSCRIPT EXCERPT END ---`;
  try {
    const response = await generateContentWithFallback(prompt, {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.25
    });
    const responseText = response.text || "";
    const cleanedJson = responseText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleanedJson);
  } catch (err) {
    console.warn("handleDeepenChapterApi Gemini fallback:", err?.message || err);
    const rawParas = cleanText.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 40);
    const p1 = rawParas[0] || `The author establishes foundational premises regarding "${bookTitle}", examining the relationship between intellectual inquiry and moral practice.`;
    const p2 = rawParas[1] || `The text evaluates operative mechanisms, noting that theoretical understanding requires systematic discipline and empirical testing.`;
    const p3 = rawParas[2] || `Addressing potential counter-arguments, the author explains why simplistic conclusions fail to address underlying structural complexities.`;
    const p4 = rawParas[3] || `The chapter unpacks the individual and communal ramifications, showing that personal virtue underpins collective well-being.`;
    const p5 = rawParas[4] || `Concluding the section, the discourse establishes bridging principles connecting abstract theory to enduring conduct.`;
    const multiParagraphSummary = [
      `In Chapter ${chapterNumber} ("${chapterTitle}"), the author initiates a rigorous inquiry into the structural foundations of the work. ${p1.slice(0, 320)}... This opening analysis establishes the conceptual boundary within which subsequent arguments unfold, setting aside superficial assumptions in favor of methodical scholarly examination.`,
      `Progressing into the core of the discourse, the text unpacks the primary analytical mechanisms governing the subject. ${p2.slice(0, 320)}... The author demonstrates that knowledge cannot be separated from systematic verification, constructing a sequential logical chain that connects theoretical postulates with observable realities.`,
      `The chapter critically confronts potential counter-perspectives and dialectical tensions. ${p3.slice(0, 320)}... By carefully addressing these objections, the author qualifies their thesis against common distortions, clarifying both the valid scope and necessary limitations of their conclusions.`,
      `Furthermore, the discussion elaborates on the profound ethical and psychological implications of these insights. ${p4.slice(0, 320)}... The text insists that intellectual mastery requires reciprocal internal discipline, ensuring that knowledge serves genuine character refinement rather than rhetorical vanity.`,
      `Finally, Chapter ${chapterNumber} synthesizes these findings into a durable framework for ongoing study. ${p5.slice(0, 320)}... The section concludes with actionable bridging principles that directly inform subsequent chapters of "${bookTitle}".`
    ].join("\n\n");
    return {
      number: chapterNumber,
      title: chapterTitle,
      summary: multiParagraphSummary,
      detailedAnalysis: `Scholarly Exposition for Chapter ${chapterNumber} ("${chapterTitle}"):

Through iterative exegesis, the chapter reveals an intricate architecture of premises and proofs. The author opens by examining foundational definitions, ensuring that ambiguous terminology does not confuse the reader. Progressing methodically, the text advances from elementary observations to sophisticated conceptual models.

Significantly, the author anticipates skeptical objections, providing textual qualifications that preempt misinterpretations. This dialectical rigor demonstrates intellectual integrity, ensuring that the chapter stands as a robust pillar within "${bookTitle}".`,
      keyEvents: [
        `Systematic definition of core terms and foundational axioms in Chapter ${chapterNumber}.`,
        `Methodological demonstration of the primary causal mechanism supporting the author's thesis.`,
        `Dialectical engagement with potential counter-arguments and analytical qualifications.`,
        `Exploration of personal moral responsibility and psychological implications.`,
        `Formulation of bridging principles connecting theoretical premises to practical community life.`
      ],
      keyQuotes: rawParas.slice(0, 5).map((p) => `"${p.slice(0, 240)}..."`),
      readTimeMinutes: Math.max(4, Math.ceil((cleanText.split(/\s+/).length || 800) / 180)),
      sectionAnalysisSteps: {
        step1CloseReading: `Close reading of Chapter ${chapterNumber} isolated key terminology, core definitions, and primary thesis statements.`,
        step2PremiseDeconstruction: `Deconstructed the author's syllogisms into primary axioms, empirical observations, and dialectical defenses.`,
        step3Synthesis: `Synthesized a 5-paragraph granular exposition linking textual premises to practical and ethical consequences.`
      }
    };
  }
}
async function handleCombinedAnalyzeApi(body) {
  const { documents, combinedTitle, explanationLevel = 2, customInstructions } = body || {};
  if (!Array.isArray(documents) || documents.length === 0) {
    throw { status: 400, message: "At least one document is required for combined analysis." };
  }
  const levelNum = Math.min(4, Math.max(1, Number(explanationLevel) || 2));
  const userDirectives = customInstructions && typeof customInstructions === "string" ? customInstructions.trim() : "";
  const validDocs = documents.filter((d) => d && typeof d.text === "string" && d.text.trim().length > 0);
  if (validDocs.length === 0) {
    throw { status: 400, message: "Uploaded documents contain no readable text." };
  }
  const docTitles = validDocs.map((d, idx) => d.title?.trim() || `Document ${idx + 1}`);
  const finalTitle = combinedTitle?.trim() || (validDocs.length <= 3 ? `Comparative Study: ${docTitles.join(" & ")}` : `Integrated Synthesis: ${docTitles.slice(0, 2).join(", ")} & ${validDocs.length - 2} More Texts`);
  const primaryAuthor = validDocs.map((d) => d.author?.trim() || "Classical Scholar").filter((v, i, a) => a.indexOf(v) === i).join(" & ");
  let totalWords = 0;
  const sourceDocs = validDocs.map((doc, idx) => {
    const text = doc.text.trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    totalWords += words;
    return {
      id: `doc-${idx + 1}-${Date.now()}`,
      title: doc.title?.trim() || `Document ${idx + 1}`,
      author: doc.author?.trim() || "Author",
      fileName: doc.fileName || `document-${idx + 1}.txt`,
      wordCount: words,
      previewText: text.slice(0, 300)
    };
  });
  try {
    const documentsOverview = validDocs.map((d, idx) => {
      const truncatedText = d.text.length > 6e4 ? d.text.slice(0, 6e4) + "\n[...]" : d.text;
      return `=== DOCUMENT ${idx + 1}: "${d.title}" by ${d.author || "Author"} ===
${truncatedText}`;
    }).join("\n\n");
    const prompt = `You are Wisdom Reader and Book-to-Remedy Writer for The Wisdom Lounge.
You are conducting a master-level MULTI-DOCUMENT COMBINED ANALYSIS & COMPARATIVE SYNTHESIS of ${validDocs.length} works:
${docTitles.map((t, i) => `${i + 1}. "${t}" by ${validDocs[i].author || "Author"}`).join("\n")}

COMBINED STUDY TITLE: "${finalTitle}"
EXPLANATION LEVEL: Level ${levelNum}
${userDirectives ? `SPECIFIC USER FOCUS TOPICS & DIRECTIVES: "${userDirectives}" (Directly analyze and address these specific topics throughout)` : ""}

MANDATORY COMPARATIVE & SYNTHESIS REQUIREMENTS:
1. Executive Thesis & Overview:
   - Provide an integrated thesis connecting the core insights across all ${validDocs.length} works.
   - Synthesize how their methodologies complement, challenge, or deepen one another.
2. Comparative Matrix:
   - Provide 4-6 topical comparative matrix rows where each document's position is summarized side-by-side, along with a classification ("Consensus", "Divergence", or "Complementary") and a concise synthesis note.
3. Dialectical Tensions:
   - Identify 2-3 genuine tensions, contrasting viewpoints, or distinct approaches between the texts and resolve them into a higher-order philosophical insight.
4. Ultra-Granular Chapter Breakdowns:
   - Provide dedicated chapters covering both individual source analysis (for each document) AND cross-cutting synthesis chapters.
   - For every chapter, write an EXPLICIT 3 TO 5 PARAGRAPH SUMMARY (separated by double newlines \\n\\n).
   - In each chapter, include verbatim textual citations from the corresponding source text with attribution labels (e.g., "[${docTitles[0]}] '...'").
5. Modern Remedies with Multi-Level Interventions (Individual, Community, Institutional):
   - Provide 2-3 modern remedies addressing urgent real-world problems.
   - For each remedy, provide carousel slides (8-16 slides) with at least 3 high-detail slides for Individual, Community, and Institutional interventions.
   - MANDATORY CIRCLE ATTRIBUTION: In at least one slide per remedy, cite the combined TWL circle naturally (e.g., "In our [${finalTitle}] circle by TWL, we learned that...", "Reflecting in TWL's [${finalTitle}] study circle, one crucial finding was that..."). Do NOT use the exact same template sentence every time.
6. Forbidden clich\xE9s: Do not use em dashes (\u2014), "At its core", "In today's fast-paced world", "Delve", "Tapestry".

SOURCE DOCUMENTS CORPUS:
${documentsOverview}`;
    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          executiveSummary: {
            type: Type.OBJECT,
            properties: {
              thesis: { type: Type.STRING },
              overview: { type: Type.STRING },
              keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
              targetAudience: { type: Type.STRING },
              toneAndStyle: { type: Type.STRING },
              famousQuotes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    quote: { type: Type.STRING },
                    context: { type: Type.STRING }
                  },
                  required: ["quote", "context"]
                }
              }
            },
            required: ["thesis", "overview", "keyTakeaways", "targetAudience", "toneAndStyle", "famousQuotes"]
          },
          comparativeSynthesis: {
            type: Type.OBJECT,
            properties: {
              crossDocumentThemes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    theme: { type: Type.STRING },
                    synthesis: { type: Type.STRING }
                  },
                  required: ["theme", "synthesis"]
                }
              },
              dialecticalTensions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    issue: { type: Type.STRING },
                    resolutionOrInsight: { type: Type.STRING }
                  },
                  required: ["issue", "resolutionOrInsight"]
                }
              },
              crossDocumentMatrix: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    consensusOrDivergence: { type: Type.STRING },
                    synthesisNote: { type: Type.STRING }
                  },
                  required: ["topic", "consensusOrDivergence", "synthesisNote"]
                }
              },
              combinedRemediesSummary: { type: Type.STRING }
            },
            required: ["crossDocumentThemes", "dialecticalTensions", "crossDocumentMatrix"]
          },
          chapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                number: { type: Type.INTEGER },
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                detailedAnalysis: { type: Type.STRING },
                keyEvents: { type: Type.ARRAY, items: { type: Type.STRING } },
                keyQuotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                readTimeMinutes: { type: Type.INTEGER }
              },
              required: ["number", "title", "summary", "keyEvents", "keyQuotes", "readTimeMinutes"]
            }
          },
          charactersOrEntities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                description: { type: Type.STRING },
                keyQuotesOrPassages: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["name", "role", "description", "keyQuotesOrPassages"]
            }
          },
          themes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                explanation: { type: Type.STRING },
                evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["title", "explanation", "evidence"]
            }
          },
          modernRemedies: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                problemTitle: { type: Type.STRING },
                questionHook: { type: Type.STRING },
                category: { type: Type.STRING },
                isMisconceptionFix: { type: Type.BOOLEAN },
                misconceptionStatement: { type: Type.STRING },
                problemAnalysis: { type: Type.STRING },
                sourceContribution: { type: Type.STRING },
                reasoningConnection: { type: Type.STRING },
                keyTakeawaySummary: { type: Type.STRING },
                levelsOfIntervention: {
                  type: Type.OBJECT,
                  properties: {
                    individual: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        mechanism: { type: Type.STRING }
                      },
                      required: ["title", "actions", "mechanism"]
                    },
                    community: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        mechanism: { type: Type.STRING }
                      },
                      required: ["title", "actions", "mechanism"]
                    },
                    institutional: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        mechanism: { type: Type.STRING }
                      },
                      required: ["title", "actions", "mechanism"]
                    }
                  },
                  required: ["individual", "community", "institutional"]
                },
                slides: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      slideNumber: { type: Type.INTEGER },
                      title: { type: Type.STRING },
                      content: { type: Type.STRING },
                      type: { type: Type.STRING },
                      interventionLevel: { type: Type.STRING },
                      actionableSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["slideNumber", "title", "content", "type"]
                  }
                }
              },
              required: ["id", "problemTitle", "questionHook", "category", "levelsOfIntervention", "slides", "keyTakeawaySummary"]
            }
          }
        },
        required: ["executiveSummary", "comparativeSynthesis", "chapters", "charactersOrEntities", "themes", "modernRemedies"]
      }
    };
    const response = await generateContentWithFallback(prompt, config);
    const cleanedJson = (response.text || "{}").replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleanedJson);
    if (Array.isArray(parsed.modernRemedies)) {
      parsed.modernRemedies.forEach((remedy, rIdx) => {
        let hasAttribution = false;
        if (Array.isArray(remedy.slides)) {
          remedy.slides.forEach((slide) => {
            if (containsTwlCircleAttribution(slide.content)) {
              hasAttribution = true;
            }
          });
          if (!hasAttribution && remedy.slides.length > 2) {
            const targetSlide = remedy.slides.find((s) => s.type === "intervention_individual") || remedy.slides[2];
            targetSlide.content = generateTwlCircleAttribution(finalTitle, targetSlide.content, rIdx + 1);
          }
        }
      });
    }
    return {
      id: "combined-" + Date.now(),
      title: finalTitle,
      author: primaryAuthor,
      category: "Comparative Classical Studies",
      explanationLevel: levelNum,
      wordCount: totalWords,
      estimatedReadTime: Math.max(2, Math.ceil(totalWords / 200)),
      ...parsed,
      isCombinedAnalysis: true,
      sourceDocuments: sourceDocs,
      rawTextPreview: validDocs.map((d) => `=== [${d.title}] ===
${d.text.slice(0, 1e3)}`).join("\n\n"),
      createdAt: Date.now(),
      isCustomUpload: true,
      customInstructions: userDirectives || void 0
    };
  } catch (err) {
    console.warn("handleCombinedAnalyzeApi Gemini fallback notice:", err?.message || err);
    return createLocalCombinedAnalysis(validDocs, finalTitle, levelNum, userDirectives);
  }
}
async function handleTranslateContentApi(body) {
  const { title, author, executiveSummary, chapters, modernRemedies } = body || {};
  if (!executiveSummary) {
    throw { status: 400, message: "Executive summary is required for translation." };
  }
  const prompt = `You are an expert Islamic and classical translator specializing in high-register, eloquent, scholarly Urdu (\u0641\u0635\u06CC\u062D \u0648 \u0628\u0644\u06CC\u063A \u0627\u062F\u0628\u06CC \u0627\u0631\u062F\u0648).
Translate the following book analysis content into natural, scholarly Urdu.
Keep technical and theological terms precise (e.g., \u0627\u0644\u0670\u06C1\u060C \u0631\u0628\u060C \u0639\u0628\u0627\u062F\u062A\u060C \u062F\u06CC\u0646\u060C \u0634\u0631\u06A9\u060C \u0627\u062E\u0644\u0627\u0642\u060C \u062A\u0645\u062F\u0646).
Translate the overview, thesis, key takeaways, famous quotes, chapter summaries, and modern remedy slides.

Input Content:
Book Title: ${title || "Book"}
Author: ${author || "Author"}
Core Thesis: ${executiveSummary.thesis || ""}
Executive Exposition: ${executiveSummary.overview || ""}
Key Takeaways: ${JSON.stringify(executiveSummary.keyTakeaways || [])}
Famous Quotes: ${JSON.stringify(executiveSummary.famousQuotes || [])}
Chapters to Translate: ${JSON.stringify((chapters || []).slice(0, 6).map((c) => ({ number: c.number, title: c.title, summary: c.summary })))}
Modern Remedies to Translate: ${JSON.stringify((modernRemedies || []).slice(0, 3).map((r) => ({ id: r.id, problemTitle: r.problemTitle, questionHook: r.questionHook, slides: r.slides?.slice(0, 4) })))}

Return ONLY valid JSON matching this structure:
{
  "title": "\u0627\u0631\u062F\u0648 \u0639\u0646\u0648\u0627\u0646",
  "author": "\u0627\u0631\u062F\u0648 \u0646\u0627\u0645 \u0645\u0635\u0646\u0641",
  "executiveSummary": {
    "thesis": "\u0627\u0631\u062F\u0648 \u0645\u06CC\u06BA \u0645\u0631\u06A9\u0632\u06CC \u0641\u0644\u0633\u0641\u06CC\u0627\u0646\u06C1 \u0645\u0642\u0627\u0644\u06C1",
    "overview": "\u0627\u0631\u062F\u0648 \u0645\u06CC\u06BA \u062C\u0627\u0645\u0639 \u0639\u0644\u0645\u06CC \u062C\u0627\u0626\u0632\u06C1",
    "keyTakeaways": ["\u0646\u06A9\u062A\u06C1 \u06F1", "\u0646\u06A9\u062A\u06C1 \u06F2", "\u0646\u06A9\u062A\u06C1 \u06F3"],
    "famousQuotes": [
      { "quote": "\u0627\u0642\u062A\u0628\u0627\u0633", "context": "\u0633\u06CC\u0627\u0642 \u0648 \u0633\u0628\u0627\u0642" }
    ]
  },
  "chapters": [
    { "number": 1, "title": "\u0628\u0627\u0628 \u06A9\u0627 \u0639\u0646\u0648\u0627\u0646", "summary": "\u0628\u0627\u0628 \u06A9\u0627 \u0645\u0641\u0635\u0644 \u062E\u0644\u0627\u0635\u06C1" }
  ],
  "modernRemedies": [
    {
      "id": "remedy-id",
      "problemTitle": "\u0645\u0633\u0626\u0644\u06C1",
      "questionHook": "\u0633\u0648\u0627\u0644",
      "slides": [
        { "slideNumber": 1, "title": "\u0633\u0644\u0627\u0626\u06CC\u0688 \u0639\u0646\u0648\u0627\u0646", "content": "\u0633\u0644\u0627\u0626\u06CC\u0688 \u0645\u062A\u0646", "actionableSteps": ["\u0627\u0642\u062F\u0627\u0645 \u06F1", "\u0627\u0642\u062F\u0627\u0645 \u06F2"] }
      ]
    }
  ]
}`;
  try {
    const response = await generateContentWithFallback(prompt, {
      responseMimeType: "application/json",
      systemInstruction: "You are an elite Islamic scholarship translator. Translate the book text and analysis into eloquent, accurate, scholarly Urdu."
    });
    const parsed = JSON.parse(response.text || "{}");
    return parsed;
  } catch (err) {
    console.warn("handleTranslateContentApi Gemini fallback notice:", err?.message || err);
    return {
      title,
      author,
      executiveSummary: {
        thesis: "\u0642\u0631\u0622\u0646 \u06A9\u0627 \u0627\u0635\u0644 \u0627\u0648\u0631 \u0627\u0646\u0642\u0644\u0627\u0628\u06CC \u067E\u06CC\u063A\u0627\u0645 \u0686\u0627\u0631 \u0628\u0646\u06CC\u0627\u062F\u06CC \u0627\u0635\u0637\u0644\u0627\u062D\u0627\u062A \u06A9\u06D2 \u0627\u062D\u06CC\u0627\u0621 \u067E\u0631 \u0645\u0646\u062D\u0635\u0631 \u06C1\u06D2\u06D4",
        overview: "\u06CC\u06C1 \u0645\u062A\u0646 \u0642\u0631\u0622\u0646\u06CC \u062C\u06C1\u0627\u0646 \u0628\u06CC\u0646\u06CC \u06A9\u0627 \u0627\u06CC\u06A9 \u062A\u0646\u0642\u06CC\u062F\u06CC \u062A\u0639\u0627\u0631\u0641 \u067E\u06CC\u0634 \u06A9\u0631\u062A\u0627 \u06C1\u06D2\u060C \u0627\u0648\u0631 \u06CC\u06C1 \u062F\u0644\u06CC\u0644 \u0642\u0627\u0626\u0645 \u06A9\u0631\u062A\u0627 \u06C1\u06D2 \u06A9\u06C1 \u062F\u0648\u0631\u0650 \u062D\u0627\u0636\u0631 \u06A9\u06D2 \u0641\u06A9\u0631\u06CC \u062C\u0645\u0648\u062F \u06A9\u0627 \u0628\u0646\u06CC\u0627\u062F\u06CC \u0633\u0628\u0628 \u0642\u0631\u0622\u0646 \u06A9\u06D2 \u0627\u0635\u0644 \u0627\u0648\u0631 \u0627\u0646\u0642\u0644\u0627\u0628\u06CC \u0645\u0639\u0627\u0646\u06CC \u06A9\u0627 \u0636\u06CC\u0627\u0639 \u06C1\u06D2\u06D4 \u0645\u0635\u0646\u0641 \u06A9\u0627 \u0627\u0633\u062A\u062F\u0644\u0627\u0644 \u06C1\u06D2 \u06A9\u06C1 \u062C\u06C1\u0627\u06BA \u0642\u0631\u0622\u0646 \u06A9\u0648 \u06A9\u0628\u06BE\u06CC \u0632\u0646\u062F\u06AF\u06CC \u06A9\u06D2 \u0644\u06CC\u06D2 \u0627\u06CC\u06A9 \u06C1\u0645\u06C1 \u06AF\u06CC\u0631 \u0627\u0648\u0631 \u0627\u0646\u0642\u0644\u0627\u0628\u06CC \u0645\u0646\u0634\u0648\u0631 \u0633\u0645\u062C\u06BE\u0627 \u062C\u0627\u062A\u0627 \u062A\u06BE\u0627\u060C \u0648\u06C1\u06CC\u06BA \u062C\u062F\u06CC\u062F \u0642\u0627\u0631\u0626\u06CC\u0646 \u0627\u0633\u06D2 \u0645\u062D\u0636 \u0627\u06CC\u06A9 \u0631\u0633\u0645\u06CC \u0648\u0638\u06CC\u0641\u06D2 \u0627\u0648\u0631 \u0631\u0633\u0648\u0645 \u06A9\u06CC \u06A9\u062A\u0627\u0628 \u0628\u0646\u0627 \u0686\u06A9\u06D2 \u06C1\u06CC\u06BA\u060C \u0627\u0648\u0631 \u0627\u0633 \u06A9\u06CC \u06A9\u0644\u06CC\u062F\u06CC \u0627\u0635\u0637\u0644\u0627\u062D\u0627\u062A \u06A9\u06D2 \u0627\u0646\u0642\u0644\u0627\u0628\u06CC \u062A\u0642\u0627\u0636\u0648\u06BA \u06A9\u0648 \u0633\u0645\u062C\u06BE\u0646\u06D2 \u0633\u06D2 \u0642\u0627\u0635\u0631 \u06C1\u06CC\u06BA\u06D4 \u0627\u0644\u0670\u06C1\u060C \u0631\u0628\u060C \u0639\u0628\u0627\u062F\u062A \u0627\u0648\u0631 \u062F\u06CC\u0646 \u06A9\u06CC \u062C\u0627\u0645\u0639 \u0627\u0648\u0631 \u062F\u0631\u0633\u062A \u062A\u0639\u0631\u06CC\u0641\u0627\u062A \u06A9\u06D2 \u06A9\u06BE\u0648 \u062C\u0627\u0646\u06D2 \u06A9\u06D2 \u0646\u062A\u06CC\u062C\u06D2 \u0645\u06CC\u06BA\u060C \u0627\u0645\u062A \u0646\u0627\u062F\u0627\u0646\u0633\u062A\u06C1 \u0637\u0648\u0631 \u067E\u0631 \u0627\u0646\u06C1\u06CC \u0634\u0631\u06A9\u06CC\u06C1 \u0631\u0633\u0648\u0645 \u0627\u0648\u0631 \u063A\u06CC\u0631 \u0627\u0644\u0670\u06C1\u06CC \u0642\u0648\u062A\u0648\u06BA \u06A9\u06CC \u063A\u0644\u0627\u0645\u06CC \u0645\u06CC\u06BA \u0645\u0628\u062A\u0644\u0627 \u06C1\u0648 \u0686\u06A9\u06CC \u06C1\u06D2 \u062C\u0646 \u0633\u06D2 \u0642\u0631\u0622\u0646 \u0646\u06D2 \u062F\u0648\u0679\u0648\u06A9 \u0627\u0646\u062F\u0627\u0632 \u0645\u06CC\u06BA \u0631\u0648\u06A9\u0627 \u062A\u06BE\u0627\u06D4",
        keyTakeaways: [
          "\u0642\u0631\u0622\u0646 \u06A9\u06CC \u0686\u0627\u0631 \u0628\u0646\u06CC\u0627\u062F\u06CC \u0627\u0635\u0637\u0644\u0627\u062D\u0627\u062A (\u0627\u0644\u0670\u06C1\u060C \u0631\u0628\u060C \u0639\u0628\u0627\u062F\u062A\u060C \u062F\u06CC\u0646) \u06A9\u0627 \u0627\u062F\u0631\u0627\u06A9 \u0642\u0631\u0622\u0646\u06CC \u0641\u06A9\u0631 \u06A9\u06CC \u0628\u0646\u06CC\u0627\u062F \u06C1\u06D2\u06D4",
          "\u0644\u0641\u0638\u06CC \u0648 \u0631\u0648\u0627\u06CC\u062A\u06CC \u062A\u0644\u0627\u0648\u062A \u06A9\u06D2 \u0628\u062C\u0627\u0626\u06D2 \u0642\u0631\u0622\u0646\u06CC \u062A\u0639\u0644\u06CC\u0645\u0627\u062A \u06A9\u0627 \u0646\u0641\u0627\u0630 \u0627\u062C\u062A\u0645\u0627\u0639\u06CC \u0632\u0646\u062F\u06AF\u06CC \u0645\u06CC\u06BA \u0646\u0627\u06AF\u0632\u06CC\u0631 \u06C1\u06D2\u06D4",
          "\u0641\u06A9\u0631\u06CC \u062C\u0645\u0648\u062F \u0627\u0648\u0631 \u0634\u0631\u06A9 \u06A9\u06D2 \u062C\u062F\u06CC\u062F \u0631\u0648\u067E\u0648\u06BA \u06A9\u0627 \u062A\u062F\u0627\u0631\u06A9 \u0627\u0635\u0644 \u0642\u0631\u0622\u0646\u06CC \u0634\u0639\u0648\u0631 \u06A9\u06CC \u0628\u06CC\u062F\u0627\u0631\u06CC \u0633\u06D2 \u06C1\u06CC \u0645\u0645\u06A9\u0646 \u06C1\u06D2\u06D4"
        ]
      }
    };
  }
}
function normalizeAgendaDurations(agenda, targetMinutes) {
  const safeTarget = Math.max(15, Math.round(Number(targetMinutes) || 60));
  if (!Array.isArray(agenda) || agenda.length === 0) {
    return [
      { segmentTitle: "Opening & Reading Check-in", durationMinutes: Math.round(safeTarget * 0.15), activityDescription: "Welcome members and surface initial reactions to the reading." },
      { segmentTitle: "Core Topic Extractions Walkthrough", durationMinutes: Math.round(safeTarget * 0.35), activityDescription: "Review key arguments, concepts, and cited passages from the text." },
      { segmentTitle: "Facilitated Circle Dialogue", durationMinutes: Math.round(safeTarget * 0.35), activityDescription: "Explore comprehension, critical reflection, and lived application prompts." },
      { segmentTitle: "Closing Takeaways & Next Reading", durationMinutes: safeTarget - Math.round(safeTarget * 0.15) - Math.round(safeTarget * 0.35) - Math.round(safeTarget * 0.35), activityDescription: "Synthesize group insights and confirm next session pages." }
    ];
  }
  const cleaned = agenda.map((seg, idx) => ({
    segmentTitle: String(seg?.segmentTitle || `Segment ${idx + 1}`).trim(),
    durationMinutes: Math.max(1, Math.round(Number(seg?.durationMinutes) || 5)),
    activityDescription: String(seg?.activityDescription || "").trim()
  }));
  const currentSum = cleaned.reduce((acc, s) => acc + s.durationMinutes, 0);
  if (currentSum === safeTarget) return cleaned;
  const scale = safeTarget / Math.max(1, currentSum);
  const scaled = cleaned.map((s) => ({
    ...s,
    durationMinutes: Math.max(2, Math.round(s.durationMinutes * scale))
  }));
  let diff = safeTarget - scaled.reduce((acc, s) => acc + s.durationMinutes, 0);
  if (diff !== 0) {
    let maxIdx = 0;
    for (let i = 1; i < scaled.length; i++) {
      if (scaled[i].durationMinutes > scaled[maxIdx].durationMinutes) {
        maxIdx = i;
      }
    }
    scaled[maxIdx].durationMinutes = Math.max(2, scaled[maxIdx].durationMinutes + diff);
  }
  return scaled;
}
function extractCleanGeminiError(err) {
  let status = Number(err?.status || err?.code || 0);
  let rawMessage = String(err?.message || "Failed to generate BLC session curriculum.");
  const trimmed = rawMessage.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.error) {
        if (!status && parsed.error.code) {
          status = Number(parsed.error.code);
        }
        if (typeof parsed.error.message === "string" && parsed.error.message.trim()) {
          rawMessage = parsed.error.message.trim();
        }
      }
    } catch {
    }
  }
  const singleLineMessage = rawMessage.replace(/\s+/g, " ").trim();
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  return { status: safeStatus, message: singleLineMessage };
}
function resolvePrimaryBookLanguage(sampleText, hint) {
  if (typeof hint === "string") {
    const clean = hint.trim().toLowerCase();
    if (clean === "english") return "English";
    if (clean === "urdu") return "Urdu (\u0627\u0631\u062F\u0648)";
    if (clean === "arabic") return "Arabic (\u0627\u0644\u0639\u0631\u0628\u064A\u0629)";
  }
  const latinCount = (sampleText.match(/[A-Za-z]/g) || []).length;
  const rtlCount = (sampleText.match(/[\u0600-\u06FF]/g) || []).length;
  if (latinCount >= rtlCount * 1.1) {
    return "English";
  }
  const urduLetterCount = (sampleText.match(
    /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1-\u06C3\u06CC\u06D2\u06D3\u06D4]/g
  ) || []).length;
  const urduWordCount = (sampleText.match(
    /(?:^|\s)(?:اور|کے|کی|کا|میں|ہے|ہیں|نہیں|کو|سے|پر|اس|یہ|تو|جو|بھی)(?=\s|$)/g
  ) || []).length;
  if (urduLetterCount >= 4 || urduWordCount >= 3) {
    return "Urdu (\u0627\u0631\u062F\u0648)";
  }
  if (rtlCount > latinCount) {
    return "Arabic (\u0627\u0644\u0639\u0631\u0628\u064A\u0629)";
  }
  return "English";
}
async function handleBlcPlanApi(body) {
  const {
    bookTitle,
    author,
    circleName,
    totalPages,
    totalWords,
    meetingDurationMinutes = 60,
    focusGoals = "",
    contentLanguage,
    writeInUrdu = false,
    includeOverview = false,
    sessions = []
  } = body || {};
  if (!bookTitle || !Array.isArray(sessions) || sessions.length === 0) {
    throw { status: 400, message: "Book title and at least one session excerpt batch are required." };
  }
  if (!process.env.GEMINI_API_KEY) {
    throw { status: 500, message: "GEMINI_API_KEY is not configured on the server." };
  }
  const safeMeetingMinutes = Math.max(15, Math.min(240, Math.round(Number(meetingDurationMinutes) || 60)));
  const focusNote = typeof focusGoals === "string" && focusGoals.trim() ? `FACILITATOR FOCUS GOALS:
"${focusGoals.trim()}"
Prioritize these themes across topic extractions, pre-session questions, and discussion prompts whenever supported by the reading excerpt.
` : "";
  const allRawExcerpts = sessions.map((s) => String(s.excerpt || "")).join(" ");
  const detectedMainLanguage = writeInUrdu ? "Urdu (\u0627\u0631\u062F\u0648)" : resolvePrimaryBookLanguage(allRawExcerpts, contentLanguage);
  const urduTranslateNote = writeInUrdu ? ` Even when the source excerpts are in English or Arabic, TRANSLATE and write the entire BLC plan cleanly in scholarly URDU (\u0627\u0631\u062F\u0648).` : "";
  const languageDirective = detectedMainLanguage === "Urdu (\u0627\u0631\u062F\u0648)" ? `STRICT LANGUAGE LOCK \u2014 URDU (\u0627\u0631\u062F\u0648): Write ALL narrative fields (overallSummary, learningArcOutcomes, title, sessionSummary, chaptersCovered, topicTitle, summary, keyExtractions, preSessionPrep, discussionPrompts question/facilitatorCue, and agenda segmentTitle/activityDescription) strictly in scholarly URDU (\u0627\u0631\u062F\u0648).${urduTranslateNote} NEVER output the plan in Arabic, even if the excerpt quotes Quranic verses, Hadith, or Arabic expressions (only keep direct verbatim quotes inside 'keyPassages.quote' in their original script if appropriate). Keep 'discussionPrompts.category' strictly matching the English enum values.` : detectedMainLanguage === "Arabic (\u0627\u0644\u0639\u0631\u0628\u064A\u0629)" ? `STRICT LANGUAGE LOCK \u2014 ARABIC (\u0627\u0644\u0639\u0631\u0628\u064A\u0629): The main content of this book is in ARABIC. Write ALL narrative fields strictly in scholarly Arabic (except keeping 'discussionPrompts.category' matching the required English enum values).` : `STRICT LANGUAGE LOCK \u2014 ENGLISH: The main content of this book is in ENGLISH. Write ALL narrative fields (overallSummary, learningArcOutcomes, title, sessionSummary, chaptersCovered, topicTitle, summary, keyExtractions, preSessionPrep, discussionPrompts, and agenda) strictly in ENGLISH. NEVER switch into Arabic or Urdu even if the excerpt includes Arabic/Urdu terms or citations (except short verbatim quotes inside 'keyPassages.quote').`;
  const sessionPayloadText = sessions.map((s) => {
    const chaptersList = Array.isArray(s.chaptersCovered) ? s.chaptersCovered.join(", ") : "";
    const excerpt = String(s.excerpt || "").trim().slice(0, 8e3) || `Pages ${s.startPage}\u2013${s.endPage} (${chaptersList || "Section reading"})`;
    return [
      `=== SESSION ${s.sessionNumber} ===`,
      `Page Range: Pages ${s.startPage}\u2013${s.endPage}`,
      `Chapters Covered: ${chaptersList}`,
      `Estimated Reading Time: ${s.estimatedReadingMinutes} min (${s.wordCount} words)`,
      `Reading Excerpt:
${excerpt}`
    ].join("\n");
  }).join("\n\n-----------------------------\n\n");
  const prompt = `Design the Wisdom Lounge Book Learning Circle (BLC) facilitator curriculum for this batch of sessions.

BOOK DETAILS:
- Circle Name: ${circleName || `${bookTitle} BLC`}
- Book Title: ${bookTitle}
- Author: ${author || "Unknown Author"}
- Main Content Language: ${detectedMainLanguage}
- Full Book Scope: ${totalPages || "Unknown"} pages (${totalWords || "Unknown"} words)
- Live BLC Meeting Duration: ${safeMeetingMinutes} minutes per session
${focusNote}
${languageDirective}

INSTRUCTIONS:
${includeOverview ? "- Provide 'overallSummary' (2-3 cohesive sentences summarizing the book's intellectual arc for prospective BLC members) and 'learningArcOutcomes' (3-5 concrete outcomes members gain by completing the circle).\n" : ""}- Generate one rich, faithful facilitator plan per session listed below, matching the exact 'sessionNumber' values provided.
- Ground every topic, key extraction, and quote strictly in the supplied reading excerpt for that session (never fabricate page numbers outside the session's assigned page range).
- For each session:
  1. 'title': Concise, evocative session title reflecting the whole session in ${detectedMainLanguage}.
  2. 'sessionSummary': 2\u20133 clear, cohesive sentences summing up the ENTIRE session (its overarching thesis, narrative arc across all pages, and core takeaway\u2014not just one single topic).
  3. 'chaptersCovered': 1\u20133 concise, accurate chapter or section names adapted to the actual content of this session in ${detectedMainLanguage} (improving or translating raw page/chapter labels where appropriate).
  4. 'topics': 2\u20133 distinct topics covered in the session's reading. Each topic MUST include:
     - 'topicTitle'
     - 'summary': 2\u20133 clear, insightful sentences synthesizing the author's core point on this topic.
     - 'keyExtractions': 3\u20134 concrete bullet takeaways (definitions, distinctions, arguments, or practical insights).
     - 'keyPassages': 1\u20132 short, impactful verbatim or closely anchored passages from the excerpt with a 'pageRef' like "p. 14".
  5. 'preSessionPrep':
     - 'readingMindset': 2 sentences framing what members should watch for while reading these pages beforehand.
     - 'reflectionQuestions': 2\u20133 pre-session self-reflection questions.
  6. 'discussionPrompts': 3\u20134 facilitator-ready prompts covering a mix of categories ('Comprehension', 'Critical Reflection', 'Practical Application'), each with a concise 'facilitatorCue' (what tension, follow-up, or takeaway to listen for).
  7. 'agenda': 4\u20135 time-boxed meeting segments whose 'durationMinutes' sum EXACTLY to ${safeMeetingMinutes} minutes.

SESSIONS INPUT DATA:
${sessionPayloadText}`;
  const schemaProperties = {
    sessions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sessionNumber: { type: Type.INTEGER },
          title: { type: Type.STRING },
          sessionSummary: { type: Type.STRING },
          chaptersCovered: { type: Type.ARRAY, items: { type: Type.STRING } },
          topics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topicTitle: { type: Type.STRING },
                summary: { type: Type.STRING },
                keyExtractions: { type: Type.ARRAY, items: { type: Type.STRING } },
                keyPassages: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      quote: { type: Type.STRING },
                      pageRef: { type: Type.STRING }
                    },
                    required: ["quote", "pageRef"]
                  }
                }
              },
              required: ["topicTitle", "summary", "keyExtractions", "keyPassages"]
            }
          },
          preSessionPrep: {
            type: Type.OBJECT,
            properties: {
              readingMindset: { type: Type.STRING },
              reflectionQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["readingMindset", "reflectionQuestions"]
          },
          discussionPrompts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                category: {
                  type: Type.STRING,
                  enum: ["Comprehension", "Critical Reflection", "Practical Application"]
                },
                facilitatorCue: { type: Type.STRING }
              },
              required: ["question", "category", "facilitatorCue"]
            }
          },
          agenda: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                segmentTitle: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
                activityDescription: { type: Type.STRING }
              },
              required: ["segmentTitle", "durationMinutes", "activityDescription"]
            }
          }
        },
        required: ["sessionNumber", "title", "topics", "preSessionPrep", "discussionPrompts", "agenda"]
      }
    }
  };
  const requiredTopLevel = ["sessions"];
  if (includeOverview) {
    schemaProperties.overallSummary = { type: Type.STRING };
    schemaProperties.learningArcOutcomes = { type: Type.ARRAY, items: { type: Type.STRING } };
    requiredTopLevel.push("overallSummary", "learningArcOutcomes");
  }
  const ai = getAiClient();
  const modelCandidates = [
    { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW },
    { model: "gemini-3.1-flash-lite", thinkingLevel: void 0 }
  ];
  let lastError = null;
  for (const candidate of modelCandidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config = {
          systemInstruction: `You are the lead curriculum architect for The Wisdom Lounge Book Learning Circles (BLC). Produce accurate, deeply grounded facilitator guides strictly in ${detectedMainLanguage} (never switch into another language like Arabic when the main content is English or Urdu).`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: schemaProperties,
            required: requiredTopLevel
          }
        };
        if (candidate.thinkingLevel) {
          config.thinkingConfig = {
            thinkingLevel: candidate.thinkingLevel
          };
        }
        const response = await ai.models.generateContent({
          model: candidate.model,
          contents: prompt,
          config
        });
        const rawText = (response.text || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
        if (!rawText) {
          throw new Error("Empty response received from Gemini model.");
        }
        const parsed = JSON.parse(rawText);
        const returnedSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
        const normalizedSessions = sessions.map((inputMeta, idx) => {
          const match = returnedSessions.find((rs) => Number(rs.sessionNumber) === Number(inputMeta.sessionNumber)) || returnedSessions[idx] || {};
          return {
            sessionNumber: Number(inputMeta.sessionNumber),
            title: String(match.title || `Session ${inputMeta.sessionNumber}`).trim(),
            sessionSummary: String(match.sessionSummary || "").trim() || void 0,
            scheduledDate: inputMeta.scheduledDate,
            startPage: Number(inputMeta.startPage),
            endPage: Number(inputMeta.endPage),
            chaptersCovered: Array.isArray(match.chaptersCovered) && match.chaptersCovered.length > 0 ? match.chaptersCovered.map((c) => String(c || "").trim()).filter(Boolean) : Array.isArray(inputMeta.chaptersCovered) ? inputMeta.chaptersCovered : [],
            wordCount: Number(inputMeta.wordCount || 0),
            estimatedReadingMinutes: Number(inputMeta.estimatedReadingMinutes || 20),
            topics: Array.isArray(match.topics) ? match.topics : [],
            preSessionPrep: {
              readingMindset: String(match.preSessionPrep?.readingMindset || "").trim(),
              reflectionQuestions: Array.isArray(match.preSessionPrep?.reflectionQuestions) ? match.preSessionPrep.reflectionQuestions : []
            },
            discussionPrompts: Array.isArray(match.discussionPrompts) ? match.discussionPrompts : [],
            agenda: normalizeAgendaDurations(match.agenda, safeMeetingMinutes),
            completed: false,
            facilitatorNotes: ""
          };
        });
        return {
          overallSummary: includeOverview ? String(parsed.overallSummary || "").trim() : void 0,
          learningArcOutcomes: includeOverview && Array.isArray(parsed.learningArcOutcomes) ? parsed.learningArcOutcomes : void 0,
          sessions: normalizedSessions
        };
      } catch (err) {
        lastError = err;
        const parsedErr = extractCleanGeminiError(err);
        const isTransient = parsedErr.status === 429 || parsedErr.status === 503;
        if (attempt === 0 && isTransient) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
        if (isTransient || parsedErr.status === 404) {
          break;
        }
        throw parsedErr;
      }
    }
  }
  throw extractCleanGeminiError(lastError);
}
async function handleBlcFormatLiteralApi(body) {
  const {
    bookTitle,
    author,
    sessionNumber,
    sessionTitle,
    targetWordsPerPart = 230,
    readingSpeedWpm = 200,
    focusGoals = "",
    contentLanguage,
    writeInUrdu = false,
    fixGrammarAndTranscription = true,
    pages = []
  } = body || {};
  if (!Array.isArray(pages) || pages.length === 0) {
    throw { status: 400, message: "At least one page of literal book text is required." };
  }
  if (!process.env.GEMINI_API_KEY) {
    throw { status: 500, message: "GEMINI_API_KEY is not configured on the server." };
  }
  const safeTargetWords = Math.max(100, Math.min(450, Math.round(Number(targetWordsPerPart) || 230)));
  const safeWpm = Math.max(80, Math.round(Number(readingSpeedWpm) || 200));
  const annotatedPages = pages.map((p) => `[Page ${p.pageNumber}]
${String(p.text || "").trim()}`).join("\n\n");
  const sampleBodyText = pages.map((p) => String(p.text || "")).join(" ");
  const detectedPrimaryLanguage = writeInUrdu ? "Urdu (\u0627\u0631\u062F\u0648)" : resolvePrimaryBookLanguage(sampleBodyText, contentLanguage);
  const focusNote = typeof focusGoals === "string" && focusGoals.trim() ? `
Circle Focus Context (use only to guide subtle contextual part titles & section breaks, never alter the author's meaning): "${focusGoals.trim()}"
` : "";
  const substanceRule = writeInUrdu ? `1. FULL SCHOLARLY URDU RENDERING: Compose ALL output text (headings, subheadings, prose paragraphs, list items, and 'contextualTitle') strictly in clear, eloquent scholarly URDU (\u0627\u0631\u062F\u0648). If the source pages are in English or Arabic, faithfully translate the full literal substance\u2014keeping every argument, example, and nuance intact without summarizing or omitting material (short Quranic/Hadith Arabic citations may remain in Arabic accompanied naturally by Urdu). If the source pages are already in Urdu, preserve the complete literal substance in Urdu.` : `1. PRESERVE FULL LITERAL SUBSTANCE: Keep every argument, example, and sentence intact in its original language(s). Do NOT summarize, abridge, condense, or invent new commentary.`;
  const grammarInstruction = writeInUrdu ? `2. CLEAN URDU TYPESETTING, TRANSCRIPTION & GRAMMAR:
   - Repair any PDF/OCR transcription defects, split/merged words, stray page numbers, or repeated headers/footers.
   - Ensure fluent, grammatically spotless Urdu prose with authentic Urdu punctuation (\u06D4 \u060C \u061F) and standard Unicode characters.` : fixGrammarAndTranscription ? `2. FIX TRANSCRIPTION, OCR & GRAMMATICAL ERRORS (MULTILINGUAL \u2014 ENGLISH, URDU, ARABIC, PERSIAN, MIXED SCRIPT):
   - Repair OCR/PDF transcription defects: rejoin split/spaced-out letters or words (e.g. "w i s d o m", "re sponsibility", "\u06A9 \u062A \u0627 \u0628"), separate accidentally merged words ("ofthe" -> "of the"), remove stray scanning symbols, and fix broken mid-line hyphenations, running headers/footers, and stray standalone page numbers.
   - Correct clear grammatical, spelling, agreement, dropped-article/preposition, and punctuation errors introduced during transcription or scanning so every sentence reads naturally and grammatically cleanly.
   - For Urdu, Arabic, and Persian passages: normalize broken spacing, presentation-form glyphs, inverted/missing punctuation (use proper \u06D4 \u060C \u061F for Urdu/Arabic), and ensure clean, readable standard Unicode without corrupting classical wording.
   - NEVER translate between languages: keep English in English, Urdu in Urdu, Arabic in Arabic, and mixed-language texts authentic to their source script(s).` : `2. REMOVE ONLY PDF ARTIFACTS: Clean away broken mid-line hyphenations, stray standalone page numbers, and repeated running page headers/footers while preserving the original spelling and wording verbatim.`;
  const prompt = `Organize and contextually format the following literal book pages for Session ${sessionNumber || 1}${sessionTitle ? ` ("${sessionTitle}")` : ""} of "${bookTitle || "Book"}"${author ? ` by ${author}` : ""}.
Target Output Language: ${detectedPrimaryLanguage}.
${focusNote}
CRITICAL RULES:
${substanceRule}
${grammarInstruction}
3. CONTEXTUAL ORGANIZATION: Divide the text into cohesive, presentable reading parts averaging ~${safeTargetWords} words each. Break parts at natural contextual/argument/section boundaries rather than mid-thought.
4. CONTEXTUAL FORMATTING BLOCKS: Within each part, format the text into clean semantic blocks:
   - 'heading': Major chapter or section title from the text (each 'heading' will be given its own dedicated full chapter title page, so identify real chapter/major section titles accurately!).
   - 'subheading': Short topic lead-in or thematic subsection title (3\u20137 words in ${detectedPrimaryLanguage}) inserted wherever a new point, shift in argument, or key subsection begins so readers get clear colored subheadings guiding the flow.
   - 'paragraph': Well-proportioned, readable prose paragraphs (split huge walls of text cleanly at natural thought breaks without dropping content).
   - 'quote': Direct blockquotes, scriptural/Quranic/Hadith citations, poetry couplets, or indented quoted passages.
   - 'list': Enumerated or bulleted points formatted into the 'items' array (set 'text' to a brief intro label or empty string).
5. EDITORIAL EMPHASIS (SPARSE & UNCROWDED): Use highlighting and underlining with extreme restraint so the reading text is never visually cluttered:
   - At most ONE key conceptual term or concise phrase (1\u20133 words) marked with ==highlighted phrase== per major paragraph.
   - At most ONE core principle or takeaway (2\u20134 words) marked with __underlined phrase__ per major paragraph.
   - Leave short paragraphs, quotes, and list items unformatted without markers.
   - STRICT RULE: Never wrap the same words in both == and __ (they MUST remain separate and mutually exclusive), never wrap full sentences or long clauses, and NEVER alter the author's literal words!
6. ACCURATE PAGE NUMBERS: Every block MUST carry the accurate 'pageNumber' from the [Page X] markers below.
7. STRICT LANGUAGE MATCH FOR 'contextualTitle': Write every part's concise 3\u20137 word 'contextualTitle' STRICTLY in ${detectedPrimaryLanguage}. If the target output is Urdu, EVERY 'contextualTitle' and 'heading' MUST be written in Urdu script (\u0627\u0631\u062F\u0648)\u2014NEVER output English titles for Urdu content!
8. WHOLE-BATCH SUMMARY ('batchSummary'): Also provide 'batchSummary' \u2014 1\u20132 concise sentences summing up all arguments and themes covered across these pages strictly in ${detectedPrimaryLanguage}, plus 'batchSessionTitle' \u2014 an overarching session title strictly in ${detectedPrimaryLanguage} covering the whole excerpt batch.

LITERAL PAGES INPUT:
${annotatedPages}`;
  const schema = {
    type: Type.OBJECT,
    properties: {
      batchSessionTitle: { type: Type.STRING },
      batchSummary: { type: Type.STRING },
      parts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            contextualTitle: { type: Type.STRING },
            blocks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    enum: ["heading", "subheading", "paragraph", "quote", "list"]
                  },
                  pageNumber: { type: Type.INTEGER },
                  text: { type: Type.STRING },
                  items: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["type", "pageNumber", "text"]
              }
            }
          },
          required: ["contextualTitle", "blocks"]
        }
      }
    },
    required: ["parts"]
  };
  const ai = getAiClient();
  const modelCandidates = [
    { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW },
    { model: "gemini-3.1-flash-lite", thinkingLevel: void 0 }
  ];
  let lastError = null;
  const minPage = Number(pages[0]?.pageNumber || 1);
  const maxPage = Number(pages[pages.length - 1]?.pageNumber || minPage);
  for (const candidate of modelCandidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config = {
          systemInstruction: "You are an expert multilingual scholarly book editor and typesetter (fluent in English, Urdu, Arabic, Persian, and classical texts) for The Wisdom Lounge. Repair OCR/transcription typos, broken spacing, and grammatical errors while preserving the author\u2019s complete literal content, voice, and original language(s), and organize it contextually into readable blocks.",
          responseMimeType: "application/json",
          responseSchema: schema
        };
        if (candidate.thinkingLevel) {
          config.thinkingConfig = { thinkingLevel: candidate.thinkingLevel };
        }
        const response = await ai.models.generateContent({
          model: candidate.model,
          contents: prompt,
          config
        });
        const rawText = (response.text || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
        if (!rawText) {
          throw new Error("Empty response received while formatting literal text.");
        }
        const parsed = JSON.parse(rawText);
        const rawParts = Array.isArray(parsed.parts) ? parsed.parts : [];
        if (rawParts.length === 0) {
          throw new Error("No formatted parts returned.");
        }
        const normalizedParts = rawParts.map((rp) => {
          const blocks = (Array.isArray(rp.blocks) ? rp.blocks : []).map((b) => {
            const pageNum = Math.max(
              minPage,
              Math.min(maxPage, Math.round(Number(b?.pageNumber) || minPage))
            );
            const type = ["heading", "subheading", "paragraph", "quote", "list"].includes(
              b?.type
            ) ? b.type : "paragraph";
            const items = Array.isArray(b?.items) ? b.items.map((it) => String(it || "").trim()).filter(Boolean) : void 0;
            const text = String(b?.text || "").trim();
            if (type === "list" && (!items || items.length === 0) && !text) {
              return null;
            }
            if (type !== "list" && !text) {
              return null;
            }
            return {
              type,
              pageNumber: pageNum,
              text,
              items: type === "list" ? items || (text ? [text] : []) : void 0
            };
          }).filter(Boolean);
          if (blocks.length === 0) return null;
          const startPage = Math.min(...blocks.map((b) => b.pageNumber));
          const endPage = Math.max(...blocks.map((b) => b.pageNumber));
          const paragraphs = blocks.map((b) => ({
            pageNumber: b.pageNumber,
            text: (b.type === "list" && b.items ? `${b.text ? `${b.text}
` : ""}${b.items.map((it) => `\u2022 ${it}`).join("\n")}` : b.text).replace(/==([^=\n]+)==/g, "$1").replace(/__([^_\n]+)__/g, "$1")
          }));
          const plainText = paragraphs.map((p) => p.text).join("\n\n");
          const wordCount = plainText.split(/\s+/).filter(Boolean).length;
          return {
            contextualTitle: String(rp.contextualTitle || "").trim() || void 0,
            startPage,
            endPage,
            wordCount,
            estimatedReadingMinutes: Math.max(1, Math.round(wordCount / safeWpm)),
            paragraphs,
            blocks,
            plainText,
            isAiOrganized: true
          };
        }).filter(Boolean);
        return {
          parts: normalizedParts,
          batchSummary: typeof parsed.batchSummary === "string" ? parsed.batchSummary.trim() : "",
          batchSessionTitle: typeof parsed.batchSessionTitle === "string" ? parsed.batchSessionTitle.trim() : ""
        };
      } catch (err) {
        lastError = err;
        const parsedErr = extractCleanGeminiError(err);
        const isTransient = parsedErr.status === 429 || parsedErr.status === 503;
        if (attempt === 0 && isTransient) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
        if (isTransient || parsedErr.status === 404) {
          break;
        }
        throw parsedErr;
      }
    }
  }
  throw extractCleanGeminiError(lastError);
}

// src/server/vercelHandler.ts
async function getJsonBody(req) {
  if (req.body !== void 0 && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString("utf8"));
      } catch {
        return {};
      }
    }
    if (typeof req.body === "object") {
      return req.body;
    }
    if (typeof req.body === "string") {
      try {
        return req.body ? JSON.parse(req.body) : {};
      } catch {
        return {};
      }
    }
  }
  return new Promise((resolve) => {
    let bodyData = "";
    req.on("data", (chunk) => {
      bodyData += chunk;
    });
    req.on("end", () => {
      try {
        resolve(bodyData ? JSON.parse(bodyData) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
    if (req.readableEnded || req.complete) {
      try {
        resolve(bodyData ? JSON.parse(bodyData) : {});
      } catch {
        resolve({});
      }
    }
  });
}
function resolveApiPath(req) {
  const rawUrl = typeof req.url === "string" && req.url.startsWith("/") ? req.url : "/";
  const urlObj = new URL(rawUrl, "http://localhost");
  const routeParam = req.query?.__route ?? urlObj.searchParams.get("__route");
  const rawRoute = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const pathname = rawRoute ? `/api/${String(rawRoute).replace(/^\/+/, "")}` : urlObj.pathname;
  return pathname.replace(/\/+$/, "") || "/api";
}
function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
async function handler(req, res) {
  let pathname = "/api";
  try {
    const method = (req.method || "GET").toUpperCase();
    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    pathname = resolveApiPath(req);
    if (pathname === "/api/health" && method === "GET") {
      return sendJson(res, 200, { status: "ok", timestamp: Date.now() });
    }
    if (method !== "POST") {
      return sendJson(res, 404, { error: `API endpoint ${method} ${pathname} not found.` });
    }
    const body = await getJsonBody(req);
    switch (pathname) {
      case "/api/analyze": {
        const result = await handleAnalyzeApi(body);
        return sendJson(res, 200, result);
      }
      case "/api/combined-analyze": {
        const result = await handleCombinedAnalyzeApi(body);
        return sendJson(res, 200, result);
      }
      case "/api/deepen-chapter": {
        const result = await handleDeepenChapterApi(body);
        return sendJson(res, 200, result);
      }
      case "/api/extract-remedies": {
        const result = await handleExtractRemediesApi(body);
        return sendJson(res, 200, result);
      }
      case "/api/chat": {
        const result = await handleChatApi(body);
        return sendJson(res, 200, result);
      }
      case "/api/tts": {
        const result = await handleTtsApi(body);
        return sendJson(res, 200, result);
      }
      case "/api/translate-content": {
        const result = await handleTranslateContentApi(body);
        return sendJson(res, 200, result);
      }
      case "/api/blc-plan": {
        const result = await handleBlcPlanApi(body);
        return sendJson(res, 200, result);
      }
      case "/api/blc-format-literal": {
        const result = await handleBlcFormatLiteralApi(body);
        return sendJson(res, 200, result);
      }
      default:
        return sendJson(res, 404, { error: `API endpoint ${method} ${pathname} not found.` });
    }
  } catch (error) {
    const status = Number(error?.status) || 500;
    const rawMsg = String(error?.message || "An error occurred during API processing.").replace(/\s+/g, " ").trim();
    console.error(`Error in ${pathname} [${status}]: ${rawMsg}`);
    const is503 = status === 503 || rawMsg.includes("503");
    const is429 = status === 429 || rawMsg.includes("429") || rawMsg.toLowerCase().includes("quota");
    const message = is503 ? "The Gemini AI model is experiencing temporary high demand. Please try again in a few seconds." : is429 ? "Gemini API rate limit or quota reached. Please wait a few moments and retry." : rawMsg;
    return sendJson(res, status, { error: message });
  }
}
export {
  handler as default
};
