import fetch from 'node-fetch';

interface JiraStoryDetails {
  summary: string;
  description?: string;
  acceptanceCriteria?: string;
  additionalInfo?: string;
  preRequisiteBlock?: string;
  preConditionBlock?: string;
  acceptanceCriteriaBlock?: string;
}

export class JiraClient {
  private baseUrl: string;
  private email: string;
  private apiToken: string;

  constructor() {
  this.baseUrl = process.env.JIRA_BASE_URL || 'https://vinothkannanbc.atlassian.net';
    this.email = process.env.JIRA_EMAIL || '';
    this.apiToken = process.env.JIRA_API_TOKEN || '';
    if (!this.baseUrl || !this.email || !this.apiToken) {
      throw new Error('JIRA credentials are not set in environment variables');
    }
  }

  async fetchStory(issueKeyOrUrl: string): Promise<JiraStoryDetails> {
    // Extract issue key if a URL is provided
    let issueKey = issueKeyOrUrl.trim();
    const match = issueKey.match(/[A-Z]+-\d+/);
    if (match) {
      issueKey = match[0];
    }

    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}`;
    const auth = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`JIRA API error: ${response.status} ${response.statusText}`);
    }

  const data = await response.json() as any;
  // Extract fields (customize as needed for your Jira instance)
  const summary = data.fields.summary || '';
  const description = data.fields.description?.content?.map((c: any) => c.content?.map((cc: any) => cc.text).join('')).join('\n') || '';
    // Parse Pre-requisite, Pre-condition, and Acceptance Criteria from description
    let acceptanceCriteria = '';
    let additionalInfo = '';
    let descOut = '';
    let preRequisiteBlock = '';
    let preConditionBlock = '';
    let acceptanceCriteriaBlock = '';
    if (description) {
  // Improved regex: capture header and all content (including blank lines) until next header or end
  const preReqBlockMatch = description.match(/Pre-?requisite[s]?:\s*([\s\S]*?)(?=^Pre-?condition[s]?:|^Acceptance Criteria:|\Z)/im);
  const preCondBlockMatch = description.match(/Pre-?condition[s]?:\s*([\s\S]*?)(?=^Acceptance Criteria:|\Z)/im);
  const acBlockMatch = description.match(/Acceptance Criteria:\s*([\s\S]*)/im);
  if (preReqBlockMatch) preRequisiteBlock = `Pre-requisite:\n\n${preReqBlockMatch[1].trim()}`;
  if (preCondBlockMatch) preConditionBlock = `Pre-condition:\n\n${preCondBlockMatch[1].trim()}`;
  if (acBlockMatch) acceptanceCriteriaBlock = `Acceptance Criteria:\n\n${acBlockMatch[1].trim()}`;
      // For legacy compatibility, also set descOut and acceptanceCriteria as before
      let descParts = [];
      if (preRequisiteBlock) descParts.push(preRequisiteBlock);
      if (preConditionBlock) descParts.push(preConditionBlock);
      descOut = descParts.join('\n\n');
      if (acceptanceCriteriaBlock) acceptanceCriteria = acceptanceCriteriaBlock;
    }
    // ...existing code...
    return {
      summary,
      description: descOut || description,
      acceptanceCriteria,
      additionalInfo,
      preRequisiteBlock,
      preConditionBlock,
      acceptanceCriteriaBlock,
    };
  }
}