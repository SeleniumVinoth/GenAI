import express from 'express';
import { JiraClient } from '../jiraClient';

export const jiraRouter = express.Router();

jiraRouter.post('/', async (req, res) => {
  const { jiraKeyOrUrl } = req.body;
  if (!jiraKeyOrUrl || typeof jiraKeyOrUrl !== 'string') {
    return res.status(400).json({ error: 'jiraKeyOrUrl is required' });
  }
  try {
    const client = new JiraClient();
    const details = await client.fetchStory(jiraKeyOrUrl);
    res.json(details);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch from JIRA' });
  }
});
