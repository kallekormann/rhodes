export function librarySummaryPrompt(excerpt: string): string {
  return `Summarize the following document excerpt in 2-3 sentences for a knowledge library index. Focus on what the document is about and who would use it.

Document excerpt:
${excerpt}

Summary:`;
}
