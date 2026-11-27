import { BlcPlan, BlcSessionPlan } from '../types/blc';

export function formatCadenceLabel(plan: BlcPlan): string {
  switch (plan.config.cadence) {
    case 'weekly':
      return 'Weekly (1 session/week)';
    case 'twice_weekly':
      return 'Twice Weekly (2 sessions/week)';
    case 'biweekly':
      return 'Bi-Weekly (Every 2 weeks)';
    case 'custom':
    default:
      return `${plan.config.sessionsPerWeek} sessions/week`;
  }
}

export function formatBlcMarkdown(plan: BlcPlan): string {
  const avgMins = Math.round(
    plan.sessions.reduce((acc, s) => acc + s.estimatedReadingMinutes, 0) /
      Math.max(1, plan.sessions.length)
  );
  const avgPages = Math.round(plan.totalPages / Math.max(1, plan.sessions.length));

  const lines: string[] = [
    `# ${plan.circleName}`,
    `**Book:** ${plan.bookTitle}${plan.author ? ` by ${plan.author}` : ''}`,
    `**Schedule:** ${plan.sessions.length} Sessions · ${formatCadenceLabel(plan)} · ${plan.config.meetingDurationMinutes} min live meeting`,
    `**Reading Pace:** ~${avgMins} min reading (~${avgPages} pages) per session · ${plan.totalPages} total pages (${plan.totalWords.toLocaleString()} words)`,
    '',
    '## Circle Overview',
    plan.overallSummary,
    '',
  ];

  if (plan.learningArcOutcomes && plan.learningArcOutcomes.length > 0) {
    lines.push('### Key Learning Outcomes');
    plan.learningArcOutcomes.forEach(item => lines.push(`- ${item}`));
    lines.push('');
  }

  lines.push('## Full Reading Schedule');
  lines.push('| Session | Date | Pages | Chapters | Est. Read | Status |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  plan.sessions.forEach(s => {
    const status = s.completed ? 'Completed' : 'Upcoming';
    const dateStr = s.scheduledDate || `Session ${s.sessionNumber}`;
    lines.push(
      `| ${s.sessionNumber}. ${s.title} | ${dateStr} | pp. ${s.startPage}–${s.endPage} | ${s.chaptersCovered.join(', ')} | ${s.estimatedReadingMinutes} min | ${status} |`
    );
  });
  lines.push('');

  plan.sessions.forEach(session => {
    lines.push('---');
    lines.push('');
    lines.push(
      `## Session ${session.sessionNumber}: ${session.title}`
    );
    lines.push(
      `**Reading Assignment:** Pages ${session.startPage}–${session.endPage} (${session.chaptersCovered.join(', ')}) · ~${session.estimatedReadingMinutes} min read (${session.wordCount.toLocaleString()} words)${session.scheduledDate ? ` · Date: ${session.scheduledDate}` : ''}`
    );
    lines.push('');

    lines.push('### Topics & Key Extractions');
    session.topics.forEach(topic => {
      lines.push(`#### ${topic.topicTitle}`);
      lines.push(topic.summary);
      lines.push('');
      topic.keyExtractions.forEach(ex => lines.push(`- ${ex}`));
      if (topic.keyPassages && topic.keyPassages.length > 0) {
        lines.push('');
        topic.keyPassages.forEach(p => lines.push(`> "${p.quote}" (${p.pageRef})`));
      }
      lines.push('');
    });

    lines.push('### Pre-Session Preparation');
    lines.push(session.preSessionPrep.readingMindset);
    session.preSessionPrep.reflectionQuestions.forEach(q => lines.push(`- ${q}`));
    lines.push('');

    lines.push('### Facilitator Discussion Prompts');
    session.discussionPrompts.forEach(dp => {
      lines.push(`- **[${dp.category}]** ${dp.question}`);
      if (dp.facilitatorCue) {
        lines.push(`  *Facilitator cue: ${dp.facilitatorCue}*`);
      }
    });
    lines.push('');

    lines.push(`### Time-Boxed Agenda (${plan.config.meetingDurationMinutes} min)`);
    session.agenda.forEach(seg => {
      lines.push(`- **${seg.durationMinutes} min — ${seg.segmentTitle}:** ${seg.activityDescription}`);
    });

    if (session.facilitatorNotes?.trim()) {
      lines.push('');
      lines.push('### Facilitator Notes');
      lines.push(session.facilitatorNotes.trim());
    }
    lines.push('');
  });

  return lines.join('\n');
}

export function formatWhatsAppCircleInvite(plan: BlcPlan): string {
  const avgMins = Math.round(
    plan.sessions.reduce((acc, s) => acc + s.estimatedReadingMinutes, 0) /
      Math.max(1, plan.sessions.length)
  );
  const avgPages = Math.round(plan.totalPages / Math.max(1, plan.sessions.length));

  const lines: string[] = [
    `*The Wisdom Lounge — Book Learning Circle (BLC)*`,
    `*${plan.circleName}*`,
    `Book: *${plan.bookTitle}*${plan.author ? ` by ${plan.author}` : ''}`,
    ``,
    `Duration: ${plan.sessions.length} Sessions (${formatCadenceLabel(plan)})`,
    `Reading Pace: ~${avgMins} min (~${avgPages} pages) per session`,
    `Meeting Length: ${plan.config.meetingDurationMinutes} minutes per session`,
    ``,
    `${plan.overallSummary}`,
    ``,
    `*Reading Roadmap:*`,
  ];

  plan.sessions.forEach(s => {
    const datePart = s.scheduledDate ? ` (${s.scheduledDate})` : '';
    lines.push(
      `• *Session ${s.sessionNumber}${datePart}:* ${s.title} — pp. ${s.startPage}–${s.endPage} (~${s.estimatedReadingMinutes} min)`
    );
  });

  lines.push('');
  lines.push('Reply if you would like to join this circle.');

  return lines.join('\n');
}

export function formatWhatsAppSessionReminder(plan: BlcPlan, session: BlcSessionPlan): string {
  const lines: string[] = [
    `*The Wisdom Lounge — ${plan.circleName}*`,
    `*Session ${session.sessionNumber}: ${session.title}*`,
    session.scheduledDate ? `Date: ${session.scheduledDate}` : '',
    `Reading Assignment: *Pages ${session.startPage}–${session.endPage}* (~${session.estimatedReadingMinutes} min read)`,
    `Chapters: ${session.chaptersCovered.join(', ')}`,
    ``,
    `*Topics We Will Cover:*`,
    ...session.topics.map(t => `• ${t.topicTitle}`),
    ``,
    `*Pre-Session Reflection:*`,
    session.preSessionPrep.readingMindset,
    ...session.preSessionPrep.reflectionQuestions.map(q => `- ${q}`),
    ``,
    `*Meeting Agenda (${plan.config.meetingDurationMinutes} min):*`,
    ...session.agenda.map(a => `• ${a.durationMinutes}m: ${a.segmentTitle}`),
  ].filter(Boolean);

  return lines.join('\n');
}
