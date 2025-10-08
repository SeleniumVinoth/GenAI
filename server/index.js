import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { MongoClient } from 'mongodb';
import dns from 'dns';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Fix DNS resolution issue on macOS
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// ======================== Job Tracking ========================
// In-memory job tracking (consider using Redis for production)
const jobs = new Map();

function createJob(files) {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  jobs.set(jobId, {
    id: jobId,
    files,
    status: 'in-progress',
    progress: 0,
    total: files.length,
    results: [],
    startTime: new Date(),
    currentFile: null
  });
  return jobId;
}

function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (job) {
    Object.assign(job, updates);
    jobs.set(jobId, job);
  }
}

function getJob(jobId) {
  return jobs.get(jobId);
}

// Clean up old jobs (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [jobId, job] of jobs.entries()) {
    if (new Date(job.startTime).getTime() < oneHourAgo) {
      jobs.delete(jobId);
    }
  }
}, 10 * 60 * 1000); // Run every 10 minutes

// ======================== Validation Helpers ========================

async function validateDbCollectionIndex(client, dbName, collectionName, indexName, requireDocuments = false) {
  try {
    // Attempt to detect database existence via listDatabases (may require privileges)
    let dbExists = false;
    try {
      const admin = client.db().admin();
      const dbs = await admin.listDatabases();
      dbExists = dbs.databases.some(d => d.name === dbName);
    } catch (err) {
      // If listDatabases fails because of permissions, fallback to checking the collection directly
      console.warn('⚠️ listDatabases failed (permissions?), falling back to listCollections check:', err.message);
      dbExists = true; // assume DB exists and proceed to collection check
    }

    if (!dbExists) {
      return { ok: false, error: `Database '${dbName}' not found` };
    }

    const db = client.db(dbName);
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (!collections || collections.length === 0) {
      return { ok: false, error: `Collection '${collectionName}' not found in database '${dbName}'` };
    }

    if (requireDocuments) {
      const count = await db.collection(collectionName).countDocuments();
      if (count === 0) {
        return { ok: false, error: `No documents found in collection '${collectionName}'. Please create embeddings first.` };
      }
    }

    // Verify Atlas Search indexes (listSearchIndexes command)
    if (indexName) {
      try {
        const collection = db.collection(collectionName);
        const indexes = await collection.listSearchIndexes().toArray();
        if (!indexes || !Array.isArray(indexes)) {
          return { ok: false, error: `Unable to verify search indexes for collection '${collectionName}'.` };
        }
        const found = indexes.some(idx => idx.name === indexName);
        if (!found) {
          return { ok: false, error: `Search index '${indexName}' not found for collection '${collectionName}'` };
        }
      } catch (err) {
        // Some server versions / permissions may not allow listSearchIndexes; surface helpful message
        return { ok: false, error: `Could not verify search index '${indexName}': ${err.message}` };
      }
    }

    return { ok: true };

  } catch (err) {
    return { ok: false, error: `Validation failed: ${err.message}` };
  }
}

// ======================== API Routes ========================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Get active jobs
app.get('/api/jobs/active', (req, res) => {
  const activeJobs = Array.from(jobs.values()).filter(job => job.status === 'in-progress');
  res.json({ jobs: activeJobs });
});

// Get job status
app.get('/api/jobs/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// Get distinct metadata values for filters
app.get('/api/metadata/distinct', async (req, res) => {
  try {
    console.log('🔍 Fetching distinct metadata values...');
    console.log('📊 DB Name:', process.env.DB_NAME);
    console.log('📊 Collection Name:', process.env.COLLECTION_NAME);
    
    const mongoClient = new MongoClient(process.env.MONGODB_URI, {
      ssl: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });

    await mongoClient.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = mongoClient.db(process.env.DB_NAME);
    const collection = db.collection(process.env.COLLECTION_NAME);

    // Check document count first
    const count = await collection.countDocuments();
    console.log(`📊 Total documents in collection: ${count}`);

    if (count === 0) {
      console.log('⚠️ Collection is empty! No documents found.');
      await mongoClient.close();
      return res.json({
        success: true,
        metadata: {
          modules: [],
          priorities: [],
          risks: [],
          types: []
        },
        message: 'Collection is empty. Please create embeddings first.'
      });
    }

    // Get a sample document to see what fields exist
    const sampleDoc = await collection.findOne({});
    console.log('📄 Sample document fields:', Object.keys(sampleDoc || {}));
    console.log('📄 Sample document:', JSON.stringify(sampleDoc, null, 2));

    const modules = await collection.distinct('module');
    const priorities = await collection.distinct('priority');
    const risks = await collection.distinct('risk');
    const types = await collection.distinct('automationManual');

    console.log(`✅ Found ${modules.length} modules:`, modules);
    console.log(`✅ Found ${priorities.length} priorities:`, priorities);
    console.log(`✅ Found ${risks.length} risks:`, risks);
    console.log(`✅ Found ${types.length} types:`, types);

  await mongoClient.close();

    const metadata = {
      modules: modules.filter(Boolean).sort(),
      priorities: priorities.filter(Boolean).sort(),
      risks: risks.filter(Boolean).sort(),
      types: types.filter(Boolean).sort()
    };

    console.log('📤 Sending metadata:', metadata);

    res.json({
      success: true,
      metadata
    });

  } catch (error) {
    console.error('❌ Error fetching metadata:', error);
    res.status(500).json({ error: 'Failed to fetch metadata', details: error.message });
  }
});

// Get all files in data directory
app.get('/api/files', (req, res) => {
  try {
    const dataPath = path.join(__dirname, '../src/data');
    const files = fs.readdirSync(dataPath)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(dataPath, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          type: 'json'
        };
      });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read files', details: error.message });
  }
});

// Upload and convert Excel to JSON
app.post('/api/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const inputFile = req.file.path;
    const outputPath = path.join(__dirname, '../src/data', `converted-${Date.now()}.json`);
    
    // Convert paths to forward slashes (works on both Windows and Unix)
    const inputFileNormalized = inputFile.replace(/\\/g, '/');
    const outputPathNormalized = outputPath.replace(/\\/g, '/');
    
    // Create a modified version of excel-to-json.js for this specific file
    const scriptContent = `
import xlsx from "xlsx";
import fs from "fs";

const excelFile = "${inputFileNormalized}";      
const sheetName = "${req.body.sheetName || 'Testcases'}";   
const outputFile = "${outputPathNormalized}";      

const columnMap = {
  "Module": "module",
  "Test ID": "id",
  "Pre-Requisites": "preRequisites",
  "Test Title": "title",
  "Test Case Description": "description",
  "Test Steps": "steps",
  "Expected Results": "expectedResults",
  "Automation/Manual": "automationManual",
  "Priority": "priority",
  "Created By": "createdBy",
  "Created Date": "createdDate",
  "Last modified date": "lastModifiedDate",
  "Risk": "risk",
  "Version": "version",
  "Type": "type"
};

try {
  const workbook = xlsx.readFile(excelFile);
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    console.error(\`❌ Sheet "\${sheetName}" not found in \${excelFile}\`);
    process.exit(1);
  }

  const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

  const jsonData = rawData.map((row, index) => {
    const mappedRow = {};
    for (const [excelCol, jsonKey] of Object.entries(columnMap)) {
      mappedRow[jsonKey] = row[excelCol] || "";
    }
    return mappedRow;
  });

  fs.writeFileSync(outputFile, JSON.stringify(jsonData, null, 2), "utf-8");
  console.log(\`✅ Converted \${jsonData.length} rows from "\${sheetName}" into \${outputFile}\`);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
`;

    const tempScriptPath = path.join(__dirname, `temp-excel-convert-${Date.now()}.js`);
    fs.writeFileSync(tempScriptPath, scriptContent);

    // Execute the conversion script
    const child = spawn('node', [tempScriptPath], { cwd: __dirname });
    
    let output = '';
    let error = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      // Clean up temp script and uploaded file
      fs.unlinkSync(tempScriptPath);
      fs.unlinkSync(inputFile);

      if (code === 0) {
        res.json({
          success: true,
          message: 'File converted successfully',
          outputFile: path.basename(outputPath),
          output
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Conversion failed',
          details: error || output
        });
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Create embeddings for selected files
app.post('/api/create-embeddings', async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files selected' });
    }

    // Validate DB and collection exist (no documents required for creating embeddings)
    const mongoClient = new MongoClient(process.env.MONGODB_URI, {
      ssl: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });

    try {
      await mongoClient.connect();
      const validation = await validateDbCollectionIndex(mongoClient, process.env.DB_NAME, process.env.COLLECTION_NAME, null, false);
      if (!validation.ok) {
        await mongoClient.close();
        return res.status(400).json({ error: validation.error });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Failed to validate database/collection', details: err.message });
    } finally {
      try { await mongoClient.close(); } catch (e) {}
    }

    // Create a job and return immediately
    const jobId = createJob(files);
    
    // Start processing in background
    processEmbeddings(jobId, files);
    
    // Return job ID to client
    res.json({
      success: true,
      jobId,
      message: 'Embedding creation started',
      filesCount: files.length
    });

  } catch (error) {
    res.status(500).json({ error: 'Embedding creation failed', details: error.message });
  }
});

// Background processing function
async function processEmbeddings(jobId, files) {
  const results = [];

  
  for (const fileName of files) {
    updateJob(jobId, { currentFile: fileName });
    
    const filePath = path.join(__dirname, '../src/data', fileName);
    // Convert paths to forward slashes for cross-platform compatibility
    const filePathNormalized = filePath.replace(/\\/g, '/');
    
    // Create a modified version of create-embeddings-store.js for this specific file
    const scriptContent = `
import { MongoClient } from "mongodb";
import dns from "dns";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoClient = new MongoClient(process.env.MONGODB_URI, {
  ssl: true,
  tlsAllowInvalidCertificates: true,
  tlsAllowInvalidHostnames: true,
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000,
});

const TESTLEAF_API_BASE = process.env.TESTLEAF_API_BASE || 'https://api.testleaf.ai';
const USER_EMAIL = process.env.USER_EMAIL;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

async function main() {
  try {
  await mongoClient.connect();
  const db = mongoClient.db(process.env.DB_NAME);
  const collection = db.collection(process.env.COLLECTION_NAME);

    const testcases = JSON.parse(fs.readFileSync("${filePathNormalized}", "utf-8"));

    console.log(\`🚀 Processing \${testcases.length} test cases from ${fileName}...\`);
    
    let totalCost = 0;
    let totalTokens = 0;
    let processed = 0;

    for (const testcase of testcases) {
      try {
        const inputText = \`
          Module: \${testcase.module}
          ID: \${testcase.id}
          Pre-Requisites: \${testcase.preRequisites}
          Title: \${testcase.title}
          Description: \${testcase.description}
          Steps: \${testcase.steps}
          Expected Result: \${testcase.expectedResults}
          Automation/Manual: \${testcase.automationManual}
          Priority: \${testcase.priority}
          Created By: \${testcase.createdBy}
          Created Date: \${testcase.createdDate}
          Last Modified Date: \${testcase.lastModifiedDate}
          Risk: \${testcase.risk}
          Version: \${testcase.version}
          Type: \${testcase.type}
        \`;
        
        const embeddingResponse = await axios.post(
          \`\${TESTLEAF_API_BASE}/embedding/text/\${USER_EMAIL}\`,
          {
            input: inputText,
            model: "text-embedding-3-small"
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(AUTH_TOKEN && { 'Authorization': \`Bearer \${AUTH_TOKEN}\` })
            }
          }
        );

        if (embeddingResponse.data.status !== 200) {
          throw new Error(\`Testleaf API error: \${embeddingResponse.data.message}\`);
        }

        const vector = embeddingResponse.data.data[0].embedding;
        const cost = embeddingResponse.data.cost || 0;
        const tokens = embeddingResponse.data.usage?.total_tokens || 0;
        
        totalCost += cost;
        totalTokens += tokens;

        const doc = {
          ...testcase,
          embedding: vector,
          createdAt: new Date(),
          sourceFile: "${fileName}",
          embeddingMetadata: {
            model: embeddingResponse.data.model,
            cost: cost,
            tokens: tokens,
            apiSource: 'testleaf'
          }
        };

        await collection.insertOne(doc);
        processed++;
        
        console.log(\`✅ Processed \${processed}/\${testcases.length}: \${testcase.id}\`);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(\`❌ Error processing \${testcase.id}: \${error.message}\`);
        continue;
      }
    }

    console.log(\`\\n🎉 Processing complete for ${fileName}!\`);
    console.log(\`💰 Total Cost: $\${totalCost.toFixed(6)}\`);
    console.log(\`🔢 Total Tokens: \${totalTokens}\`);
    console.log(\`📊 Processed: \${processed}/\${testcases.length}\`);

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await mongoClient.close();
  }
}

main();
`;

      const tempScriptPath = path.join(__dirname, `temp-embeddings-${Date.now()}.js`);
      fs.writeFileSync(tempScriptPath, scriptContent);

    try {
      await new Promise((resolve, reject) => {
        const child = spawn('node', [tempScriptPath], { cwd: __dirname });
        
        let output = '';
        let error = '';

        child.stdout.on('data', (data) => {
          output += data.toString();
        });

        child.stderr.on('data', (data) => {
          error += data.toString();
        });

        child.on('close', (code) => {
          fs.unlinkSync(tempScriptPath);
          
          if (code === 0) {
            results.push({
              file: fileName,
              status: 'completed',
              output
            });
            resolve();
          } else {
            results.push({
              file: fileName,
              status: 'failed',
              error: error || output
            });
            resolve(); // Continue with other files
          }
        });
      });
    } catch (error) {
      results.push({
        file: fileName,
        status: 'failed',
        error: error.message
      });
    }
    
    // Update job progress
    updateJob(jobId, {
      progress: results.length,
      results: [...results]
    });
  }

  // Mark job as complete
  updateJob(jobId, {
    status: 'completed',
    endTime: new Date(),
    results
  });
}

// Get environment variables
app.get('/api/env', (req, res) => {
  try {
    const envPath = path.join(__dirname, '../.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && key.trim() && !key.startsWith('#')) {
        envVars[key.trim()] = valueParts.join('=').replace(/"/g, '');
      }
    });

    res.json(envVars);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read environment variables', details: error.message });
  }
});

// Update environment variables
app.post('/api/env', (req, res) => {
  try {
    const { envVars } = req.body;
    const envPath = path.join(__dirname, '../.env');
    
    let envContent = '';
    Object.entries(envVars).forEach(([key, value]) => {
      envContent += `${key}="${value}"\n`;
    });

    fs.writeFileSync(envPath, envContent);
    
    res.json({ success: true, message: 'Environment variables updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update environment variables', details: error.message });
  }
});

// Search vector database
app.post('/api/search', async (req, res) => {
  try {
    const { query, limit = 5, filters = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Create a MongoClient, connect once, validate DB/collection/index and reuse for the search
    const mongoClient = new MongoClient(process.env.MONGODB_URI, {
      ssl: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });
    await mongoClient.connect();
    // Validate DB/collection/index and ensure documents exist
    const validation = await validateDbCollectionIndex(mongoClient, process.env.DB_NAME, process.env.COLLECTION_NAME, process.env.VECTOR_INDEX_NAME, true);
    if (!validation.ok) {
      try { await mongoClient.close(); } catch (e) {}
      return res.status(400).json({ error: validation.error });
    }

    const db = mongoClient.db(process.env.DB_NAME);
    const collection = db.collection(process.env.COLLECTION_NAME);

    // Generate embedding for query
    const TESTLEAF_API_BASE = process.env.TESTLEAF_API_BASE || 'https://api.testleaf.ai';
    const USER_EMAIL = process.env.USER_EMAIL;
    const AUTH_TOKEN = process.env.AUTH_TOKEN;

    const embeddingResponse = await axios.post(
      `${TESTLEAF_API_BASE}/embedding/text/${USER_EMAIL}`,
      {
        input: query,
        model: "text-embedding-3-small"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(AUTH_TOKEN && { 'Authorization': `Bearer ${AUTH_TOKEN}` })
        }
      }
    );

    if (embeddingResponse.data.status !== 200) {
      throw new Error(`Testleaf API error: ${embeddingResponse.data.message}`);
    }

    const queryVector = embeddingResponse.data.data[0].embedding;

    // Build vector search WITHOUT pre-filtering (to avoid index requirement)
    const vectorSearchStage = {
      $vectorSearch: {
        queryVector,
        path: "embedding",
        numCandidates: 100,
        limit: parseInt(limit) * 10, // Get more candidates for post-filtering
        index: process.env.VECTOR_INDEX_NAME
      }
    };

    // Build the pipeline
    const pipeline = [
      vectorSearchStage,
      {
        $addFields: {
          score: { $meta: "vectorSearchScore" }
        }
      }
    ];

    // Apply metadata filters using $match stage (works without index)
    if (Object.keys(filters).length > 0) {
      const matchConditions = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          matchConditions[key] = value;
        }
      });
      pipeline.push({
        $match: matchConditions
      });
      console.log('🔍 Applying filters with $match:', matchConditions);
    }

    // Add limit after filtering
    pipeline.push({
      $limit: parseInt(limit)
    });

    // Project fields
    pipeline.push({
      $project: {
        id: 1,
        module: 1,
        preRequisites: 1,
        title: 1,
        description: 1,
        steps: 1,
        expectedResults: 1,
        automationManual: 1,
        priority: 1,
        createdBy: 1,
        createdDate: 1,
        lastModifiedDate: 1,
        risk: 1,
        version: 1,
        type: 1,
        sourceFile: 1,
        createdAt: 1,
        score: 1
      }
    });

    console.log('🔍 Search Query:', query);
    console.log('🔍 Filters:', JSON.stringify(filters));
    console.log('🔍 Pipeline:', JSON.stringify(pipeline, null, 2));

  const results = await collection.aggregate(pipeline).toArray();
  await mongoClient.close();

    res.json({
      success: true,
      query,
      filters,
      results,
      cost: embeddingResponse.data.cost || 0,
      tokens: embeddingResponse.data.usage?.total_tokens || 0
    });

  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// ======================== BM25 Search Endpoint ========================
app.post('/api/search/bm25', async (req, res) => {
  try {
    const { query, limit = 10, filters = {}, fields = ['title', 'description', 'steps', 'expectedResults', 'module'] } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`🔤 BM25 Search request: "${query}"`);
    console.log(`   Limit: ${limit}`);
    console.log(`   Filters:`, filters);

    const mongoClient = new MongoClient(process.env.MONGODB_URI, {
      ssl: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });

    await mongoClient.connect();

    const validation = await validateDbCollectionIndex(
      mongoClient, 
      process.env.DB_NAME, 
      process.env.COLLECTION_NAME, 
      process.env.BM25_INDEX_NAME,
      true
    );
    
    if (!validation.ok) {
      try { await mongoClient.close(); } catch (e) {}
      return res.status(400).json({ error: validation.error });
    }

    const db = mongoClient.db(process.env.DB_NAME);
    const collection = db.collection(process.env.COLLECTION_NAME);

    // Build BM25 search pipeline
    const pipeline = [
      {
        $search: {
          index: process.env.BM25_INDEX_NAME,
          text: {
            query: query,
            path: fields,
            fuzzy: {
              maxEdits: 1,
              prefixLength: 2
            }
          }
        }
      },
      {
        $addFields: {
          score: { $meta: "searchScore" }
        }
      }
    ];

    // Apply filters if provided
    if (Object.keys(filters).length > 0) {
      const matchConditions = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          matchConditions[key] = value;
        }
      });

      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }
    }

    // Add projection and limit
    pipeline.push(
      {
        $project: {
          id: 1,
          module: 1,
          title: 1,
          description: 1,
          steps: 1,
          expectedResults: 1,
          priority: 1,
          risk: 1,
          automationManual: 1,
          sourceFile: 1,
          createdAt: 1,
          score: 1
        }
      },
      { $limit: parseInt(limit) }
    );

    console.log('🔍 BM25 Pipeline:', JSON.stringify(pipeline, null, 2));

    const startTime = Date.now();
    const results = await collection.aggregate(pipeline).toArray();
    const searchTime = Date.now() - startTime;

    await mongoClient.close();

    console.log(`✅ BM25 Search complete: ${results.length} results in ${searchTime}ms`);

    res.json({
      success: true,
      searchType: 'bm25',
      query,
      filters,
      results,
      count: results.length,
      searchTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ BM25 Search error:', error);
    res.status(500).json({ 
      error: 'BM25 search failed', 
      details: error.message 
    });
  }
});

// ======================== Hybrid Search Endpoint (BM25 + Vector) ========================
app.post('/api/search/hybrid', async (req, res) => {
  try {
    const { 
      query, 
      limit = 10, 
      filters = {},
      bm25Weight = 0.5,
      vectorWeight = 0.5,
      bm25Fields = ['title', 'description', 'steps', 'expectedResults', 'module']
    } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`🔀 Hybrid Search request: "${query}"`);
    console.log(`   BM25 Weight: ${bm25Weight}, Vector Weight: ${vectorWeight}`);

    const mongoClient = new MongoClient(process.env.MONGODB_URI, {
      ssl: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });

    await mongoClient.connect();

    // Validate both indexes exist
    const bm25Validation = await validateDbCollectionIndex(
      mongoClient, 
      process.env.DB_NAME, 
      process.env.COLLECTION_NAME, 
      process.env.BM25_INDEX_NAME,
      true
    );
    
    const vectorValidation = await validateDbCollectionIndex(
      mongoClient, 
      process.env.DB_NAME, 
      process.env.COLLECTION_NAME, 
      process.env.VECTOR_INDEX_NAME,
      true
    );

    if (!bm25Validation.ok) {
      await mongoClient.close();
      return res.status(400).json({ error: `BM25 Index: ${bm25Validation.error}` });
    }

    if (!vectorValidation.ok) {
      await mongoClient.close();
      return res.status(400).json({ error: `Vector Index: ${vectorValidation.error}` });
    }

    const db = mongoClient.db(process.env.DB_NAME);
    const collection = db.collection(process.env.COLLECTION_NAME);

    const searchLimit = parseInt(limit) * 3; // Get more for better combination

    // 1. BM25 Search
    console.log('🔤 Running BM25 search...');
    const bm25StartTime = Date.now();
    
    const bm25Pipeline = [
      {
        $search: {
          index: process.env.BM25_INDEX_NAME,
          text: {
            query: query,
            path: bm25Fields,
            fuzzy: {
              maxEdits: 1,
              prefixLength: 2
            }
          }
        }
      },
      {
        $addFields: {
          bm25Score: { $meta: "searchScore" }
        }
      },
      {
        $project: {
          _id: 1,
          id: 1,
          module: 1,
          title: 1,
          description: 1,
          steps: 1,
          expectedResults: 1,
          priority: 1,
          risk: 1,
          automationManual: 1,
          sourceFile: 1,
          createdAt: 1,
          bm25Score: 1
        }
      },
      { $limit: searchLimit }
    ];

    const bm25Results = await collection.aggregate(bm25Pipeline).toArray();
    const bm25Time = Date.now() - bm25StartTime;

    // 2. Vector Search
    console.log('🧠 Running vector search...');
    const vectorStartTime = Date.now();

    const TESTLEAF_API_BASE = process.env.TESTLEAF_API_BASE || 'https://api.testleaf.com/ai';
    const USER_EMAIL = process.env.USER_EMAIL;
    const AUTH_TOKEN = process.env.AUTH_TOKEN;

    const embeddingResponse = await axios.post(
      `${TESTLEAF_API_BASE}/embedding/text/${USER_EMAIL}`,
      {
        input: query,
        model: "text-embedding-3-small"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(AUTH_TOKEN && { 'Authorization': `Bearer ${AUTH_TOKEN}` })
        }
      }
    );

    if (embeddingResponse.data.status !== 200) {
      throw new Error(`Testleaf API error: ${embeddingResponse.data.message}`);
    }

    const queryVector = embeddingResponse.data.data[0].embedding;

    const vectorPipeline = [
      {
        $vectorSearch: {
          queryVector,
          path: "embedding",
          numCandidates: 100,
          limit: searchLimit,
          index: process.env.VECTOR_INDEX_NAME
        }
      },
      {
        $addFields: {
          vectorScore: { $meta: "vectorSearchScore" }
        }
      },
      {
        $project: {
          _id: 1,
          id: 1,
          module: 1,
          title: 1,
          description: 1,
          steps: 1,
          expectedResults: 1,
          priority: 1,
          risk: 1,
          automationManual: 1,
          sourceFile: 1,
          createdAt: 1,
          vectorScore: 1
        }
      }
    ];

    const vectorResults = await collection.aggregate(vectorPipeline).toArray();
    const vectorTime = Date.now() - vectorStartTime;

    // 3. Normalize and combine scores
    console.log('🔀 Combining results...');
    
    // Normalize BM25 scores
    const bm25Scores = bm25Results.map(r => r.bm25Score);
    const bm25Max = Math.max(...bm25Scores, 1);
    const bm25Min = Math.min(...bm25Scores, 0);
    const bm25Range = bm25Max - bm25Min || 1;

    // Normalize Vector scores
    const vectorScores = vectorResults.map(r => r.vectorScore);
    const vectorMax = Math.max(...vectorScores, 1);
    const vectorMin = Math.min(...vectorScores, 0);
    const vectorRange = vectorMax - vectorMin || 1;

    // Create result map
    const resultMap = new Map();

    // Add BM25 results with normalized scores
    bm25Results.forEach(result => {
      const key = result._id.toString();
      const normalizedScore = (result.bm25Score - bm25Min) / bm25Range;
      resultMap.set(key, {
        ...result,
        bm25ScoreNormalized: normalizedScore,
        vectorScore: 0,
        vectorScoreNormalized: 0,
        hybridScore: normalizedScore * bm25Weight,
        foundIn: 'bm25'
      });
    });

    // Add/merge vector results with normalized scores
    vectorResults.forEach(result => {
      const key = result._id.toString();
      const normalizedScore = (result.vectorScore - vectorMin) / vectorRange;
      
      if (resultMap.has(key)) {
        // Merge - found in both
        const existing = resultMap.get(key);
        existing.vectorScore = result.vectorScore;
        existing.vectorScoreNormalized = normalizedScore;
        existing.hybridScore += normalizedScore * vectorWeight;
        existing.foundIn = 'both';
      } else {
        // New result - only in vector
        resultMap.set(key, {
          ...result,
          bm25Score: 0,
          bm25ScoreNormalized: 0,
          vectorScoreNormalized: normalizedScore,
          hybridScore: normalizedScore * vectorWeight,
          foundIn: 'vector'
        });
      }
    });

    // Convert to array and sort by hybrid score
    let combinedResults = Array.from(resultMap.values());
    combinedResults.sort((a, b) => b.hybridScore - a.hybridScore);

    // Apply filters if provided
    if (Object.keys(filters).length > 0) {
      combinedResults = combinedResults.filter(result => {
        return Object.entries(filters).every(([key, value]) => {
          if (!value || value === '') return true;
          return result[key] === value;
        });
      });
    }

    // Limit results
    const finalResults = combinedResults.slice(0, parseInt(limit));

    await mongoClient.close();

    const totalTime = Date.now() - bm25StartTime;
    console.log(`✅ Hybrid Search complete: ${finalResults.length} results in ${totalTime}ms`);

    // Calculate statistics
    const bothCount = finalResults.filter(r => r.foundIn === 'both').length;
    const bm25OnlyCount = finalResults.filter(r => r.foundIn === 'bm25').length;
    const vectorOnlyCount = finalResults.filter(r => r.foundIn === 'vector').length;

    res.json({
      success: true,
      searchType: 'hybrid',
      query,
      filters,
      weights: { bm25: bm25Weight, vector: vectorWeight },
      results: finalResults,
      count: finalResults.length,
      stats: {
        foundInBoth: bothCount,
        foundInBm25Only: bm25OnlyCount,
        foundInVectorOnly: vectorOnlyCount,
        bm25ResultCount: bm25Results.length,
        vectorResultCount: vectorResults.length
      },
      timing: {
        bm25Time,
        vectorTime,
        totalTime
      },
      cost: embeddingResponse.data.cost || 0,
      tokens: embeddingResponse.data.usage?.total_tokens || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Hybrid Search error:', error);
    res.status(500).json({ 
      error: 'Hybrid search failed', 
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});