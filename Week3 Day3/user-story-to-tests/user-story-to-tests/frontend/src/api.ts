// Fetch story details from Jira by key or URL
export async function fetchJiraStory(jiraKeyOrUrl: string): Promise<{
  summary: string;
  description?: string;
  acceptanceCriteria?: string;
  additionalInfo?: string;
  preRequisiteBlock?: string;
  preConditionBlock?: string;
  acceptanceCriteriaBlock?: string;
}> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api';
  const response = await fetch(`${API_BASE_URL}/jira-story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jiraKeyOrUrl }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}
import { GenerateRequest, GenerateResponse } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api'

export async function generateTests(request: GenerateRequest): Promise<GenerateResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-tests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data: GenerateResponse = await response.json()
    return data
  } catch (error) {
    console.error('Error generating tests:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}