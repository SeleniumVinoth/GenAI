import { useState } from 'react';
import { generateTests, fetchJiraStory } from './api';
import { GenerateRequest, GenerateResponse, TestCase } from './types';

function getRandomValue(type: string) {
  switch (type) {
    case 'string':
      return Math.random().toString(36).substring(2, 10);
    case 'number':
      return Math.floor(Math.random() * 1000);
    case 'email':
      return `user${Math.floor(Math.random() * 10000)}@example.com`;
    case 'date':
      return new Date(Date.now() - Math.floor(Math.random() * 1e10)).toISOString().split('T')[0];
    case 'bool':
      return Math.random() > 0.5 ? 'Yes' : 'No';
    default:
      return Math.random().toString(36).substring(2, 8);
  }
}

function generateMockarooTestData(testCase: TestCase) {
  // Generate a random test data string for each test case
  // You can enhance this logic to be more field-aware if needed
  return `Name: ${getRandomValue('string')}, Amount: ${getRandomValue('number')}, Email: ${getRandomValue('email')}, Date: ${getRandomValue('date')}, Flag: ${getRandomValue('bool')}`;
}

function App() {
  const [activeTab, setActiveTab] = useState<'userStory' | 'testData'>('userStory');
  const [formData, setFormData] = useState<GenerateRequest>({
    storyTitle: '',
    acceptanceCriteria: '',
    description: '',
    additionalInfo: '',
    testCategory: []
  });
  const [results, setResults] = useState<GenerateResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTestCases, setExpandedTestCases] = useState<Set<string>>(new Set());
  // Jira fetch UI state
  const [jiraInput, setJiraInput] = useState('');
  const [jiraLoading, setJiraLoading] = useState(false);
  const [jiraError, setJiraError] = useState<string | null>(null);
  const [jiraSuccess, setJiraSuccess] = useState<string | null>(null);
  // Test Data Generator state
  const [testDataError, setTestDataError] = useState<string | null>(null);
  const [testDataRows, setTestDataRows] = useState<Array<{ testCase: TestCase; testData: string }>>([]);

  const toggleTestCaseExpansion = (testCaseId: string) => {
    const newExpanded = new Set(expandedTestCases);
    if (newExpanded.has(testCaseId)) {
      newExpanded.delete(testCaseId);
    } else {
      newExpanded.add(testCaseId);
    }
    setExpandedTestCases(newExpanded);
  };

  const handleInputChange = (field: keyof GenerateRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCategoryChange = (category: string) => {
    setFormData(prev => {
      const current = prev.testCategory || [];
      if (current.includes(category)) {
        return { ...prev, testCategory: current.filter((c: string) => c !== category) };
      } else {
        return { ...prev, testCategory: [...current, category] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.storyTitle.trim() || !formData.acceptanceCriteria.trim()) {
      setError('Story Title and Acceptance Criteria are required');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await generateTests(formData);
      setResults(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tests');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch from Jira and autofill form
  const handleJiraFetch = async () => {
    setJiraError(null);
    setJiraSuccess(null);
    setJiraLoading(true);
    try {
      const data = await fetchJiraStory(jiraInput);
      // Compose description from preRequisiteBlock and preConditionBlock if available
      let description = '';
      if (data.preRequisiteBlock || data.preConditionBlock) {
        description = [data.preRequisiteBlock, data.preConditionBlock].filter(Boolean).join('\n\n');
      } else {
        description = data.description || '';
      }
      // Use acceptanceCriteriaBlock for Acceptance Criteria if available
      const acceptanceCriteria = data.acceptanceCriteriaBlock || data.acceptanceCriteria || '';
      setFormData(prev => ({
        ...prev,
        storyTitle: data.summary || '',
        description,
        acceptanceCriteria,
        additionalInfo: data.additionalInfo || '',
      }));
      setJiraSuccess('Fetched and autofilled from Jira successfully.');
    } catch (err: any) {
      setJiraError(err.message || 'Failed to fetch from Jira.');
    } finally {
      setJiraLoading(false);
    }
  };

  // Test Data Generator logic
  const handleGenerateTestData = () => {
    setTestDataError(null);
    if (!results || !results.cases || results.cases.length === 0) {
      setTestDataError('Please generate test cases in the "User Story to Tests" tab first.');
      setTestDataRows([]);
      return;
    }
    const rows = results.cases.map(tc => ({
      testCase: tc,
      testData: generateMockarooTestData(tc)
    }));
    setTestDataRows(rows);
  };

  return (
    <div>
      <style>{`
        .tab-bar {
          display: flex;
          justify-content: center;
          margin-bottom: 30px;
          gap: 20px;
        }
        .tab-btn {
          background: #fff;
          border: 2px solid #3498db;
          color: #3498db;
          font-weight: 600;
          font-size: 1.1rem;
          border-radius: 8px 8px 0 0;
          padding: 12px 32px;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .tab-btn.active {
          background: #3498db;
          color: #fff;
          border-bottom: 2px solid #fff;
        }
        .tab-content {
          animation: fadeIn 0.4s;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: none; }
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          background-color: #f5f5f5;
          color: #333;
          line-height: 1.6;
        }
        
        .container {
          max-width: 95%;
          width: 100%;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
        }
        
        @media (min-width: 768px) {
          .container {
            max-width: 90%;
            padding: 30px;
          }
        }
        
        @media (min-width: 1024px) {
          .container {
            max-width: 85%;
            padding: 40px;
          }
        }
        
        @media (min-width: 1440px) {
          .container {
            max-width: 1800px;
            padding: 50px;
          }
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .title {
          font-size: 2.5rem;
          color: #2c3e50;
          margin-bottom: 10px;
        }
        
        .subtitle {
          color: #666;
          font-size: 1.1rem;
        }
        
        .form-container {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          color: #2c3e50;
        }
        
        .form-input, .form-textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #e1e8ed;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        
        .form-input:focus, .form-textarea:focus {
          outline: none;
          border-color: #3498db;
        }
        
        .form-textarea {
          resize: vertical;
          min-height: 100px;
        }
        
        .submit-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .submit-btn:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .submit-btn:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }
        
        .error-banner {
          background: #e74c3c;
          color: white;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
          font-size: 18px;
        }
        
        .results-container {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .results-header {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e1e8ed;
        }
        
        .results-title {
          font-size: 1.8rem;
          color: #2c3e50;
          margin-bottom: 10px;
        }
        
        .results-meta {
          color: #666;
          font-size: 14px;
        }
        
        .table-container {
          overflow-x: auto;
        }
        
        .results-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        
        .results-table th,
        .results-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e1e8ed;
        }
        
        .results-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #2c3e50;
        }
        
        .results-table tr:hover {
          background: #f8f9fa;
        }
        
        .category-positive { color: #27ae60; font-weight: 600; }
        .category-negative { color: #e74c3c; font-weight: 600; }
        .category-edge { color: #f39c12; font-weight: 600; }
        .category-authorization { color: #9b59b6; font-weight: 600; }
        .category-non-functional { color: #34495e; font-weight: 600; }
        
        .test-case-id {
          cursor: pointer;
          color: #3498db;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 4px;
          transition: background-color 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        
        .test-case-id:hover {
          background: #f8f9fa;
        }
        
        .test-case-id.expanded {
          background: #e3f2fd;
          color: #1976d2;
        }
        
        .expand-icon {
          font-size: 10px;
          transition: transform 0.2s;
        }
        
        .expand-icon.expanded {
          transform: rotate(90deg);
        }
        
        .expanded-details {
          margin-top: 15px;
          background: #fafbfc;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          padding: 20px;
        }
        
        .step-item {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .step-header {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 1fr;
          gap: 15px;
          align-items: start;
        }
        
        .step-id {
          font-weight: 600;
          color: #2c3e50;
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 4px;
          text-align: center;
          font-size: 12px;
        }
        
        .step-description {
          color: #2c3e50;
          line-height: 1.5;
        }
        
        .step-test-data {
          color: #666;
          font-style: italic;
          font-size: 14px;
        }
        
        .step-expected {
          color: #27ae60;
          font-weight: 500;
          font-size: 14px;
        }
        
        .step-labels {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 10px;
          font-weight: 600;
          color: #666;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
      
      <div className="container">
        <div className="tab-bar">
          <button className={`tab-btn${activeTab === 'userStory' ? ' active' : ''}`} onClick={() => setActiveTab('userStory')}>User Story to Tests</button>
          <button className={`tab-btn${activeTab === 'testData' ? ' active' : ''}`} onClick={() => setActiveTab('testData')}>Test Data Generator</button>
        </div>
        <div className="tab-content">
          {activeTab === 'userStory' && (
            <>
              <div className="header">
                <h1 className="title">User Story to Tests</h1>
                <p className="subtitle">Generate comprehensive test cases from your user stories</p>
              </div>
              {/* ...existing form and results UI... */}
              <form onSubmit={handleSubmit} className="form-container">
                {/* ...existing form fields... */}
                <div className="form-group">
                  <label htmlFor="jiraStory" className="form-label">Fetch User Story from Jira</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: 8 }}>
                    <input type="text" id="jiraStory" name="jiraStory" className="form-input" placeholder="Enter Jira issue key or URL..." autoComplete="off" value={jiraInput} onChange={e => setJiraInput(e.target.value)} disabled={jiraLoading} style={{ flex: 1 }} />
                    <button type="button" className="submit-btn" style={{ minWidth: 80 }} onClick={handleJiraFetch} disabled={jiraLoading || !jiraInput.trim()}>{jiraLoading ? 'Fetching...' : 'Fetch'}</button>
                  </div>
                  <div style={{ minHeight: 22 }}>
                    {jiraError && <span style={{ color: '#e74c3c', fontSize: 13 }}>{jiraError}</span>}
                    {jiraSuccess && <span style={{ color: '#27ae60', fontSize: 13 }}>{jiraSuccess}</span>}
                    {!jiraError && !jiraSuccess && (<span style={{ color: '#888', fontSize: 13 }}>Enter a Jira issue key (e.g., ABC-123) or full URL and click Fetch.</span>)}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="storyTitle" className="form-label">Story Title *</label>
                  <input type="text" id="storyTitle" className="form-input" value={formData.storyTitle} onChange={(e) => handleInputChange('storyTitle', e.target.value)} placeholder="Enter the user story title..." required />
                </div>
                <div className="form-group">
                  <label htmlFor="description" className="form-label">Description</label>
                  <textarea id="description" className="form-textarea" value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="Additional description (optional)..." />
                </div>
                <div className="form-group">
                  <label htmlFor="acceptanceCriteria" className="form-label">Acceptance Criteria *</label>
                  <textarea id="acceptanceCriteria" className="form-textarea" value={formData.acceptanceCriteria} onChange={(e) => handleInputChange('acceptanceCriteria', e.target.value)} placeholder="Enter the acceptance criteria..." required />
                </div>
                <div className="form-group">
                  <label htmlFor="additionalInfo" className="form-label">Additional Info</label>
                  <textarea id="additionalInfo" className="form-textarea" value={formData.additionalInfo} onChange={(e) => handleInputChange('additionalInfo', e.target.value)} placeholder="Any additional information (optional)..." />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: 4 }}>Test Category <span style={{color:'#e74c3c'}}>*</span></label>
                  <div style={{ fontSize: '13px', color: '#888', marginBottom: 8 }}>Select one or more categories to generate tests for:</div>
                  <div className="category-checkbox-group" style={{ display: 'flex', flexDirection: 'row', gap: '18px', marginBottom: 8 }}>
                    {[
                      { label: 'Positive', color: '#27ae60', icon: '✔️' },
                      { label: 'Negative', color: '#e74c3c', icon: '❌' },
                      { label: 'Edge', color: '#f39c12', icon: '🧪' },
                      { label: 'Authorization', color: '#9b59b6', icon: '🔒' },
                      { label: 'Non-Functional', color: '#34495e', icon: '⚙️' }
                    ].map(option => (
                      <label key={option.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, background: formData.testCategory.includes(option.label) ? option.color + '22' : '#f8f9fa', border: `2px solid ${formData.testCategory.includes(option.label) ? option.color : '#e1e8ed'}`, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', transition: 'background 0.2s, border 0.2s', color: formData.testCategory.includes(option.label) ? option.color : '#2c3e50', boxShadow: formData.testCategory.includes(option.label) ? '0 2px 8px 0 #0001' : 'none' }}>
                        <input type="checkbox" value={option.label} checked={formData.testCategory.includes(option.label)} onChange={() => handleCategoryChange(option.label)} style={{ accentColor: option.color, width: 18, height: 18 }} />
                        <span style={{ fontSize: 18 }}>{option.icon}</span>
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" className="submit-btn" disabled={isLoading}>{isLoading ? 'Generating...' : 'Generate'}</button>
              </form>
              {error && (<div className="error-banner">{error}</div>)}
              {isLoading && (<div className="loading">Generating test cases...</div>)}
              {results && (
                <div className="results-container">
                  <div className="results-header">
                    <h2 className="results-title">Generated Test Cases</h2>
                    <div className="results-meta">
                      {results.cases.length} test case(s) generated
                      {results.model && ` • Model: ${results.model}`}
                      {results.promptTokens > 0 && ` • Tokens: ${results.promptTokens + results.completionTokens}`}
                    </div>
                  </div>
                  <div className="table-container">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Test Case ID</th>
                          <th>Title</th>
                          <th>Category</th>
                          <th>Expected Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.cases.map((testCase: TestCase) => (
                          <>
                            <tr key={testCase.id}>
                              <td>
                                <div className={`test-case-id ${expandedTestCases.has(testCase.id) ? 'expanded' : ''}`} onClick={() => toggleTestCaseExpansion(testCase.id)}>
                                  <span className={`expand-icon ${expandedTestCases.has(testCase.id) ? 'expanded' : ''}`}>▶</span>
                                  {testCase.id}
                                </div>
                              </td>
                              <td>{testCase.title}</td>
                              <td><span className={`category-${testCase.category.toLowerCase()}`}>{testCase.category}</span></td>
                              <td>{testCase.expectedResult}</td>
                            </tr>
                            {expandedTestCases.has(testCase.id) && (
                              <tr key={`${testCase.id}-details`}>
                                <td colSpan={4}>
                                  <div className="expanded-details">
                                    <h4 style={{marginBottom: '15px', color: '#2c3e50'}}>Test Steps for {testCase.id}</h4>
                                    <div className="step-labels">
                                      <div>Step ID</div>
                                      <div>Step Description</div>
                                      <div>Test Data</div>
                                      <div>Expected Result</div>
                                    </div>
                                    {testCase.steps.map((step, index) => (
                                      <div key={index} className="step-item">
                                        <div className="step-header">
                                          <div className="step-id">S{String(index + 1).padStart(2, '0')}</div>
                                          <div className="step-description">{step}</div>
                                          <div className="step-test-data">{testCase.testData || 'N/A'}</div>
                                          <div className="step-expected">{index === testCase.steps.length - 1 ? testCase.expectedResult : 'Step completed successfully'}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
          {activeTab === 'testData' && (
            <div className="form-container">
              <h2 className="title" style={{ color: '#9b59b6', fontSize: '2rem', marginBottom: 18 }}>Test Data Generator</h2>
              <p className="subtitle" style={{ color: '#555', marginBottom: 24 }}>Generate random test data for your test cases (powered by Mockaroo-style logic).</p>
              <button className="submit-btn" style={{ background: '#9b59b6', marginBottom: 18 }} onClick={handleGenerateTestData}>Generate Test Data</button>
              {testDataError && <div className="error-banner">{testDataError}</div>}
              {testDataRows.length > 0 && (
                <div className="results-container" style={{ marginTop: 0 }}>
                  <div className="results-header">
                    <h3 className="results-title" style={{ color: '#9b59b6' }}>Test Data Table</h3>
                  </div>
                  <div className="table-container">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Test Case ID</th>
                          <th>Title</th>
                          <th>Category</th>
                          <th>Random Test Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testDataRows.map(({ testCase, testData }) => (
                          <tr key={testCase.id}>
                            <td>{testCase.id}</td>
                            <td>{testCase.title}</td>
                            <td><span className={`category-${testCase.category.toLowerCase()}`}>{testCase.category}</span></td>
                            <td style={{ color: '#1976d2', fontWeight: 500 }}>{testData}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App