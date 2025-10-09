import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  Grid,
  Tabs,
  Tab,
  Divider,
  Alert,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Chip,

} from '@mui/material';
import {
  Schema as SchemaIcon,
  Code as CodeIcon,
  Save as SaveIcon,
  Refresh as ResetIcon,
  PlayArrow as TestIcon,
  ContentCopy as CopyIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Description as TemplateIcon,
  CompareArrows as CompareIcon,
  Psychology as AiIcon,
  Search as SearchIcon
} from '@mui/icons-material';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
      {value === index && children}
    </div>
  );
}

const DEFAULT_JSON_SCHEMA = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Healthcare Test Case",
  "type": "object",
  "properties": {
    "testCaseId": {
      "type": "string",
      "description": "Unique identifier for the test case, e.g., TC_001"
    },
    "module": {
      "type": "string",
      "description": "Functional module name, e.g., Patient Registration"
    },
    "testCaseTitle": {
      "type": "string",
      "description": "Concise title describing what is being tested"
    },
    "testCaseDescription": {
      "type": "string",
      "description": "Detailed narrative explaining the purpose and flow of the test"
    },
    "testSteps": {
      "type": "array",
      "description": "Step-by-step instructions for executing the test",
      "items": {
        "type": "string"
      }
    },
    "expectedResults": {
      "type": "string",
      "description": "Expected system behavior after test execution"
    },
    "priority": {
      "type": "string",
      "enum": ["Low", "Medium", "High", "Critical"]
    },
    "createdDate": {
      "type": "string",
      "format": "date",
      "description": "Date when the test case was first created"
    },
    "modifiedDate": {
      "type": "string",
      "format": "date",
      "description": "Date when the test case was last modified"
    },
    "author": {
      "type": "string",
      "description": "Author or QA engineer who created or updated the test"
    },
    "version": {
      "type": "string",
      "description": "Version of the test case document"
    },
    "relatedUserStories": {
      "type": "array",
      "description": "IDs of related user stories in the user story collection",
      "items": {
        "type": "string"
      }
    },
    "metadata": {
      "type": "object",
      "description": "Additional tags for hybrid search filtering",
      "properties": {
        "module": { "type": "string" },
        "priority": { "type": "string" },
        "environment": { "type": "string" },
        "automationStatus": { "type": "boolean" }
      }
    }
  },
  "required": [
    "testCaseId",
    "testCaseTitle",
    "testSteps",
    "expectedResults"
  ]
}`;

const DEFAULT_PROMPT_TEMPLATE = `You are a QA AI assistant trained on healthcare domain test cases.

Your task is to retrieve, summarize, and reason over test cases from a MongoDB vector database.
You will receive:
1. A user story or query.
2. A list of retrieved test cases (JSON format).
3. Optional metadata (module, priority, author, etc.).

Follow these steps carefully:

1. **Understand Context**
   - Read the user story or query.
   - Identify module or functionality keywords (e.g., "Billing", "Login", "Prescription").

2. **Analyze Retrieved Test Cases**
   - Use the field \`testCaseTitle\` and \`testCaseDescription\` to understand intent.
   - Review the \`testSteps\` and \`expectedResults\` for relevance.
   - Consider metadata like \`priority\`, \`version\`, and \`relatedUserStories\`.

3. **Generate Summarized Response**
   - Summarize top 5 relevant test cases into concise bullet points.
   - Include Test Case ID, Title, and Expected Outcome.
   - If there are duplicates or overlapping test cases, merge them logically.
   - Highlight any missing scenarios based on the user story.

4. **Final Output Format**
   - Use JSON response following the schema below.

### Example Input:

User Story:
"Verify OTP authentication during patient login for mobile and email."

Retrieved Test Cases (sample JSON):
[
  {
    "testCaseId": "TC_101",
    "testCaseTitle": "Patient login with valid OTP",
    "testCaseDescription": "Verify that patient can login with a valid one-time password sent to mobile.",
    "testSteps": ["Navigate to login", "Enter OTP", "Click Submit"],
    "expectedResults": "Patient is successfully logged in.",
    "module": "Authentication",
    "priority": "High"
  }
]

### Expected Output (JSON):
{
  "query": "Verify OTP authentication during patient login",
  "summary": "3 relevant test cases identified. All belong to Authentication module, covering valid, invalid, and expired OTP scenarios.",
  "recommendations": [
    {
      "testCaseId": "TC_101",
      "testCaseTitle": "Patient login with valid OTP",
      "summary": "Valid OTP allows login successfully.",
      "priority": "High"
    },
    {
      "testCaseId": "TC_102",
      "testCaseTitle": "Patient login with expired OTP",
      "summary": "System should reject expired OTPs and show proper message.",
      "priority": "Medium"
    }
  ],
  "gaps": ["Add scenario for OTP retry attempts"]
}`;

const EXAMPLE_TEST_QUERY = `Module: Patient Communication & Diagnostics
User Story Title: Share Diagnostic Reports with Patients via WhatsApp

User Story Description:
As a diagnostic technician, I want to automatically send patients their lab test reports securely through WhatsApp once results are validated, so that patients can access their diagnostic data conveniently without logging into the hospital portal.`;

const EXAMPLE_TEST_CASES = `[
  {
    "testCaseId": "TC_101",
    "module": "Authentication",
    "testCaseTitle": "Patient login with valid OTP",
    "testCaseDescription": "Verify that patient can login with a valid one-time password sent to mobile.",
    "testSteps": [
      "Navigate to patient login page",
      "Enter registered mobile number",
      "Request OTP",
      "Enter valid OTP received",
      "Click Submit button"
    ],
    "expectedResults": "Patient is successfully logged in and redirected to dashboard.",
    "priority": "High"
  },
  {
    "testCaseId": "TC_102",
    "module": "Authentication",
    "testCaseTitle": "Patient login with expired OTP",
    "testCaseDescription": "Verify system behavior when patient enters expired OTP.",
    "testSteps": [
      "Navigate to patient login page",
      "Request OTP",
      "Wait for OTP to expire (>5 minutes)",
      "Enter expired OTP",
      "Click Submit"
    ],
    "expectedResults": "System shows 'OTP expired' error message and prompts to resend.",
    "priority": "Medium"
  }
]`;

function PromptSchemaManager() {
  const [tabValue, setTabValue] = useState(0);
  const [jsonSchema, setJsonSchema] = useState(DEFAULT_JSON_SCHEMA);
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT_TEMPLATE);
  const [schemaValid, setSchemaValid] = useState(true);
  const [schemaError, setSchemaError] = useState(null);
  const [testQuery, setTestQuery] = useState(EXAMPLE_TEST_QUERY);
  const [testCases, setTestCases] = useState(EXAMPLE_TEST_CASES);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // RAG comparison states
  const [ragResult, setRagResult] = useState(null);
  const [ragTesting, setRagTesting] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  
  // LLM + RAG Context states
  const [llmRagResult, setLlmRagResult] = useState(null);
  const [llmRagTesting, setLlmRagTesting] = useState(false);
  
  // Quality comparison states
  const [showQualityComparison, setShowQualityComparison] = useState(false);

  // Validate JSON Schema
  const validateSchema = (schemaText) => {
    try {
      JSON.parse(schemaText);
      setSchemaValid(true);
      setSchemaError(null);
      return true;
    } catch (error) {
      setSchemaValid(false);
      setSchemaError(error.message);
      return false;
    }
  };

  // Handle schema change
  const handleSchemaChange = (e) => {
    const value = e.target.value;
    setJsonSchema(value);
    validateSchema(value);
  };

  // Reset to default
  const handleReset = (type) => {
    if (type === 'schema') {
      setJsonSchema(DEFAULT_JSON_SCHEMA);
      validateSchema(DEFAULT_JSON_SCHEMA);
    } else {
      setPromptTemplate(DEFAULT_PROMPT_TEMPLATE);
    }
  };

  // Copy to clipboard
  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    alert(`${type} copied to clipboard!`);
  };

  // Save configuration
  const handleSave = async () => {
    if (!validateSchema(jsonSchema)) {
      alert('Please fix JSON Schema errors before saving');
      return;
    }

    try {
      const config = {
        jsonSchema: JSON.parse(jsonSchema),
        promptTemplate: promptTemplate,
        updatedAt: new Date().toISOString()
      };

      // Save to localStorage for now
      localStorage.setItem('promptSchemaConfig', JSON.stringify(config));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      alert('Configuration saved successfully!');
    } catch (error) {
      alert('Error saving configuration: ' + error.message);
    }
  };

  // Test prompt with AI
  const handleTest = async () => {
    if (!validateSchema(jsonSchema)) {
      alert('Please fix JSON Schema errors before testing');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Parse test cases
      const parsedTestCases = JSON.parse(testCases);

      // Create the full prompt
      const fullPrompt = `${promptTemplate}

### Current Query:
${testQuery}

### Retrieved Test Cases:
${JSON.stringify(parsedTestCases, null, 2)}

### JSON Schema to follow:
${jsonSchema}

Please provide your response in the expected JSON format.`;

      // Call OpenAI API
      const response = await fetch('http://localhost:3001/api/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          temperature: 0.7,
          maxTokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({
        error: true,
        message: error.message
      });
    } finally {
      setTesting(false);
    }
  };

  // Test RAG (direct summarization from search results)
  const handleRagTest = async () => {
    setRagTesting(true);
    setRagResult(null);

    try {
      // Parse test cases
      const parsedTestCases = JSON.parse(testCases);

      // Call the standard summarization endpoint (RAG approach)
      const response = await fetch('http://localhost:3001/api/search/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: parsedTestCases,
          summaryType: 'detailed'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setRagResult(data);
      // Don't auto-show comparison, let user click the button
      // setShowComparison(true);
    } catch (error) {
      setRagResult({
        error: true,
        message: error.message
      });
    } finally {
      setRagTesting(false);
    }
  };

  // Complete RAG Workflow: Preprocess → Search → Deduplicate → Summarize → Generate
  const handleLlmRagTest = async () => {
    setLlmRagTesting(true);
    setLlmRagResult(null);

    try {
      // Step 0: Query Preprocessing
      console.log('Step 0: Preprocessing query...');
      const preprocessResponse = await fetch('http://localhost:3001/api/preprocess-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: testQuery
        })
      });

      let finalQuery = testQuery;
      let preprocessingData = null;
      
      if (preprocessResponse.ok) {
        preprocessingData = await preprocessResponse.json();
        finalQuery = preprocessingData.processedQuery || testQuery;
        console.log('Query preprocessed:', finalQuery);
      } else {
        console.log('Preprocessing failed, using original query');
      }

      // Step 1: Search using hybrid search with preprocessed query
      console.log('Step 1: Searching with hybrid search...');
      const searchResponse = await fetch('http://localhost:3001/api/search/hybrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: finalQuery,
          limit: 20
        })
      });

      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      console.log('Search results:', searchData.results?.length, 'items');

      // Step 2: Deduplicate search results
      console.log('Step 2: Deduplicating search results...');
      let dedupData = null;
      let finalResults = searchData.results || [];
      
      if (finalResults.length > 5) {
        const dedupResponse = await fetch('http://localhost:3001/api/search/deduplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            results: finalResults,
            threshold: 0.85
          })
        });

        if (dedupResponse.ok) {
          dedupData = await dedupResponse.json();
          finalResults = dedupData.deduplicated || finalResults;
          console.log('Deduplication completed:', finalResults.length, 'unique results');
        }
      }

      // Step 3: Take top 10 results for summarization
      const topResults = finalResults.slice(0, 10);
      
      if (topResults.length === 0) {
        throw new Error('No search results found for the user story');
      }

      // Step 4: Get comprehensive RAG summary of search results
      console.log('Step 4: Getting comprehensive RAG summary...');
      const summarizeResponse = await fetch('http://localhost:3001/api/search/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: topResults,
          summaryType: 'detailed'
        })
      });

      if (!summarizeResponse.ok) {
        throw new Error(`Summarization failed: ${summarizeResponse.status}`);
      }

      const summaryData = await summarizeResponse.json();
      console.log('Comprehensive RAG Summary generated');

      // Step 5: Enhanced prompt with comprehensive context
      const fullPrompt = `${promptTemplate}

### CURRENT USER STORY FOR NEW TEST GENERATION:
${testQuery}
${preprocessingData ? `\n### QUERY PREPROCESSING ANALYSIS:\nOriginal: ${testQuery}\nProcessed: ${finalQuery}\nTransformations: ${JSON.stringify(preprocessingData.transformations || {})}` : ''}

### COMPREHENSIVE RAG ANALYSIS OF EXISTING TEST CASES:
${summaryData.summary}

### EXISTING TEST CASES DETAILS (Top 10 Retrieved):
${JSON.stringify(topResults, null, 2)}

### JSON SCHEMA FOR OUTPUT:
${jsonSchema}

### ADDITIONAL REQUIREMENTS:
1. Analyze the gaps identified in the RAG summary
2. Generate HIGH-QUALITY test cases that complement existing coverage
3. Focus on edge cases, integration scenarios, and regulatory compliance
4. Include detailed test steps and comprehensive expected results
5. Ensure test cases are specific to healthcare domain
6. Address security, performance, and usability aspects
7. Consider different user personas (patients, doctors, technicians)

### OUTPUT REQUIREMENT:
Provide a comprehensive JSON response with:
1. Analysis of existing coverage
2. Identified gaps
3. NEW test cases (5-8 high-quality cases)
4. Rationale for each new test case
5. Priority and risk assessment`;

      // Step 6: Generate with enhanced context
      console.log('Step 6: Generating high-quality test cases...');
      const generateResponse = await fetch('http://localhost:3001/api/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          temperature: 0.6, // Lower temperature for more focused output
          maxTokens: 3000   // More tokens for detailed output
        })
      });

      if (!generateResponse.ok) {
        throw new Error(`Generation failed: ${generateResponse.status}`);
      }

      const generatedData = await generateResponse.json();
      
      // Combine all the data for comprehensive display
      setLlmRagResult({
        ...generatedData,
        // Pipeline data
        preprocessingData: preprocessingData,
        originalQuery: testQuery,
        processedQuery: finalQuery,
        dedupData: dedupData,
        // Existing test cases data
        existingTestCases: topResults,
        searchResults: searchData.results?.length || 0,
        topResults: topResults.length,
        // RAG analysis data
        ragSummary: summaryData.summary,
        ragTokens: summaryData.tokens,
        ragCost: summaryData.cost,
        // Workflow metadata
        workflow: 'preprocess → search → deduplicate → summarize → generate',
        timestamp: new Date().toISOString()
      });

      console.log('Enhanced RAG workflow completed');
    } catch (error) {
      console.error('RAG workflow error:', error);
      setLlmRagResult({
        error: true,
        message: error.message
      });
    } finally {
      setLlmRagTesting(false);
    }
  };



  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TemplateIcon color="primary" />
          Prompt Template & JSON Schema Manager
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure and test AI prompt templates and JSON schemas for healthcare test cases
        </Typography>
      </Box>

      {/* Save Indicator */}
      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Configuration saved successfully!
        </Alert>
      )}

      {/* Main Tabs */}
      <Paper elevation={2}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab icon={<SchemaIcon />} label="JSON Schema" />
          <Tab icon={<CodeIcon />} label="Prompt Template" />
          <Tab icon={<TestIcon />} label="Test & Preview" />
        </Tabs>
        <Divider />

        {/* Tab 0: JSON Schema */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">JSON Schema Configuration</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Reset to default">
                  <IconButton size="small" onClick={() => handleReset('schema')}>
                    <ResetIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy schema">
                  <IconButton size="small" onClick={() => handleCopy(jsonSchema, 'Schema')}>
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
                {schemaValid ? (
                  <Chip icon={<ValidIcon />} label="Valid" color="success" size="small" />
                ) : (
                  <Chip icon={<ErrorIcon />} label="Invalid" color="error" size="small" />
                )}
              </Box>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={25}
              value={jsonSchema}
              onChange={handleSchemaChange}
              variant="outlined"
              error={!schemaValid}
              helperText={schemaError}
              sx={{ 
                fontFamily: 'monospace',
                '& textarea': { fontFamily: 'monospace', fontSize: '0.875rem' }
              }}
            />

            {schemaError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>JSON Error:</strong> {schemaError}
                </Typography>
              </Alert>
            )}

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                This schema defines the structure of healthcare test cases stored in MongoDB.
                Required fields: testCaseId, testCaseTitle, testSteps, expectedResults.
              </Typography>
            </Box>
          </Box>
        </TabPanel>

        {/* Tab 1: Prompt Template */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Prompt Template</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Reset to default">
                  <IconButton size="small" onClick={() => handleReset('prompt')}>
                    <ResetIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy template">
                  <IconButton size="small" onClick={() => handleCopy(promptTemplate, 'Template')}>
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={30}
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              variant="outlined"
              sx={{ 
                fontFamily: 'monospace',
                '& textarea': { fontFamily: 'monospace', fontSize: '0.875rem' }
              }}
            />

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                This template guides the AI in analyzing and summarizing healthcare test cases.
                Use placeholders like {'{query}'}, {'{testCases}'} for dynamic content.
              </Typography>
            </Box>
          </Box>
        </TabPanel>

        {/* Tab 2: Test & Preview */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Test Prompt Template
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Test your prompt template with sample data to see how the AI responds
            </Typography>

            <Grid container spacing={3}>
              {/* Test Query */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Test Query / User Story"
                  multiline
                  rows={3}
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  variant="outlined"
                  placeholder="Enter a user story or query to test..."
                   sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        minWidth: '800px',
                        width: '100%'
                      } 
                    }}
                />
              </Grid>

              {/* Test Cases Input */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Sample Test Cases (JSON)"
                  multiline
                  rows={15}
                  value={testCases}
                  onChange={(e) => setTestCases(e.target.value)}
                  variant="outlined"
                  sx={{ 
                    fontFamily: 'monospace',
                    '& textarea': { fontFamily: 'monospace', fontSize: '0.875rem' ,   minWidth: '800px',
                        width: '100%'}
                    
                  }}
                />
              </Grid>

              {/* Test Button */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<TestIcon />}
                    onClick={handleTest}
                    disabled={testing || !schemaValid}
                  >
                    {testing ? 'Testing...' : 'Test Prompt Engineering'}
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<SearchIcon />}
                    onClick={handleRagTest}
                    disabled={ragTesting || !schemaValid}
                  >
                    {ragTesting ? 'Testing...' : 'Test RAG (Standard)'}
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<AiIcon />}
                    onClick={handleLlmRagTest}
                    disabled={llmRagTesting || !schemaValid}
                  >
                    {llmRagTesting ? 'Running Complete Pipeline...' : 'Complete RAG Pipeline (Preprocess → Search → Dedupe → Generate)'}
                  </Button>
                  {(testResult && ragResult && llmRagResult) && (
                    <Button
                      variant="outlined"
                      color="info"
                      startIcon={<CompareIcon />}
                      onClick={() => setShowComparison(!showComparison)}
                    >
                      {showComparison ? 'Hide Comparison' : 'Show Full Comparison'}
                    </Button>
                  )}
                  {(testResult && llmRagResult) && (
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<CompareIcon />}
                      onClick={() => setShowQualityComparison(!showQualityComparison)}
                    >
                      {showQualityComparison ? 'Hide Quality Analysis' : 'Analyze Test Case Quality'}
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={!schemaValid}
                  >
                    Save Configuration
                  </Button>
                </Box>
              </Grid>

              {/* Test Results */}
              {testResult && !showComparison && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: testResult.error ? '#ffebee' : '#e8f5e9' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AiIcon /> Prompt Engineering Result
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ 
                        bgcolor: 'background.paper', 
                        p: 2, 
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap',
                        overflow: 'auto',
                        maxHeight: 400
                      }}>
                        {testResult.error ? (
                          <Typography color="error">{testResult.message}</Typography>
                        ) : (
                          <pre style={{ margin: 0 }}>
                            {JSON.stringify(testResult.response, null, 2)}
                          </pre>
                        )}
                      </Box>
                      
                      {!testResult.error && testResult.tokens && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Tokens used: {testResult.tokens.total} (Prompt: {testResult.tokens.prompt}, Completion: {testResult.tokens.completion})
                            | Cost: ${testResult.cost.total}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* RAG Results */}
              {ragResult && !showComparison && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: ragResult.error ? '#ffebee' : '#e3f2fd' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SearchIcon /> RAG (Standard Summarization) Result
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ 
                        bgcolor: 'background.paper', 
                        p: 2, 
                        borderRadius: 1,
                        whiteSpace: 'pre-wrap',
                        overflow: 'auto',
                        maxHeight: 400
                      }}>
                        {ragResult.error ? (
                          <Typography color="error">{ragResult.message}</Typography>
                        ) : (
                          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                            {ragResult.summary}
                          </Typography>
                        )}
                      </Box>
                      
                      {!ragResult.error && ragResult.tokens && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Tokens used: {ragResult.tokens.total} (Prompt: {ragResult.tokens.prompt}, Completion: {ragResult.tokens.completion})
                            | Cost: ${ragResult.cost.total}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Complete Pipeline Results */}
              {llmRagResult && !showComparison && !showQualityComparison && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: llmRagResult.error ? '#ffebee' : '#f3e5f5' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AiIcon /> Complete RAG Pipeline Results
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                        <Chip label="Preprocess → Search → Dedupe → Analyze → Generate" color="success" size="small" />
                        {llmRagResult.searchResults && (
                          <Chip label={`${llmRagResult.searchResults} results found`} color="info" size="small" />
                        )}
                        {llmRagResult.dedupData && (
                          <Chip label={`${llmRagResult.dedupData.stats?.duplicatesRemoved || 0} duplicates removed`} color="warning" size="small" />
                        )}
                        {llmRagResult.topResults && (
                          <Chip label={`${llmRagResult.topResults} analyzed`} color="secondary" size="small" />
                        )}
                        <Chip label="Production-Quality Generation" color="primary" size="small" />
                      </Box>
                      
                      {/* Pipeline Steps */}
                      {llmRagResult.preprocessingData && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          <Typography variant="body2">
                            <strong>🔧 Query Preprocessing:</strong> Applied transformations including synonym expansion, 
                            abbreviation handling, and healthcare domain optimization.
                            {llmRagResult.originalQuery !== llmRagResult.processedQuery && (
                              <span><br/><strong>Processed Query:</strong> {llmRagResult.processedQuery}</span>
                            )}
                          </Typography>
                        </Alert>
                      )}
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Grid container spacing={2}>
                        {/* Left Column: Existing Test Cases */}
                        <Grid item xs={12} md={6}>
                          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                            📋 Existing Test Cases (Retrieved)
                          </Typography>
                          
                          {/* RAG Summary */}
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Comprehensive Analysis:
                            </Typography>
                            <Box sx={{ 
                              bgcolor: '#e3f2fd', 
                              p: 2, 
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              maxHeight: 300,
                              overflow: 'auto'
                            }}>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
                                {llmRagResult.ragSummary}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Existing Test Cases List */}
                          {llmRagResult.existingTestCases && (
                            <Box>
                              <Typography variant="subtitle2" gutterBottom>
                                Retrieved Test Cases ({llmRagResult.existingTestCases.length}):
                              </Typography>
                              <Box sx={{ 
                                bgcolor: '#fff3e0', 
                                p: 2, 
                                borderRadius: 1,
                                maxHeight: 400,
                                overflow: 'auto'
                              }}>
                                {llmRagResult.existingTestCases.map((testCase, idx) => (
                                  <Box key={idx} sx={{ mb: 2, pb: 1, borderBottom: '1px solid #e0e0e0' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                      {testCase.id || testCase.testCaseId} - {testCase.title || testCase.testCaseTitle}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Module: {testCase.module} | Priority: {testCase.priority}
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
                                      {testCase.description || testCase.testCaseDescription}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          )}
                        </Grid>

                        {/* Right Column: Generated Test Cases */}
                        <Grid item xs={12} md={6}>
                          <Typography variant="h6" gutterBottom sx={{ color: 'success.main' }}>
                            🧪 Generated Test Cases (NEW)
                          </Typography>
                          
                          <Box sx={{ 
                            bgcolor: 'background.paper', 
                            p: 2, 
                            borderRadius: 1,
                            border: '2px solid #4caf50',
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            whiteSpace: 'pre-wrap',
                            overflow: 'auto',
                            maxHeight: 700
                          }}>
                            {llmRagResult.error ? (
                              <Typography color="error">{llmRagResult.message}</Typography>
                            ) : (
                              <pre style={{ margin: 0, fontSize: '0.7rem' }}>
                                {JSON.stringify(llmRagResult.response, null, 2)}
                              </pre>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                      
                      {!llmRagResult.error && (
                        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          {llmRagResult.tokens && (
                            <Typography variant="caption" color="text.secondary">
                              <strong>Generation:</strong> {llmRagResult.tokens.total} tokens | ${llmRagResult.cost.total}
                            </Typography>
                          )}
                          {llmRagResult.ragTokens && (
                            <Typography variant="caption" color="text.secondary">
                              <strong>RAG Summary:</strong> {llmRagResult.ragTokens.total} tokens | ${llmRagResult.ragCost.total}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Comparison View */}
              {showComparison && testResult && ragResult && llmRagResult && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: '#fff3e0' }}>
                    <CardContent>
                      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CompareIcon /> Three-Way Comparison: Prompt Engineering vs RAG vs LLM+RAG
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      
                      <Grid container spacing={2}>
                        {/* Prompt Engineering Column */}
                        <Grid item xs={12} md={4}>
                          <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
                            <CardContent>
                              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <AiIcon color="success" /> 1. Prompt Engineering
                              </Typography>
                              <Chip label="Structured Analysis" color="success" size="small" sx={{ mb: 2 }} />
                              <Divider sx={{ my: 1 }} />
                              
                              <Box sx={{ 
                                bgcolor: 'background.paper', 
                                p: 2, 
                                borderRadius: 1,
                                fontFamily: 'monospace',
                                fontSize: '0.65rem',
                                whiteSpace: 'pre-wrap',
                                overflow: 'auto',
                                maxHeight: 400
                              }}>
                                {!testResult.error && (
                                  <pre style={{ margin: 0 }}>
                                    {JSON.stringify(testResult.response, null, 2)}
                                  </pre>
                                )}
                              </Box>
                              
                              {!testResult.error && testResult.tokens && (
                                <Box sx={{ mt: 2, p: 1, bgcolor: '#c8e6c9', borderRadius: 1 }}>
                                  <Typography variant="caption" display="block">
                                    <strong>Tokens:</strong> {testResult.tokens.total}
                                  </Typography>
                                  <Typography variant="caption" display="block">
                                    <strong>Cost:</strong> ${testResult.cost.total}
                                  </Typography>
                                  <Typography variant="caption" display="block" color="success.dark">
                                    <strong>Format:</strong> Structured JSON with recommendations & gaps
                                  </Typography>
                                </Box>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>

                        {/* RAG Column */}
                        <Grid item xs={12} md={4}>
                          <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
                            <CardContent>
                              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <SearchIcon color="primary" /> 2. RAG (Standard)
                              </Typography>
                              <Chip label="Text Summary" color="primary" size="small" sx={{ mb: 2 }} />
                              <Divider sx={{ my: 1 }} />
                              
                              <Box sx={{ 
                                bgcolor: 'background.paper', 
                                p: 2, 
                                borderRadius: 1,
                                whiteSpace: 'pre-wrap',
                                overflow: 'auto',
                                maxHeight: 400,
                                fontSize: '0.75rem'
                              }}>
                                {!ragResult.error && (
                                  <Typography variant="body2" sx={{ lineHeight: 1.6, fontSize: '0.75rem' }}>
                                    {ragResult.summary}
                                  </Typography>
                                )}
                              </Box>
                              
                              {!ragResult.error && ragResult.tokens && (
                                <Box sx={{ mt: 2, p: 1, bgcolor: '#bbdefb', borderRadius: 1 }}>
                                  <Typography variant="caption" display="block">
                                    <strong>Tokens:</strong> {ragResult.tokens.total}
                                  </Typography>
                                  <Typography variant="caption" display="block">
                                    <strong>Cost:</strong> ${ragResult.cost.total}
                                  </Typography>
                                  <Typography variant="caption" display="block" color="primary.dark">
                                    <strong>Format:</strong> Narrative summary
                                  </Typography>
                                </Box>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>

                        {/* LLM + RAG Context Column */}
                        <Grid item xs={12} md={4}>
                          <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
                            <CardContent>
                              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <AiIcon color="secondary" /> 3. LLM + RAG Context
                              </Typography>
                              <Chip label="Generated Test Cases" color="secondary" size="small" sx={{ mb: 2 }} />
                              <Divider sx={{ my: 1 }} />
                              
                              <Box sx={{ 
                                bgcolor: 'background.paper', 
                                p: 2, 
                                borderRadius: 1,
                                fontFamily: 'monospace',
                                fontSize: '0.65rem',
                                whiteSpace: 'pre-wrap',
                                overflow: 'auto',
                                maxHeight: 400
                              }}>
                                {!llmRagResult.error && (
                                  <pre style={{ margin: 0 }}>
                                    {JSON.stringify(llmRagResult.response, null, 2)}
                                  </pre>
                                )}
                              </Box>
                              
                              {!llmRagResult.error && llmRagResult.tokens && (
                                <Box sx={{ mt: 2, p: 1, bgcolor: '#e1bee7', borderRadius: 1 }}>
                                  <Typography variant="caption" display="block">
                                    <strong>Tokens:</strong> {llmRagResult.tokens.total}
                                  </Typography>
                                  <Typography variant="caption" display="block">
                                    <strong>Cost:</strong> ${llmRagResult.cost.total}
                                  </Typography>
                                  <Typography variant="caption" display="block" color="secondary.dark">
                                    <strong>Format:</strong> Actionable test cases
                                  </Typography>
                                </Box>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>

                        {/* Enhanced Quality Analysis */}
                        <Grid item xs={12}>
                          <Card sx={{ bgcolor: '#fff9c4' }}>
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                📊 Comprehensive Quality & Performance Analysis
                              </Typography>
                              
                              {/* Performance Metrics */}
                              <Grid container spacing={3} sx={{ mb: 3 }}>
                                <Grid item xs={12} sm={4}>
                                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    💰 Cost Analysis
                                  </Typography>
                                  <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                                    <Typography variant="body2">
                                      <strong>Prompt Engineering:</strong> ${testResult?.cost?.total || '0.000000'}<br/>
                                      <strong>RAG Summary:</strong> ${ragResult?.cost?.total || '0.000000'}<br/>
                                      <strong>Full RAG Pipeline:</strong> ${llmRagResult?.cost?.total || '0.000000'}
                                      {llmRagResult?.ragCost?.total && (
                                        <span><br/><em>+ RAG Cost: ${llmRagResult.ragCost.total}</em></span>
                                      )}
                                    </Typography>
                                  </Box>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    🔢 Token Usage
                                  </Typography>
                                  <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                                    <Typography variant="body2">
                                      <strong>PE:</strong> {testResult?.tokens?.total || 0} tokens<br/>
                                      <strong>RAG:</strong> {ragResult?.tokens?.total || 0} tokens<br/>
                                      <strong>Pipeline:</strong> {llmRagResult?.tokens?.total || 0} tokens
                                      {llmRagResult?.ragTokens?.total && (
                                        <span><br/><em>+ RAG: {llmRagResult.ragTokens.total}</em></span>
                                      )}
                                    </Typography>
                                  </Box>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    📊 Output Quality
                                  </Typography>
                                  <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                                    <Typography variant="body2">
                                      <strong>PE:</strong> Analysis + Gaps<br/>
                                      <strong>RAG:</strong> Comprehensive Summary<br/>
                                      <strong>Pipeline:</strong> New Test Cases
                                    </Typography>
                                  </Box>
                                </Grid>
                              </Grid>

                              {/* Quality Comparison */}
                              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                🎯 Quality & Use Case Analysis
                              </Typography>
                              
                              <Grid container spacing={2}>
                                <Grid item xs={12} md={4}>
                                  <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
                                    <CardContent>
                                      <Typography variant="h6" color="success.main" gutterBottom>
                                        1️⃣ Prompt Engineering
                                      </Typography>
                                      <Typography variant="body2" sx={{ mb: 2 }}>
                                        <strong>Best for:</strong> Gap analysis, structured recommendations
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                        ✅ Identifies specific gaps<br/>
                                        ✅ Structured JSON output<br/>
                                        ✅ Actionable recommendations<br/>
                                        ✅ Quick analysis<br/>
                                        ❌ Uses sample data only
                                      </Typography>
                                    </CardContent>
                                  </Card>
                                </Grid>
                                
                                <Grid item xs={12} md={4}>
                                  <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
                                    <CardContent>
                                      <Typography variant="h6" color="primary.main" gutterBottom>
                                        2️⃣ RAG (Standard)
                                      </Typography>
                                      <Typography variant="body2" sx={{ mb: 2 }}>
                                        <strong>Best for:</strong> Documentation, comprehensive analysis
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                        ✅ Uses real test data<br/>
                                        ✅ Comprehensive coverage analysis<br/>
                                        ✅ Module/priority grouping<br/>
                                        ✅ Healthcare domain expertise<br/>
                                        ❌ No new test generation
                                      </Typography>
                                    </CardContent>
                                  </Card>
                                </Grid>
                                
                                <Grid item xs={12} md={4}>
                                  <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
                                    <CardContent>
                                      <Typography variant="h6" color="secondary.main" gutterBottom>
                                        3️⃣ Full RAG Pipeline
                                      </Typography>
                                      <Typography variant="body2" sx={{ mb: 2 }}>
                                        <strong>Best for:</strong> Complete test case generation
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                        ✅ Searches real database<br/>
                                        ✅ Context-aware generation<br/>
                                        ✅ High-quality new test cases<br/>
                                        ✅ Complements existing coverage<br/>
                                        ❌ Highest cost/complexity
                                      </Typography>
                                    </CardContent>
                                  </Card>
                                </Grid>
                              </Grid>
                              
                              <Alert severity="success" sx={{ mt: 3 }}>
                                <Typography variant="body2">
                                  <strong>🏆 QUALITY RECOMMENDATION:</strong><br/>
                                  For highest quality test case generation: Use <strong>Full RAG Pipeline</strong> which searches your actual database, 
                                  creates comprehensive analysis, and generates contextually relevant test cases. The enhanced RAG summarization 
                                  now includes detailed test steps, priorities, modules, and compliance considerations.
                                </Typography>
                              </Alert>
                              
                              <Alert severity="info" sx={{ mt: 2 }}>
                                <Typography variant="body2">
                                  <strong>💡 WORKFLOW RECOMMENDATION:</strong><br/>
                                  (1) <strong>Full RAG Pipeline</strong> for new test generation → 
                                  (2) <strong>RAG Summary</strong> for documentation → 
                                  (3) <strong>Prompt Engineering</strong> for additional gap analysis
                                </Typography>
                              </Alert>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Quality Comparison View */}
              {showQualityComparison && testResult && llmRagResult && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: '#fff3e0', border: '2px solid #ff9800' }}>
                    <CardContent>
                      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        🏆 Test Case Quality Analysis: Prompt Engineering vs Full RAG Pipeline
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      
                      <Grid container spacing={3}>
                        {/* Prompt Engineering Quality */}
                        <Grid item xs={12} md={6}>
                          <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
                            <CardContent>
                              <Typography variant="h6" color="success.main" gutterBottom>
                                📝 Prompt Engineering Approach
                              </Typography>
                              <Box sx={{ mb: 2 }}>
                                <Chip label="Sample Data" color="warning" size="small" />
                                <Chip label="Fast Execution" color="success" size="small" sx={{ ml: 1 }} />
                              </Box>
                              
                              <Typography variant="subtitle2" gutterBottom>Generated Test Cases:</Typography>
                              <Typography variant="body2" sx={{ mb: 2 }}>
                                Count: {testResult.response?.recommendations?.length || 'N/A'}<br/>
                                Source: Sample data only<br/>
                                Context: Limited to provided examples
                              </Typography>
                              
                              <Typography variant="subtitle2" gutterBottom>Quality Metrics:</Typography>
                              <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1, fontSize: '0.85rem' }}>
                                ✅ Structured JSON output<br/>
                                ✅ Fast response time<br/>
                                ✅ Consistent format<br/>
                                ❌ No real database search<br/>
                                ❌ Limited context awareness<br/>
                                ❌ Sample data dependency
                              </Box>
                              
                              <Box sx={{ mt: 2, p: 1, bgcolor: '#c8e6c9', borderRadius: 1 }}>
                                <Typography variant="caption">
                                  <strong>Cost:</strong> ${testResult.cost?.total || '0.000000'}<br/>
                                  <strong>Tokens:</strong> {testResult.tokens?.total || 0}
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                        
                        {/* RAG Pipeline Quality */}
                        <Grid item xs={12} md={6}>
                          <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
                            <CardContent>
                              <Typography variant="h6" color="secondary.main" gutterBottom>
                                🎯 Full RAG Pipeline Approach
                              </Typography>
                              <Box sx={{ mb: 2 }}>
                                <Chip label="Real Database" color="primary" size="small" />
                                <Chip label="Complete Pipeline" color="success" size="small" sx={{ ml: 1 }} />
                              </Box>
                              
                              <Typography variant="subtitle2" gutterBottom>Generated Test Cases:</Typography>
                              <Typography variant="body2" sx={{ mb: 2 }}>
                                Count: {llmRagResult.response?.response?.newTestCases?.length || 'N/A'}<br/>
                                Source: {llmRagResult.searchResults || 0} database results<br/>
                                Context: Comprehensive RAG analysis
                              </Typography>
                              
                              <Typography variant="subtitle2" gutterBottom>Quality Metrics:</Typography>
                              <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1, fontSize: '0.85rem' }}>
                                ✅ Real database search ({llmRagResult.searchResults || 0} results)<br/>
                                ✅ Query preprocessing applied<br/>
                                ✅ Deduplication: {llmRagResult.dedupData?.stats?.duplicatesRemoved || 0} removed<br/>
                                ✅ Comprehensive RAG analysis<br/>
                                ✅ Context-aware generation<br/>
                                ✅ Healthcare domain expertise<br/>
                                ❌ Higher cost and complexity
                              </Box>
                              
                              <Box sx={{ mt: 2, p: 1, bgcolor: '#e1bee7', borderRadius: 1 }}>
                                <Typography variant="caption">
                                  <strong>Generation Cost:</strong> ${llmRagResult.cost?.total || '0.000000'}<br/>
                                  <strong>RAG Cost:</strong> ${llmRagResult.ragCost?.total || '0.000000'}<br/>
                                  <strong>Total Tokens:</strong> {(llmRagResult.tokens?.total || 0) + (llmRagResult.ragTokens?.total || 0)}
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                        
                        {/* Winner Analysis */}
                        <Grid item xs={12}>
                          <Card sx={{ bgcolor: '#e8f5e9', border: '2px solid #4caf50' }}>
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                🏆 Quality Winner: Full RAG Pipeline
                              </Typography>
                              
                              <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="subtitle2" gutterBottom>Why RAG Pipeline Wins:</Typography>
                                  <Box sx={{ fontSize: '0.9rem' }}>
                                    🎯 <strong>Real Data Integration:</strong> Searches {llmRagResult.searchResults || 0} actual test cases from your database<br/>
                                    🔧 <strong>Query Preprocessing:</strong> Optimizes search with domain knowledge<br/>
                                    🧹 <strong>Deduplication:</strong> Removes {llmRagResult.dedupData?.stats?.duplicatesRemoved || 0} duplicate results<br/>
                                    📊 <strong>Comprehensive Analysis:</strong> Deep RAG analysis of existing coverage<br/>
                                    🎨 <strong>Context-Aware:</strong> Generates test cases that complement existing ones<br/>
                                    🏥 <strong>Healthcare Domain:</strong> Specialized healthcare expertise
                                  </Box>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="subtitle2" gutterBottom>Quality Metrics Comparison:</Typography>
                                  <Box sx={{ fontSize: '0.9rem' }}>
                                    <strong>Test Case Count:</strong><br/>
                                    • PE: {testResult.response?.recommendations?.length || 0} cases<br/>
                                    • RAG: {llmRagResult.response?.response?.newTestCases?.length || 0} cases<br/><br/>
                                    <strong>Data Source:</strong><br/>
                                    • PE: Sample data only<br/>
                                    • RAG: {llmRagResult.searchResults || 0} real database results<br/><br/>
                                    <strong>Context Richness:</strong><br/>
                                    • PE: Limited to examples<br/>
                                    • RAG: Full database analysis + preprocessing
                                  </Box>
                                </Grid>
                              </Grid>
                              
                              <Alert severity="success" sx={{ mt: 2 }}>
                                <Typography variant="body2">
                                  <strong>🎯 CONCLUSION:</strong> The Full RAG Pipeline produces higher quality test cases because it:
                                  (1) Uses real database search results, (2) Applies query preprocessing for better search,
                                  (3) Removes duplicates to reduce noise, (4) Provides comprehensive analysis of existing coverage,
                                  and (5) Generates contextually relevant test cases that complement existing ones.
                                </Typography>
                              </Alert>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
}

export default PromptSchemaManager;
