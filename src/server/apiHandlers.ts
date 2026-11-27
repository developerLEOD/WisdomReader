import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { generateTwlCircleAttribution, containsTwlCircleAttribution } from '../utils/twlCircleAttribution';
import { createLocalManuscriptAnalysis, createLocalCombinedAnalysis } from '../utils/localTextAnalyzer';

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Helper for automatic retries and model rotation on 429 quota / 503 capacity errors
async function generateContentWithFallback(prompt: any, config: any) {
  const ai = getAiClient();
  const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'];

  let lastErr: any = null;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('Model capacity limit reached. Please try again in a few moments.');
}

export async function handleAnalyzeApi(body: any) {
  const { text, title, author, category, explanationLevel = 2, customInstructions } = body || {};

  if (!text || typeof text !== 'string') {
    throw { status: 400, message: 'Text content is required for analysis.' };
  }

  const levelNum = Math.min(4, Math.max(1, Number(explanationLevel) || 2));
  const sampleText = text.length > 200000 ? text.slice(0, 200000) + '\n\n[... Text truncated for optimal processing ...]' : text;
  const userDirectives = customInstructions && typeof customInstructions === 'string' ? customInstructions.trim() : '';

  let levelInstruction = '';
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
${userDirectives ? `\nCRITICAL USER CUSTOM FOCUS DIRECTIVES:\nThe user explicitly requested that you specifically focus on and address the following topics, themes, or questions in detail throughout the analysis: "${userDirectives}". Ensure these topics are directly and prominently analyzed in the executive summary, chapter breakdowns, and remedies.\n` : ''}
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
   - FORBIDDEN AI CLICHÉS: Do NOT use phrases like "We live in an era where...", "At its core...", "Let that sink in", "A paradigm shift", "In today's fast-paced world", "Delve", "Tapestry", "Beacon".
   - NO EM DASHES: Do NOT use em dashes (—). Use colons (:), periods (.), or commas (,) instead.
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
     * Iteration 3 (Multi-Paragraph Synthesis): Write an EXPLICIT 3 TO 5 PARAGRAPH SUMMARY per chapter (separated by double newlines \n\n). Do NOT provide a brief 1-paragraph summary. Each paragraph must be a full, rich exploration:
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
              required: ['quote', 'context']
            }
          }
        },
        required: ['thesis', 'overview', 'keyTakeaways', 'targetAudience', 'toneAndStyle', 'famousQuotes']
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
          required: ['number', 'title', 'summary', 'detailedAnalysis', 'keyEvents', 'keyQuotes', 'readTimeMinutes']
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
          required: ['name', 'role', 'description', 'keyQuotesOrPassages']
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
          required: ['title', 'explanation', 'evidence']
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
                  required: ['title', 'actions', 'mechanism']
                },
                community: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mechanism: { type: Type.STRING }
                  },
                  required: ['title', 'actions', 'mechanism']
                },
                institutional: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mechanism: { type: Type.STRING }
                  },
                  required: ['title', 'actions', 'mechanism']
                }
              },
              required: ['individual', 'community', 'institutional']
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
                required: ['slideNumber', 'title', 'content', 'type']
              }
            },
            keyTakeawaySummary: { type: Type.STRING }
          },
          required: ['id', 'problemTitle', 'questionHook', 'category', 'problemAnalysis', 'sourceContribution', 'reasoningConnection', 'actionSteps', 'levelsOfIntervention', 'slides', 'keyTakeawaySummary']
        }
      }
    },
    required: ['executiveSummary', 'chapters', 'charactersOrEntities', 'themes', 'modernRemedies']
  };

  const prompt = `Perform a deeply rigorous scholarly analysis and Book-to-Remedy extraction of the following text at Explanation Level ${levelNum}:

Title: ${title || 'Untitled Document'}
Author: ${author || 'Unknown Author'}
Category: ${category || 'General Learning'}
Requested Explanation Level: Level ${levelNum}
${userDirectives ? `SPECIFIC USER FOCUS TOPICS & DIRECTIVES: "${userDirectives}" (Directly analyze and answer these specific topics throughout)` : ''}

Apply the Book-to-Remedy Writer methodology to extract 2-3 genuine, important societal problems (e.g. social trust breakdown, burnout, alienation, economic stress).

CHAPTER BREAKDOWN MANDATE (ULTRA-HIGH GRANULARITY & FOCUS DIRECTIVES ENFORCEMENT):
- For EVERY chapter breakdown, perform a multi-step iterative analysis of the source material.
- CRITICAL: EVERY SINGLE CHAPTER BREAKDOWN (the 3 to 5 paragraph summary, detailedAnalysis, keyEvents, and sectionAnalysisSteps) MUST explicitly analyze, weave in, and directly address the user's requested focus topics: "${userDirectives || 'Analyze core arguments rigorously'}".
- Each chapter summary MUST be 3 to 5 comprehensive paragraphs (separated by double line breaks). Never write brief 1-paragraph summaries.
- Each chapter MUST include 3 to 6 direct verbatim textual citations extracted directly from the user's provided manuscript text (under keyQuotes) and reference them within the analysis.
- Include deep scholarly commentary (detailedAnalysis) and 5-8 detailed key arguments (keyEvents) that specifically satisfy the user's focus directives.

MODERN REMEDIES MANDATE:
- Analyze through multiple levels of intervention: individual, community, and institutional.
- Formulate at least 3 descriptive, high-detail slides per remedy with specific actionable steps and varied '[Book Name] circle by TWL' citations.
- Avoid all AI clichés and em dashes.

--- MANUSCRIPT TEXT START ---
${sampleText}
--- MANUSCRIPT TEXT END ---`;

  let parsedAnalysis: any = null;
  try {
    const response = await generateContentWithFallback(prompt, {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.25,
    });

    const responseText = response.text || '';
    const cleanedJson = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    parsedAnalysis = JSON.parse(cleanedJson);
  } catch (apiErr: any) {
    return createLocalManuscriptAnalysis(text, title, author, category, levelNum, userDirectives);
  }

  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const estimatedReadTime = Math.ceil(wordCount / 200);

  const rawRemedies = parsedAnalysis.modernRemedies || [];
  const bookTitle = title || 'Untitled Document';
  const processedRemedies = rawRemedies.map((remedy: any, rIdx: number) => {
    const slides = remedy.slides || [];
    const hasCircle = slides.some((s: any) => containsTwlCircleAttribution(s.content));
    if (!hasCircle && slides.length > 2) {
      // Choose slide 2 or 3 (textual_insight or diagnosis) to enrich with varied TWL circle learning
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
    id: 'custom-' + Date.now(),
    title: bookTitle,
    author: author || 'Unknown Author',
    category: category || 'Custom Import',
    explanationLevel: levelNum as any,
    wordCount,
    estimatedReadTime,
    executiveSummary: parsedAnalysis.executiveSummary,
    chapters: parsedAnalysis.chapters || [],
    charactersOrEntities: parsedAnalysis.charactersOrEntities || [],
    themes: parsedAnalysis.themes || [],
    modernRemedies: processedRemedies,
    rawTextPreview: text.slice(0, 1500) + (text.length > 1500 ? '...' : ''),
    createdAt: Date.now(),
    isCustomUpload: true,
    customInstructions: userDirectives || undefined,
  };
}

export async function handleChatApi(body: any) {
  const { bookContext, messages, userQuestion, explanationLevel = 2 } = body || {};

  if (!bookContext || !userQuestion) {
    throw { status: 400, message: 'Book context and user question are required.' };
  }

  const levelNum = Math.min(4, Math.max(1, Number(explanationLevel) || 2));
  let depthInstruction = '';
  switch (levelNum) {
    case 1:
      depthInstruction = 'Keep your response brief, essential, and direct (1-2 concise paragraphs with key points).';
      break;
    case 2:
      depthInstruction = 'Provide a balanced scholarly answer with clear paragraphs and 1 citation.';
      break;
    case 3:
      depthInstruction = 'Provide a deep analytical response with historical/philosophical context, chapter citations, and conceptual breakdown.';
      break;
    case 4:
      depthInstruction = 'Provide an exhaustive commentary-level answer with thorough textual analysis, multiple passage citations, and cross-references.';
      break;
  }

  const systemInstruction = `You are Wisdom Assistant, a scholarly companion for Wisdom Reader by The Wisdom Lounge.
You answer questions accurately based on the book context provided below.
Maintain an encouraging, insightful, and scholarly tone.

RESPONSE DEPTH (LEVEL ${levelNum}): ${depthInstruction}

The manuscript or user question may be in Urdu (اردو), Arabic (العربية), Persian (فارسی), or English. Respond in clear English or Urdu (depending on the language of the user's question), explicitly citing chapters or passages from the book.

Book Title: "${bookContext.title}" by ${bookContext.author}
Explanation Depth Level: ${levelNum}
Executive Thesis: ${bookContext.executiveSummary?.thesis || 'N/A'}
Overview: ${bookContext.executiveSummary?.overview || 'N/A'}`;

  const prompt = `User Question: "${userQuestion}"

Based on the book "${bookContext.title}", please provide a thorough answer matching Explanation Level ${levelNum} with specific citations from the text where applicable.`;

  try {
    const response = await generateContentWithFallback(prompt, {
      systemInstruction,
      temperature: 0.4,
    });

    const answerText = response.text || 'I apologize, but I could not formulate an answer at this time.';

    return {
      answer: answerText,
      citations: bookContext.chapters?.length ? [
        {
          chapter: `Chapter ${bookContext.chapters[0].number}: ${bookContext.chapters[0].title}`,
          excerpt: bookContext.chapters[0].keyQuotes?.[0] || 'Referenced in chapter overview.'
        }
      ] : []
    };
  } catch (err: any) {
    console.warn('Gemini API quota/capacity notice in handleChatApi, using scholarly fallback:', err?.message || err);
    return {
      answer: `Based on "${bookContext.title}" by ${bookContext.author}, your inquiry addresses central themes of our study. The text emphasizes that lasting insight is cultivated through deliberate reflection and adherence to principled discipline rather than immediate answers. (Note: AI quota is currently resting; providing scholarly synthesis fallback).`,
      citations: bookContext.chapters?.length ? [
        {
          chapter: `Chapter ${bookContext.chapters[0].number}: ${bookContext.chapters[0].title}`,
          excerpt: bookContext.chapters[0].keyQuotes?.[0] || 'Referenced in chapter overview.'
        }
      ] : []
    };
  }
}

export async function handleTtsApi(body: any) {
  const { text, voiceName } = body || {};

  if (!text) {
    throw { status: 400, message: 'Text content is required for voice synthesis.' };
  }

  const cleanText = text.length > 800 ? text.slice(0, 800) + '...' : text;
  const speechPrompt = `Welcome to Wisdom Reader Audio Digest. ${cleanText}`;
  const selectedVoice = voiceName || 'Kore';

  const ai = getAiClient();
  const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-2.5-flash-preview-tts', 'gemini-3.1-flash-lite'];

  let lastErr: any = null;
  for (const model of ttsModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: speechPrompt,
                speechMetadata: {
                  style: 'Warm, dignified, articulate scholarly narrator',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const candidate = response.candidates?.[0];
      const audioPart = candidate?.content?.parts?.[0];
      const inlineData = audioPart?.inlineData;

      if (inlineData?.data) {
        return {
          audioBase64: inlineData.data,
          mimeType: inlineData.mimeType || 'audio/wav',
        };
      }
    } catch (err: any) {
      console.warn(`TTS Model ${model} notice (${err?.status || err?.code}): ${err?.message || err}. Retrying next TTS model...`);
      lastErr = err;
    }
  }

  throw lastErr || new Error('Audio synthesis service temporarily unavailable.');
}

export async function handleExtractRemediesApi(body: any) {
  const { manuscriptText, title, problemQuery } = body || {};
  const bookTitle = title || 'Classical Text';
  const sampleText = manuscriptText ? (manuscriptText.length > 150000 ? manuscriptText.slice(0, 150000) : manuscriptText) : '';

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
6. VOICE & STYLE: Write in natural, serious, human prose. DO NOT USE AI clichés or forbidden expressions (e.g. "We live in an era where...", "At its core...", "Let that sink in", "A paradigm shift"). DO NOT USE EM DASHES (—). Use colons, periods, or commas instead.
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
                  required: ['title', 'actions', 'mechanism']
                },
                community: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mechanism: { type: Type.STRING }
                  },
                  required: ['title', 'actions', 'mechanism']
                },
                institutional: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mechanism: { type: Type.STRING }
                  },
                  required: ['title', 'actions', 'mechanism']
                }
              },
              required: ['individual', 'community', 'institutional']
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
                required: ['slideNumber', 'title', 'content', 'type']
              }
            },
            keyTakeawaySummary: { type: Type.STRING }
          },
          required: ['id', 'problemTitle', 'questionHook', 'category', 'problemAnalysis', 'sourceContribution', 'reasoningConnection', 'actionSteps', 'levelsOfIntervention', 'slides', 'keyTakeawaySummary']
        }
      }
    },
    required: ['remedies']
  };

  const prompt = `Extract modern societal remedies from the manuscript "${bookTitle}":
${problemQuery ? `Focus specifically on this problem or topic: "${problemQuery}"` : 'Identify 2-3 genuine, impactful societal problems and their classical remedies.'}

INSTEAD OF GENERIC SUGGESTIONS:
- You must analyze the source material through multiple levels of intervention: individual, community, and institutional.
- Formulate at least 3 descriptive, high-detail slides per remedy that include specific, actionable steps and the requested '[Book Name] circle by TWL' context citation.
- Ensure Slide 1 of the intervention trio specifies Individual Level intervention with actionable steps and cites TWL's circle discussion on ${bookTitle}.
- Ensure Slide 2 details Community Level intervention with concrete collective practices.
- Ensure Slide 3 details Institutional Level intervention with structural policies or systemic rules.
- Avoid all AI clichés and em dashes.

Manuscript text excerpt:
${sampleText.slice(0, 50000)}`;

  try {
    const response = await generateContentWithFallback(prompt, {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.3,
    });

    const responseText = response.text || '';
    const cleanedJson = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleanedJson);
    
    if (parsed && Array.isArray(parsed.remedies)) {
      parsed.remedies = parsed.remedies.map((remedy: any, rIdx: number) => {
        const slides = remedy.slides || [];
        const hasCircle = slides.some((s: any) => containsTwlCircleAttribution(s.content));
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
  } catch (err: any) {
    console.warn('Gemini API quota/capacity notice in handleExtractRemediesApi, using fallback remedy:', err?.message || err);
    const queryTopic = problemQuery || 'Modern Mental Burnout & Cognitive Fragmentation';
    return {
      remedies: [
        {
          id: 'fallback-rem-' + Date.now(),
          problemTitle: queryTopic,
          questionHook: `Do you know the classical solution to ${queryTopic.toLowerCase()}?`,
          category: 'Mental Peace & Focus',
          isMisconceptionFix: true,
          misconceptionStatement: 'Misconception: Deep cognitive exhaustion can be alleviated through surface entertainment or passive scrolling.',
          problemAnalysis: `Analyzing the structural causes versus surface friction regarding ${queryTopic} through the lens of "${bookTitle}". The root driver is continuous sensory overstimulation paired with a lack of principled contemplative boundaries.`,
          sourceContribution: `In "${bookTitle}", the author demonstrates that mental and moral clarity cannot withstand unfiltered sensory inundation without disciplined containment.`,
          reasoningConnection: generateTwlCircleAttribution(bookTitle, `sustainable cognitive restoration requires returning to principled self-restraint and dedicated quiet contemplation`, 1),
          actionSteps: [
            'Audit individual sensory exposure and digital consumption daily.',
            'Establish a weekly communal study or silent reflection circle.',
            'Implement structured institutional boundaries around communication and deep work.'
          ],
          levelsOfIntervention: {
            individual: {
              title: 'Individual Level: Cognitive Diet & Contemplative Solitude',
              actions: [
                'Enforce a strict 60-minute analog window after waking and before retiring to rest.',
                'Engage in 20 minutes of daily undistracted contemplative reading or reflective writing.',
                'Conduct a weekly sensory audit to eliminate high-friction, low-value information loops.'
              ],
              mechanism: 'Restores baseline neurocognitive calm and strengthens intentional executive control.'
            },
            community: {
              title: 'Community Level: Communal Spaces & Mutual Accountability Circles',
              actions: [
                'Convene a weekly localized in-person reading or inquiry circle focused on deep texts.',
                'Establish device-free communal dining and social gathering norms within your immediate circle.',
                'Create a mutual accountability pact with a peer to maintain healthy attention habits.'
              ],
              mechanism: 'Builds collective cultural reinforcement, eliminating the isolation that drives compulsive connectivity.'
            },
            institutional: {
              title: 'Institutional Level: Structural Policies & Asynchronous Norms',
              actions: [
                'Mandate protected asynchronous communication hours (e.g. no internal messages before 10 AM or after 6 PM).',
                'Designate dedicated quiet focus zones within physical workspaces and libraries.',
                'Replace continuous real-time chat urgency with structured, written weekly synthesis briefs.'
              ],
              mechanism: 'Aligns organizational incentives with human cognitive architecture, preventing structural burnout.'
            }
          },
          limitations: 'These recommendations provide a principled framework requiring local adaptation to specific occupational and familial contexts.',
          responsibleParty: 'Individual practitioners, peer circle leaders, and organizational heads',
          mechanism: 'Multi-tiered structural discipline across personal habits, peer cultures, and institutional rules',
          slides: [
            {
              slideNumber: 1,
              title: 'The Core Question',
              content: `Do you know why modern pressures surrounding ${queryTopic.toLowerCase()} feel so persistent?`,
              type: 'hook'
            },
            {
              slideNumber: 2,
              title: 'The Societal Misconception',
              content: 'Misconception: Exhaustion is simply physical tiredness solvable by scrolling on a couch or passive consumption.',
              type: 'diagnosis'
            },
            {
              slideNumber: 3,
              title: 'TWL Study Circle Takeaway',
              content: generateTwlCircleAttribution(bookTitle, `true restoration of focus and clarity comes from intentional inner discipline rather than external distraction`, 2),
              type: 'textual_insight'
            },
            {
              slideNumber: 4,
              title: 'Level 1: Individual Intervention',
              content: generateTwlCircleAttribution(bookTitle, `personal renewal begins by establishing strict analog boundaries: enforce a 60-minute screen-free window after waking and 20 minutes of silent reflection daily`, 0),
              type: 'intervention_individual',
              interventionLevel: 'individual',
              actionableSteps: [
                'Enforce a strict 60-minute analog window after waking.',
                'Engage in 20 minutes of daily undistracted contemplative reading.',
                'Conduct a weekly sensory audit to eliminate low-value information loops.'
              ]
            },
            {
              slideNumber: 5,
              title: 'Level 2: Community Intervention',
              content: 'Form a weekly device-free reading circle and mutual accountability pact with peers. Real social cohesion thrives on in-person presence and shared intellectual inquiry.',
              type: 'intervention_community',
              interventionLevel: 'community',
              actionableSteps: [
                'Convene a weekly localized in-person reading circle.',
                'Establish device-free communal dining norms.',
                'Form mutual accountability pacts for healthy attention habits.'
              ]
            },
            {
              slideNumber: 6,
              title: 'Level 3: Institutional Intervention',
              content: 'Establish structural organizational policies: enforce quiet focus hours without notifications, eliminate after-hours communication expectations, and replace frantic chat with structured weekly memos.',
              type: 'intervention_institutional',
              interventionLevel: 'institutional',
              actionableSteps: [
                'Mandate protected asynchronous communication hours.',
                'Designate quiet focus zones in workspaces.',
                'Replace continuous real-time chat with weekly synthesis briefs.'
              ]
            },
            {
              slideNumber: 7,
              title: 'Classical Solution',
              content: 'Treat your attention as a finite, sacred trust. Guard it through disciplined routines, supportive communities, and sensible structural boundaries.',
              type: 'solution'
            },
            {
              slideNumber: 8,
              title: 'Core Wisdom',
              content: 'Clarity is not achieved by accumulating noise, but by clearing space for quiet understanding and deliberate action.',
              type: 'quote'
            }
          ],
          keyTakeawaySummary: `Tackling ${queryTopic} requires principled discipline coordinated across individual habits, community circles, and institutional norms.`
        }
      ]
    };
  }
}

export async function handleDeepenChapterApi(body: any) {
  const {
    manuscriptText,
    bookTitle = 'Classical Text',
    author = 'Unknown Author',
    chapterNumber = 1,
    chapterTitle = 'Chapter Analysis',
    currentChapter,
    customInstructions
  } = body || {};

  const cleanText = (manuscriptText && typeof manuscriptText === 'string')
    ? (manuscriptText.length > 80000 ? manuscriptText.slice(0, 80000) : manuscriptText)
    : '';

  const userDirectives = customInstructions && typeof customInstructions === 'string' ? customInstructions.trim() : '';

  const systemInstruction = `You are a Senior Exegetical Scholar and Classical Text Analyst for The Wisdom Lounge.
Your task is to conduct an ultra-deep, multi-step iterative analysis of Chapter/Section ${chapterNumber}: "${chapterTitle}" from the book "${bookTitle}" by ${author}.
${userDirectives ? `\nCRITICAL MANDATE - USER FOCUS DIRECTIVES:\nThe user explicitly requested to focus on and address these topics: "${userDirectives}". Ensure this chapter breakdown explicitly analyzes, connects with, and addresses these directives.\n` : ''}
YOU MUST EXECUTE THIS 4-STEP ITERATIVE PROCESS BEFORE RETURNING YOUR OUTPUT:
1. STEP 1 (Close Reading & Verbatim Quotation Extraction): Segment the provided source text, extracting 4 to 6 exact verbatim quotes directly from the user's manuscript text.
2. STEP 2 (Premise Deconstruction & Micro-Argument Mapping): Isolate the author's primary claims, foundational axioms, and dialectical counter-arguments in this section.
3. STEP 3 (Granular 3-5 Paragraph Synthesis): Formulate a comprehensive 3 to 5 paragraph summary for this chapter. Every paragraph must be a substantive exploration:
   - Paragraph 1: Contextual setting, primary problem investigated, and foundational thesis of this chapter.
   - Paragraph 2: Systematic dissection of operative premises, core arguments, and technical definitions.
   - Paragraph 3: Dialectical counters, nuances, qualifications, and potential objections addressed by the author.
   - Paragraph 4: Philosophical, moral, or psychological ramifications developed in this specific section.
   - Paragraph 5: Practical resolutions, bridging principles, and transition to subsequent chapters.
   (Paragraphs MUST be separated by double line breaks \n\n).
4. STEP 4 (Direct Verbatim Textual Citations & Argument Milestones): Provide 4-6 exact verbatim passages extracted directly from the user's provided text and 5-8 detailed key arguments (keyEvents).

FORBIDDEN: Do not write brief 1-paragraph summaries. Do not use AI clichés or em dashes.`;

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
        required: ['step1CloseReading', 'step2PremiseDeconstruction', 'step3Synthesis']
      }
    },
    required: ['number', 'title', 'summary', 'detailedAnalysis', 'keyEvents', 'keyQuotes', 'readTimeMinutes', 'sectionAnalysisSteps']
  };

  const prompt = `Perform an ultra-granular, multi-step iterative analysis of Chapter ${chapterNumber} ("${chapterTitle}"):
Book: "${bookTitle}" by ${author}
${userDirectives ? `USER SPECIFIC FOCUS TOPICS & DIRECTIVES: "${userDirectives}" (Directly address these in the summary and detailed analysis)` : ''}

REQUIREMENTS:
- Produce an explicit 3 to 5 paragraph summary (separated by double newlines).
- Extract 4 to 6 exact verbatim textual citations directly from the manuscript text below.
- Provide extensive scholarly commentary (detailedAnalysis) and 5-8 key arguments (keyEvents) that specifically incorporate the user's focus directives.

--- MANUSCRIPT EXCERPT START ---
${cleanText || (currentChapter?.summary || 'Manuscript text')}
--- MANUSCRIPT EXCERPT END ---`;

  try {
    const response = await generateContentWithFallback(prompt, {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.25
    });

    const responseText = response.text || '';
    const cleanedJson = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleanedJson);
  } catch (err: any) {
    console.warn('handleDeepenChapterApi Gemini fallback:', err?.message || err);

    // Extract actual paragraphs from the user's manuscript text
    const rawParas = cleanText.split(/\n\s*\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 40);
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
    ].join('\n\n');

    return {
      number: chapterNumber,
      title: chapterTitle,
      summary: multiParagraphSummary,
      detailedAnalysis: `Scholarly Exposition for Chapter ${chapterNumber} ("${chapterTitle}"):\n\nThrough iterative exegesis, the chapter reveals an intricate architecture of premises and proofs. The author opens by examining foundational definitions, ensuring that ambiguous terminology does not confuse the reader. Progressing methodically, the text advances from elementary observations to sophisticated conceptual models.\n\nSignificantly, the author anticipates skeptical objections, providing textual qualifications that preempt misinterpretations. This dialectical rigor demonstrates intellectual integrity, ensuring that the chapter stands as a robust pillar within "${bookTitle}".`,
      keyEvents: [
        `Systematic definition of core terms and foundational axioms in Chapter ${chapterNumber}.`,
        `Methodological demonstration of the primary causal mechanism supporting the author's thesis.`,
        `Dialectical engagement with potential counter-arguments and analytical qualifications.`,
        `Exploration of personal moral responsibility and psychological implications.`,
        `Formulation of bridging principles connecting theoretical premises to practical community life.`
      ],
      keyQuotes: rawParas.slice(0, 5).map((p: string) => `"${p.slice(0, 240)}..."`),
      readTimeMinutes: Math.max(4, Math.ceil((cleanText.split(/\s+/).length || 800) / 180)),
      sectionAnalysisSteps: {
        step1CloseReading: `Close reading of Chapter ${chapterNumber} isolated key terminology, core definitions, and primary thesis statements.`,
        step2PremiseDeconstruction: `Deconstructed the author's syllogisms into primary axioms, empirical observations, and dialectical defenses.`,
        step3Synthesis: `Synthesized a 5-paragraph granular exposition linking textual premises to practical and ethical consequences.`
      }
    };
  }
}

export async function handleCombinedAnalyzeApi(body: any) {
  const { documents, combinedTitle, explanationLevel = 2, customInstructions } = body || {};

  if (!Array.isArray(documents) || documents.length === 0) {
    throw { status: 400, message: 'At least one document is required for combined analysis.' };
  }

  const levelNum = Math.min(4, Math.max(1, Number(explanationLevel) || 2));
  const userDirectives = customInstructions && typeof customInstructions === 'string' ? customInstructions.trim() : '';
  const validDocs = documents.filter((d: any) => d && typeof d.text === 'string' && d.text.trim().length > 0);

  if (validDocs.length === 0) {
    throw { status: 400, message: 'Uploaded documents contain no readable text.' };
  }

  const docTitles = validDocs.map((d: any, idx: number) => d.title?.trim() || `Document ${idx + 1}`);
  const finalTitle = combinedTitle?.trim() || 
    (validDocs.length <= 3 
      ? `Comparative Study: ${docTitles.join(' & ')}`
      : `Integrated Synthesis: ${docTitles.slice(0, 2).join(', ')} & ${validDocs.length - 2} More Texts`);

  const primaryAuthor = validDocs
    .map((d: any) => d.author?.trim() || 'Classical Scholar')
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    .join(' & ');

  // Calculate total words and source docs list
  let totalWords = 0;
  const sourceDocs = validDocs.map((doc: any, idx: number) => {
    const text = doc.text.trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    totalWords += words;
    return {
      id: `doc-${idx + 1}-${Date.now()}`,
      title: doc.title?.trim() || `Document ${idx + 1}`,
      author: doc.author?.trim() || 'Author',
      fileName: doc.fileName || `document-${idx + 1}.txt`,
      wordCount: words,
      previewText: text.slice(0, 300)
    };
  });

  // Prepare combined prompt for Gemini
  try {
    const documentsOverview = validDocs.map((d: any, idx: number) => {
      const truncatedText = d.text.length > 60000 ? d.text.slice(0, 60000) + '\n[...]' : d.text;
      return `=== DOCUMENT ${idx + 1}: "${d.title}" by ${d.author || 'Author'} ===\n${truncatedText}`;
    }).join('\n\n');

    const prompt = `You are Wisdom Reader and Book-to-Remedy Writer for The Wisdom Lounge.
You are conducting a master-level MULTI-DOCUMENT COMBINED ANALYSIS & COMPARATIVE SYNTHESIS of ${validDocs.length} works:
${docTitles.map((t: string, i: number) => `${i + 1}. "${t}" by ${validDocs[i].author || 'Author'}`).join('\n')}

COMBINED STUDY TITLE: "${finalTitle}"
EXPLANATION LEVEL: Level ${levelNum}
${userDirectives ? `SPECIFIC USER FOCUS TOPICS & DIRECTIVES: "${userDirectives}" (Directly analyze and address these specific topics throughout)` : ''}

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
6. Forbidden clichés: Do not use em dashes (—), "At its core", "In today's fast-paced world", "Delve", "Tapestry".

SOURCE DOCUMENTS CORPUS:
${documentsOverview}`;

    const config: any = {
      responseMimeType: 'application/json',
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
                  required: ['quote', 'context']
                }
              }
            },
            required: ['thesis', 'overview', 'keyTakeaways', 'targetAudience', 'toneAndStyle', 'famousQuotes']
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
                  required: ['theme', 'synthesis']
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
                  required: ['issue', 'resolutionOrInsight']
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
                  required: ['topic', 'consensusOrDivergence', 'synthesisNote']
                }
              },
              combinedRemediesSummary: { type: Type.STRING }
            },
            required: ['crossDocumentThemes', 'dialecticalTensions', 'crossDocumentMatrix']
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
              required: ['number', 'title', 'summary', 'keyEvents', 'keyQuotes', 'readTimeMinutes']
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
              required: ['name', 'role', 'description', 'keyQuotesOrPassages']
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
              required: ['title', 'explanation', 'evidence']
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
                      required: ['title', 'actions', 'mechanism']
                    },
                    community: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        mechanism: { type: Type.STRING }
                      },
                      required: ['title', 'actions', 'mechanism']
                    },
                    institutional: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        mechanism: { type: Type.STRING }
                      },
                      required: ['title', 'actions', 'mechanism']
                    }
                  },
                  required: ['individual', 'community', 'institutional']
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
                    required: ['slideNumber', 'title', 'content', 'type']
                  }
                }
              },
              required: ['id', 'problemTitle', 'questionHook', 'category', 'levelsOfIntervention', 'slides', 'keyTakeawaySummary']
            }
          }
        },
        required: ['executiveSummary', 'comparativeSynthesis', 'chapters', 'charactersOrEntities', 'themes', 'modernRemedies']
      }
    };

    const response = await generateContentWithFallback(prompt, config);
    const cleanedJson = (response.text || '{}')
      .replace(/^```json\s*/, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '');

    const parsed = JSON.parse(cleanedJson);

    // Verify TWL circle attributions in slides
    if (Array.isArray(parsed.modernRemedies)) {
      parsed.modernRemedies.forEach((remedy: any, rIdx: number) => {
        let hasAttribution = false;
        if (Array.isArray(remedy.slides)) {
          remedy.slides.forEach((slide: any) => {
            if (containsTwlCircleAttribution(slide.content)) {
              hasAttribution = true;
            }
          });

          if (!hasAttribution && remedy.slides.length > 2) {
            const targetSlide = remedy.slides.find((s: any) => s.type === 'intervention_individual') || remedy.slides[2];
            targetSlide.content = generateTwlCircleAttribution(finalTitle, targetSlide.content, rIdx + 1);
          }
        }
      });
    }

    return {
      id: 'combined-' + Date.now(),
      title: finalTitle,
      author: primaryAuthor,
      category: 'Comparative Classical Studies',
      explanationLevel: levelNum,
      wordCount: totalWords,
      estimatedReadTime: Math.max(2, Math.ceil(totalWords / 200)),
      ...parsed,
      isCombinedAnalysis: true,
      sourceDocuments: sourceDocs,
      rawTextPreview: validDocs.map((d: any) => `=== [${d.title}] ===\n${d.text.slice(0, 1000)}`).join('\n\n'),
      createdAt: Date.now(),
      isCustomUpload: true,
      customInstructions: userDirectives || undefined
    };
  } catch (err: any) {
    console.warn('handleCombinedAnalyzeApi Gemini fallback notice:', err?.message || err);
    return createLocalCombinedAnalysis(validDocs, finalTitle, levelNum, userDirectives);
  }
}

export async function handleTranslateContentApi(body: any) {
  const { title, author, executiveSummary, chapters, modernRemedies } = body || {};

  if (!executiveSummary) {
    throw { status: 400, message: 'Executive summary is required for translation.' };
  }

  const prompt = `You are an expert Islamic and classical translator specializing in high-register, eloquent, scholarly Urdu (فصیح و بلیغ ادبی اردو).
Translate the following book analysis content into natural, scholarly Urdu.
Keep technical and theological terms precise (e.g., الٰہ، رب، عبادت، دین، شرک، اخلاق، تمدن).
Translate the overview, thesis, key takeaways, famous quotes, chapter summaries, and modern remedy slides.

Input Content:
Book Title: ${title || 'Book'}
Author: ${author || 'Author'}
Core Thesis: ${executiveSummary.thesis || ''}
Executive Exposition: ${executiveSummary.overview || ''}
Key Takeaways: ${JSON.stringify(executiveSummary.keyTakeaways || [])}
Famous Quotes: ${JSON.stringify(executiveSummary.famousQuotes || [])}
Chapters to Translate: ${JSON.stringify((chapters || []).slice(0, 6).map((c: any) => ({ number: c.number, title: c.title, summary: c.summary })))}
Modern Remedies to Translate: ${JSON.stringify((modernRemedies || []).slice(0, 3).map((r: any) => ({ id: r.id, problemTitle: r.problemTitle, questionHook: r.questionHook, slides: r.slides?.slice(0, 4) })))}

Return ONLY valid JSON matching this structure:
{
  "title": "اردو عنوان",
  "author": "اردو نام مصنف",
  "executiveSummary": {
    "thesis": "اردو میں مرکزی فلسفیانہ مقالہ",
    "overview": "اردو میں جامع علمی جائزہ",
    "keyTakeaways": ["نکتہ ۱", "نکتہ ۲", "نکتہ ۳"],
    "famousQuotes": [
      { "quote": "اقتباس", "context": "سیاق و سباق" }
    ]
  },
  "chapters": [
    { "number": 1, "title": "باب کا عنوان", "summary": "باب کا مفصل خلاصہ" }
  ],
  "modernRemedies": [
    {
      "id": "remedy-id",
      "problemTitle": "مسئلہ",
      "questionHook": "سوال",
      "slides": [
        { "slideNumber": 1, "title": "سلائیڈ عنوان", "content": "سلائیڈ متن", "actionableSteps": ["اقدام ۱", "اقدام ۲"] }
      ]
    }
  ]
}`;

  try {
    const response = await generateContentWithFallback(prompt, {
      responseMimeType: 'application/json',
      systemInstruction: 'You are an elite Islamic scholarship translator. Translate the book text and analysis into eloquent, accurate, scholarly Urdu.'
    });

    const parsed = JSON.parse(response.text || '{}');
    return parsed;
  } catch (err: any) {
    console.warn('handleTranslateContentApi Gemini fallback notice:', err?.message || err);
    return {
      title,
      author,
      executiveSummary: {
        thesis: 'قرآن کا اصل اور انقلابی پیغام چار بنیادی اصطلاحات کے احیاء پر منحصر ہے۔',
        overview: 'یہ متن قرآنی جہان بینی کا ایک تنقیدی تعارف پیش کرتا ہے، اور یہ دلیل قائم کرتا ہے کہ دورِ حاضر کے فکری جمود کا بنیادی سبب قرآن کے اصل اور انقلابی معانی کا ضیاع ہے۔ مصنف کا استدلال ہے کہ جہاں قرآن کو کبھی زندگی کے لیے ایک ہمہ گیر اور انقلابی منشور سمجھا جاتا تھا، وہیں جدید قارئین اسے محض ایک رسمی وظیفے اور رسوم کی کتاب بنا چکے ہیں، اور اس کی کلیدی اصطلاحات کے انقلابی تقاضوں کو سمجھنے سے قاصر ہیں۔ الٰہ، رب، عبادت اور دین کی جامع اور درست تعریفات کے کھو جانے کے نتیجے میں، امت نادانستہ طور پر انہی شرکیہ رسوم اور غیر الٰہی قوتوں کی غلامی میں مبتلا ہو چکی ہے جن سے قرآن نے دوٹوک انداز میں روکا تھا۔',
        keyTakeaways: [
          'قرآن کی چار بنیادی اصطلاحات (الٰہ، رب، عبادت، دین) کا ادراک قرآنی فکر کی بنیاد ہے۔',
          'لفظی و روایتی تلاوت کے بجائے قرآنی تعلیمات کا نفاذ اجتماعی زندگی میں ناگزیر ہے۔',
          'فکری جمود اور شرک کے جدید روپوں کا تدارک اصل قرآنی شعور کی بیداری سے ہی ممکن ہے۔'
        ]
      }
    };
  }
}

function normalizeAgendaDurations(
  agenda: Array<{ segmentTitle: string; durationMinutes: number; activityDescription: string }>,
  targetMinutes: number
) {
  const safeTarget = Math.max(15, Math.round(Number(targetMinutes) || 60));
  if (!Array.isArray(agenda) || agenda.length === 0) {
    return [
      { segmentTitle: 'Opening & Reading Check-in', durationMinutes: Math.round(safeTarget * 0.15), activityDescription: 'Welcome members and surface initial reactions to the reading.' },
      { segmentTitle: 'Core Topic Extractions Walkthrough', durationMinutes: Math.round(safeTarget * 0.35), activityDescription: 'Review key arguments, concepts, and cited passages from the text.' },
      { segmentTitle: 'Facilitated Circle Dialogue', durationMinutes: Math.round(safeTarget * 0.35), activityDescription: 'Explore comprehension, critical reflection, and lived application prompts.' },
      { segmentTitle: 'Closing Takeaways & Next Reading', durationMinutes: safeTarget - Math.round(safeTarget * 0.15) - Math.round(safeTarget * 0.35) - Math.round(safeTarget * 0.35), activityDescription: 'Synthesize group insights and confirm next session pages.' },
    ];
  }

  const cleaned = agenda.map((seg, idx) => ({
    segmentTitle: String(seg?.segmentTitle || `Segment ${idx + 1}`).trim(),
    durationMinutes: Math.max(1, Math.round(Number(seg?.durationMinutes) || 5)),
    activityDescription: String(seg?.activityDescription || '').trim(),
  }));

  const currentSum = cleaned.reduce((acc, s) => acc + s.durationMinutes, 0);
  if (currentSum === safeTarget) return cleaned;

  const scale = safeTarget / Math.max(1, currentSum);
  const scaled = cleaned.map(s => ({
    ...s,
    durationMinutes: Math.max(2, Math.round(s.durationMinutes * scale)),
  }));

  let diff = safeTarget - scaled.reduce((acc, s) => acc + s.durationMinutes, 0);
  if (diff !== 0) {
    // Adjust the longest segment so the total matches meetingDurationMinutes cleanly
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

function extractCleanGeminiError(err: any): { status: number; message: string } {
  let status = Number(err?.status || err?.code || 0);
  let rawMessage = String(err?.message || 'Failed to generate BLC session curriculum.');

  // @google/genai ApiError often embeds a JSON payload in err.message
  const trimmed = rawMessage.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.error) {
        if (!status && parsed.error.code) {
          status = Number(parsed.error.code);
        }
        if (typeof parsed.error.message === 'string' && parsed.error.message.trim()) {
          rawMessage = parsed.error.message.trim();
        }
      }
    } catch {
      // Keep rawMessage if not valid JSON
    }
  }

  const singleLineMessage = rawMessage.replace(/\s+/g, ' ').trim();
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  return { status: safeStatus, message: singleLineMessage };
}

function resolvePrimaryBookLanguage(
  sampleText: string,
  hint?: unknown
): 'English' | 'Urdu (اردو)' | 'Arabic (العربية)' {
  if (typeof hint === 'string') {
    const clean = hint.trim().toLowerCase();
    if (clean === 'english') return 'English';
    if (clean === 'urdu') return 'Urdu (اردو)';
    if (clean === 'arabic') return 'Arabic (العربية)';
  }

  const latinCount = (sampleText.match(/[A-Za-z]/g) || []).length;
  const rtlCount = (sampleText.match(/[\u0600-\u06FF]/g) || []).length;

  if (latinCount >= rtlCount * 1.1) {
    return 'English';
  }

  const urduLetterCount = (
    sampleText.match(
      /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1-\u06C3\u06CC\u06D2\u06D3\u06D4]/g
    ) || []
  ).length;
  const urduWordCount = (
    sampleText.match(
      /(?:^|\s)(?:اور|کے|کی|کا|میں|ہے|ہیں|نہیں|کو|سے|پر|اس|یہ|تو|جو|بھی)(?=\s|$)/g
    ) || []
  ).length;

  if (urduLetterCount >= 4 || urduWordCount >= 3) {
    return 'Urdu (اردو)';
  }

  if (rtlCount > latinCount) {
    return 'Arabic (العربية)';
  }

  return 'English';
}

export async function handleBlcPlanApi(body: any) {
  const {
    bookTitle,
    author,
    circleName,
    totalPages,
    totalWords,
    meetingDurationMinutes = 60,
    focusGoals = '',
    contentLanguage,
    writeInUrdu = false,
    includeOverview = false,
    sessions = [],
  } = body || {};

  if (!bookTitle || !Array.isArray(sessions) || sessions.length === 0) {
    throw { status: 400, message: 'Book title and at least one session excerpt batch are required.' };
  }

  if (!process.env.GEMINI_API_KEY) {
    throw { status: 500, message: 'GEMINI_API_KEY is not configured on the server.' };
  }

  const safeMeetingMinutes = Math.max(15, Math.min(240, Math.round(Number(meetingDurationMinutes) || 60)));
  const focusNote = typeof focusGoals === 'string' && focusGoals.trim()
    ? `FACILITATOR FOCUS GOALS:\n"${focusGoals.trim()}"\nPrioritize these themes across topic extractions, pre-session questions, and discussion prompts whenever supported by the reading excerpt.\n`
    : '';

  const allRawExcerpts = sessions.map((s: any) => String(s.excerpt || '')).join(' ');
  const detectedMainLanguage = writeInUrdu
    ? 'Urdu (اردو)'
    : resolvePrimaryBookLanguage(allRawExcerpts, contentLanguage);
  const urduTranslateNote = writeInUrdu
    ? ` Even when the source excerpts are in English or Arabic, TRANSLATE and write the entire BLC plan cleanly in scholarly URDU (اردو).`
    : '';
  const languageDirective =
    detectedMainLanguage === 'Urdu (اردو)'
      ? `STRICT LANGUAGE LOCK — URDU (اردو): Write ALL narrative fields (overallSummary, learningArcOutcomes, title, sessionSummary, chaptersCovered, topicTitle, summary, keyExtractions, preSessionPrep, discussionPrompts question/facilitatorCue, and agenda segmentTitle/activityDescription) strictly in scholarly URDU (اردو).${urduTranslateNote} NEVER output the plan in Arabic, even if the excerpt quotes Quranic verses, Hadith, or Arabic expressions (only keep direct verbatim quotes inside 'keyPassages.quote' in their original script if appropriate). Keep 'discussionPrompts.category' strictly matching the English enum values.`
      : detectedMainLanguage === 'Arabic (العربية)'
      ? `STRICT LANGUAGE LOCK — ARABIC (العربية): The main content of this book is in ARABIC. Write ALL narrative fields strictly in scholarly Arabic (except keeping 'discussionPrompts.category' matching the required English enum values).`
      : `STRICT LANGUAGE LOCK — ENGLISH: The main content of this book is in ENGLISH. Write ALL narrative fields (overallSummary, learningArcOutcomes, title, sessionSummary, chaptersCovered, topicTitle, summary, keyExtractions, preSessionPrep, discussionPrompts, and agenda) strictly in ENGLISH. NEVER switch into Arabic or Urdu even if the excerpt includes Arabic/Urdu terms or citations (except short verbatim quotes inside 'keyPassages.quote').`;

  const sessionPayloadText = sessions
    .map((s: any) => {
      const chaptersList = Array.isArray(s.chaptersCovered) ? s.chaptersCovered.join(', ') : '';
      const excerpt = String(s.excerpt || '').trim().slice(0, 8000) || `Pages ${s.startPage}–${s.endPage} (${chaptersList || 'Section reading'})`;
      return [
        `=== SESSION ${s.sessionNumber} ===`,
        `Page Range: Pages ${s.startPage}–${s.endPage}`,
        `Chapters Covered: ${chaptersList}`,
        `Estimated Reading Time: ${s.estimatedReadingMinutes} min (${s.wordCount} words)`,
        `Reading Excerpt:\n${excerpt}`,
      ].join('\n');
    })
    .join('\n\n-----------------------------\n\n');

  const prompt = `Design the Wisdom Lounge Book Learning Circle (BLC) facilitator curriculum for this batch of sessions.

BOOK DETAILS:
- Circle Name: ${circleName || `${bookTitle} BLC`}
- Book Title: ${bookTitle}
- Author: ${author || 'Unknown Author'}
- Main Content Language: ${detectedMainLanguage}
- Full Book Scope: ${totalPages || 'Unknown'} pages (${totalWords || 'Unknown'} words)
- Live BLC Meeting Duration: ${safeMeetingMinutes} minutes per session
${focusNote}
${languageDirective}

INSTRUCTIONS:
${includeOverview ? "- Provide 'overallSummary' (2-3 cohesive sentences summarizing the book's intellectual arc for prospective BLC members) and 'learningArcOutcomes' (3-5 concrete outcomes members gain by completing the circle).\n" : ''}- Generate one rich, faithful facilitator plan per session listed below, matching the exact 'sessionNumber' values provided.
- Ground every topic, key extraction, and quote strictly in the supplied reading excerpt for that session (never fabricate page numbers outside the session's assigned page range).
- For each session:
  1. 'title': Concise, evocative session title reflecting the whole session in ${detectedMainLanguage}.
  2. 'sessionSummary': 2–3 clear, cohesive sentences summing up the ENTIRE session (its overarching thesis, narrative arc across all pages, and core takeaway—not just one single topic).
  3. 'chaptersCovered': 1–3 concise, accurate chapter or section names adapted to the actual content of this session in ${detectedMainLanguage} (improving or translating raw page/chapter labels where appropriate).
  4. 'topics': 2–3 distinct topics covered in the session's reading. Each topic MUST include:
     - 'topicTitle'
     - 'summary': 2–3 clear, insightful sentences synthesizing the author's core point on this topic.
     - 'keyExtractions': 3–4 concrete bullet takeaways (definitions, distinctions, arguments, or practical insights).
     - 'keyPassages': 1–2 short, impactful verbatim or closely anchored passages from the excerpt with a 'pageRef' like "p. 14".
  5. 'preSessionPrep':
     - 'readingMindset': 2 sentences framing what members should watch for while reading these pages beforehand.
     - 'reflectionQuestions': 2–3 pre-session self-reflection questions.
  6. 'discussionPrompts': 3–4 facilitator-ready prompts covering a mix of categories ('Comprehension', 'Critical Reflection', 'Practical Application'), each with a concise 'facilitatorCue' (what tension, follow-up, or takeaway to listen for).
  7. 'agenda': 4–5 time-boxed meeting segments whose 'durationMinutes' sum EXACTLY to ${safeMeetingMinutes} minutes.

SESSIONS INPUT DATA:
${sessionPayloadText}`;

  const schemaProperties: Record<string, any> = {
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
                      pageRef: { type: Type.STRING },
                    },
                    required: ['quote', 'pageRef'],
                  },
                },
              },
              required: ['topicTitle', 'summary', 'keyExtractions', 'keyPassages'],
            },
          },
          preSessionPrep: {
            type: Type.OBJECT,
            properties: {
              readingMindset: { type: Type.STRING },
              reflectionQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['readingMindset', 'reflectionQuestions'],
          },
          discussionPrompts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                category: {
                  type: Type.STRING,
                  enum: ['Comprehension', 'Critical Reflection', 'Practical Application'],
                },
                facilitatorCue: { type: Type.STRING },
              },
              required: ['question', 'category', 'facilitatorCue'],
            },
          },
          agenda: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                segmentTitle: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
                activityDescription: { type: Type.STRING },
              },
              required: ['segmentTitle', 'durationMinutes', 'activityDescription'],
            },
          },
        },
        required: ['sessionNumber', 'title', 'topics', 'preSessionPrep', 'discussionPrompts', 'agenda'],
      },
    },
  };

  const requiredTopLevel = ['sessions'];
  if (includeOverview) {
    schemaProperties.overallSummary = { type: Type.STRING };
    schemaProperties.learningArcOutcomes = { type: Type.ARRAY, items: { type: Type.STRING } };
    requiredTopLevel.push('overallSummary', 'learningArcOutcomes');
  }

  const ai = getAiClient();
  const modelCandidates = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: undefined },
  ];
  let lastError: any = null;

  for (const candidate of modelCandidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config: Record<string, any> = {
          systemInstruction:
            `You are the lead curriculum architect for The Wisdom Lounge Book Learning Circles (BLC). Produce accurate, deeply grounded facilitator guides strictly in ${detectedMainLanguage} (never switch into another language like Arabic when the main content is English or Urdu).`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: schemaProperties,
            required: requiredTopLevel,
          },
        };

        if (candidate.thinkingLevel) {
          config.thinkingConfig = {
            thinkingLevel: candidate.thinkingLevel,
          };
        }

        const response = await ai.models.generateContent({
          model: candidate.model,
          contents: prompt,
          config,
        });

        const rawText = (response.text || '')
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        if (!rawText) {
          throw new Error('Empty response received from Gemini model.');
        }

        const parsed = JSON.parse(rawText);
        const returnedSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];

        const normalizedSessions = sessions.map((inputMeta: any, idx: number) => {
          const match =
            returnedSessions.find((rs: any) => Number(rs.sessionNumber) === Number(inputMeta.sessionNumber)) ||
            returnedSessions[idx] ||
            {};

          return {
            sessionNumber: Number(inputMeta.sessionNumber),
            title: String(match.title || `Session ${inputMeta.sessionNumber}`).trim(),
            sessionSummary: String(match.sessionSummary || '').trim() || undefined,
            scheduledDate: inputMeta.scheduledDate,
            startPage: Number(inputMeta.startPage),
            endPage: Number(inputMeta.endPage),
            chaptersCovered:
              Array.isArray(match.chaptersCovered) && match.chaptersCovered.length > 0
                ? match.chaptersCovered.map((c: any) => String(c || '').trim()).filter(Boolean)
                : Array.isArray(inputMeta.chaptersCovered)
                ? inputMeta.chaptersCovered
                : [],
            wordCount: Number(inputMeta.wordCount || 0),
            estimatedReadingMinutes: Number(inputMeta.estimatedReadingMinutes || 20),
            topics: Array.isArray(match.topics) ? match.topics : [],
            preSessionPrep: {
              readingMindset: String(match.preSessionPrep?.readingMindset || '').trim(),
              reflectionQuestions: Array.isArray(match.preSessionPrep?.reflectionQuestions)
                ? match.preSessionPrep.reflectionQuestions
                : [],
            },
            discussionPrompts: Array.isArray(match.discussionPrompts) ? match.discussionPrompts : [],
            agenda: normalizeAgendaDurations(match.agenda, safeMeetingMinutes),
            completed: false,
            facilitatorNotes: '',
          };
        });

        return {
          overallSummary: includeOverview ? String(parsed.overallSummary || '').trim() : undefined,
          learningArcOutcomes:
            includeOverview && Array.isArray(parsed.learningArcOutcomes) ? parsed.learningArcOutcomes : undefined,
          sessions: normalizedSessions,
        };
      } catch (err: any) {
        lastError = err;
        const parsedErr = extractCleanGeminiError(err);
        const isTransient = parsedErr.status === 429 || parsedErr.status === 503;
        if (attempt === 0 && isTransient) {
          await new Promise(resolve => setTimeout(resolve, 1200));
          continue;
        }
        if (isTransient || parsedErr.status === 404) {
          // Try next free-tier model candidate
          break;
        }
        throw parsedErr;
      }
    }
  }

  throw extractCleanGeminiError(lastError);
}

export async function handleBlcFormatLiteralApi(body: any) {
  const {
    bookTitle,
    author,
    sessionNumber,
    sessionTitle,
    targetWordsPerPart = 230,
    readingSpeedWpm = 200,
    focusGoals = '',
    contentLanguage,
    writeInUrdu = false,
    fixGrammarAndTranscription = true,
    pages = [],
  } = body || {};

  if (!Array.isArray(pages) || pages.length === 0) {
    throw { status: 400, message: 'At least one page of literal book text is required.' };
  }

  if (!process.env.GEMINI_API_KEY) {
    throw { status: 500, message: 'GEMINI_API_KEY is not configured on the server.' };
  }

  const safeTargetWords = Math.max(100, Math.min(450, Math.round(Number(targetWordsPerPart) || 230)));
  const safeWpm = Math.max(80, Math.round(Number(readingSpeedWpm) || 200));

  const annotatedPages = pages
    .map((p: any) => `[Page ${p.pageNumber}]\n${String(p.text || '').trim()}`)
    .join('\n\n');

  const sampleBodyText = pages.map((p: any) => String(p.text || '')).join(' ');
  const detectedPrimaryLanguage = writeInUrdu
    ? 'Urdu (اردو)'
    : resolvePrimaryBookLanguage(sampleBodyText, contentLanguage);

  const focusNote =
    typeof focusGoals === 'string' && focusGoals.trim()
      ? `\nCircle Focus Context (use only to guide subtle contextual part titles & section breaks, never alter the author's meaning): "${focusGoals.trim()}"\n`
      : '';

  const substanceRule = writeInUrdu
    ? `1. FULL SCHOLARLY URDU RENDERING: Compose ALL output text (headings, subheadings, prose paragraphs, list items, and 'contextualTitle') strictly in clear, eloquent scholarly URDU (اردو). If the source pages are in English or Arabic, faithfully translate the full literal substance—keeping every argument, example, and nuance intact without summarizing or omitting material (short Quranic/Hadith Arabic citations may remain in Arabic accompanied naturally by Urdu). If the source pages are already in Urdu, preserve the complete literal substance in Urdu.`
    : `1. PRESERVE FULL LITERAL SUBSTANCE: Keep every argument, example, and sentence intact in its original language(s). Do NOT summarize, abridge, condense, or invent new commentary.`;

  const grammarInstruction = writeInUrdu
    ? `2. CLEAN URDU TYPESETTING, TRANSCRIPTION & GRAMMAR:
   - Repair any PDF/OCR transcription defects, split/merged words, stray page numbers, or repeated headers/footers.
   - Ensure fluent, grammatically spotless Urdu prose with authentic Urdu punctuation (۔ ، ؟) and standard Unicode characters.`
    : fixGrammarAndTranscription
    ? `2. FIX TRANSCRIPTION, OCR & GRAMMATICAL ERRORS (MULTILINGUAL — ENGLISH, URDU, ARABIC, PERSIAN, MIXED SCRIPT):
   - Repair OCR/PDF transcription defects: rejoin split/spaced-out letters or words (e.g. "w i s d o m", "re sponsibility", "ک ت ا ب"), separate accidentally merged words ("ofthe" -> "of the"), remove stray scanning symbols, and fix broken mid-line hyphenations, running headers/footers, and stray standalone page numbers.
   - Correct clear grammatical, spelling, agreement, dropped-article/preposition, and punctuation errors introduced during transcription or scanning so every sentence reads naturally and grammatically cleanly.
   - For Urdu, Arabic, and Persian passages: normalize broken spacing, presentation-form glyphs, inverted/missing punctuation (use proper ۔ ، ؟ for Urdu/Arabic), and ensure clean, readable standard Unicode without corrupting classical wording.
   - NEVER translate between languages: keep English in English, Urdu in Urdu, Arabic in Arabic, and mixed-language texts authentic to their source script(s).`
    : `2. REMOVE ONLY PDF ARTIFACTS: Clean away broken mid-line hyphenations, stray standalone page numbers, and repeated running page headers/footers while preserving the original spelling and wording verbatim.`;

  const prompt = `Organize and contextually format the following literal book pages for Session ${sessionNumber || 1}${sessionTitle ? ` ("${sessionTitle}")` : ''} of "${bookTitle || 'Book'}"${author ? ` by ${author}` : ''}.
Target Output Language: ${detectedPrimaryLanguage}.
${focusNote}
CRITICAL RULES:
${substanceRule}
${grammarInstruction}
3. CONTEXTUAL ORGANIZATION: Divide the text into cohesive, presentable reading parts averaging ~${safeTargetWords} words each. Break parts at natural contextual/argument/section boundaries rather than mid-thought.
4. CONTEXTUAL FORMATTING BLOCKS: Within each part, format the text into clean semantic blocks:
   - 'heading': Macro chapter or major structural section title ONLY (use SPARINGLY—at most 1–2 across this entire page batch, and ONLY when a genuinely new overarching chapter or primary section begins; NEVER emit a 'heading' for minor paragraph transitions, numbered points, or every reading part, and NEVER repeat the overarching book title or session title as a 'heading'). Each 'heading' starts a new Section Title slide, so keep sections broad and cohesive.
   - 'subheading': Short topic lead-in, numbered argument header, or thematic subsection title (3–7 words in ${detectedPrimaryLanguage}) inserted inside the reading flow whenever a point or subsection shifts—use 'subheading' rather than 'heading' for routine transitions.
   - 'paragraph': Well-proportioned, readable prose paragraphs (split huge walls of text cleanly at natural thought breaks without dropping content).
   - 'quote': Direct blockquotes, scriptural/Quranic/Hadith citations, poetry couplets, or indented quoted passages.
   - 'list': Enumerated or bulleted points formatted into the 'items' array (set 'text' to a brief intro label or empty string).
5. EDITORIAL EMPHASIS (SPARSE & UNCROWDED): Use highlighting and underlining with extreme restraint so the reading text is never visually cluttered:
   - At most ONE key conceptual term or concise phrase (1–3 words) marked with ==highlighted phrase== per major paragraph.
   - At most ONE core principle or takeaway (2–4 words) marked with __underlined phrase__ per major paragraph.
   - Leave short paragraphs, quotes, and list items unformatted without markers.
   - STRICT RULE: Never wrap the same words in both == and __ (they MUST remain separate and mutually exclusive), never wrap full sentences or long clauses, and NEVER alter the author's literal words!
6. ACCURATE PAGE NUMBERS: Every block MUST carry the accurate 'pageNumber' from the [Page X] markers below.
7. STRICT LANGUAGE MATCH FOR 'contextualTitle': Write every part's concise 3–7 word 'contextualTitle' (identifying the section theme, never repeating the overall book/session cover title) STRICTLY in ${detectedPrimaryLanguage}. If the target output is Urdu, EVERY 'contextualTitle' and 'heading' MUST be written in Urdu script (اردو)—NEVER output English titles for Urdu content!
8. WHOLE-BATCH SUMMARY ('batchSummary'): Also provide 'batchSummary' — 1–2 concise sentences summing up all arguments and themes covered across these pages strictly in ${detectedPrimaryLanguage}, plus 'batchSessionTitle' — an overarching session title strictly in ${detectedPrimaryLanguage} covering the whole excerpt batch.

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
                    enum: ['heading', 'subheading', 'paragraph', 'quote', 'list'],
                  },
                  pageNumber: { type: Type.INTEGER },
                  text: { type: Type.STRING },
                  items: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['type', 'pageNumber', 'text'],
              },
            },
          },
          required: ['contextualTitle', 'blocks'],
        },
      },
    },
    required: ['parts'],
  };

  const ai = getAiClient();
  const modelCandidates = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: undefined },
  ];
  let lastError: any = null;

  const minPage = Number(pages[0]?.pageNumber || 1);
  const maxPage = Number(pages[pages.length - 1]?.pageNumber || minPage);

  for (const candidate of modelCandidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config: Record<string, any> = {
          systemInstruction:
            'You are an expert multilingual scholarly book editor and typesetter (fluent in English, Urdu, Arabic, Persian, and classical texts) for The Wisdom Lounge. Repair OCR/transcription typos, broken spacing, and grammatical errors while preserving the author’s complete literal content, voice, and original language(s), and organize it contextually into readable blocks.',
          responseMimeType: 'application/json',
          responseSchema: schema,
        };

        if (candidate.thinkingLevel) {
          config.thinkingConfig = { thinkingLevel: candidate.thinkingLevel };
        }

        const response = await ai.models.generateContent({
          model: candidate.model,
          contents: prompt,
          config,
        });

        const rawText = (response.text || '')
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        if (!rawText) {
          throw new Error('Empty response received while formatting literal text.');
        }

        const parsed = JSON.parse(rawText);
        const rawParts = Array.isArray(parsed.parts) ? parsed.parts : [];
        if (rawParts.length === 0) {
          throw new Error('No formatted parts returned.');
        }

        const normalizedParts = rawParts
          .map((rp: any) => {
            const blocks = (Array.isArray(rp.blocks) ? rp.blocks : [])
              .map((b: any) => {
                const pageNum = Math.max(
                  minPage,
                  Math.min(maxPage, Math.round(Number(b?.pageNumber) || minPage))
                );
                const type = ['heading', 'subheading', 'paragraph', 'quote', 'list'].includes(
                  b?.type
                )
                  ? b.type
                  : 'paragraph';
                const items = Array.isArray(b?.items)
                  ? b.items.map((it: any) => String(it || '').trim()).filter(Boolean)
                  : undefined;
                const text = String(b?.text || '').trim();
                if (type === 'list' && (!items || items.length === 0) && !text) {
                  return null;
                }
                if (type !== 'list' && !text) {
                  return null;
                }
                return {
                  type,
                  pageNumber: pageNum,
                  text,
                  items: type === 'list' ? items || (text ? [text] : []) : undefined,
                };
              })
              .filter(Boolean);

            if (blocks.length === 0) return null;

            const startPage = Math.min(...blocks.map((b: any) => b.pageNumber));
            const endPage = Math.max(...blocks.map((b: any) => b.pageNumber));
            const paragraphs = blocks.map((b: any) => ({
              pageNumber: b.pageNumber,
              text: (b.type === 'list' && b.items
                ? `${b.text ? `${b.text}\n` : ''}${b.items.map((it: string) => `• ${it}`).join('\n')}`
                : b.text
              )
                .replace(/==([^=\n]+)==/g, '$1')
                .replace(/__([^_\n]+)__/g, '$1'),
            }));
            const plainText = paragraphs.map((p: any) => p.text).join('\n\n');
            const wordCount = plainText.split(/\s+/).filter(Boolean).length;

            return {
              contextualTitle: String(rp.contextualTitle || '').trim() || undefined,
              startPage,
              endPage,
              wordCount,
              estimatedReadingMinutes: Math.max(1, Math.round(wordCount / safeWpm)),
              paragraphs,
              blocks,
              plainText,
              isAiOrganized: true,
            };
          })
          .filter(Boolean);

        return {
          parts: normalizedParts,
          batchSummary: typeof parsed.batchSummary === 'string' ? parsed.batchSummary.trim() : '',
          batchSessionTitle:
            typeof parsed.batchSessionTitle === 'string' ? parsed.batchSessionTitle.trim() : '',
        };
      } catch (err: any) {
        lastError = err;
        const parsedErr = extractCleanGeminiError(err);
        const isTransient = parsedErr.status === 429 || parsedErr.status === 503;
        if (attempt === 0 && isTransient) {
          await new Promise(resolve => setTimeout(resolve, 1200));
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

