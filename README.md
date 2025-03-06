# MedGraph Navigator 🏥

<div align="center">

<img src="https://img.shields.io/badge/ArangoDB-3.10+-orange.svg" alt="ArangoDB">
<img src="https://img.shields.io/badge/React-19.0-blue?style=flat-square&logo=react" alt="React">
<img src="https://img.shields.io/badge/Together%20AI-Llama%203.3-yellow?style=flat-square" alt="Together AI">

<img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js" alt="Next.js">
<img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License">
  <br>
  <strong>Patient Journey & Risk Analytics Platform powered by GraphRAG</strong>
</div>

A comprehensive healthcare analytics platform built for the [ArangoDB Hackathon: Building the Next-Gen Agentic App with GraphRAG & NVIDIA cuGraph](https://arangodbhackathon.devpost.com/).

[![MedGraph Navigator Demo](/public/ss_home.png)](https://medgraph-navigator.onrender.com)

## 🚀 Live Demo

Experience MedGraph Navigator live: [https://medgraph-navigator.onrender.com](https://medgraph-navigator.onrender.com)

## 🔍 Overview

MedGraph Navigator is a next-generation healthcare analytics platform that harnesses the power of graph databases and large language models (LLMs) to provide medical professionals with deep, actionable insights into patient data. Built on ArangoDB’s advanced graph capabilities and enhanced with GraphRAG (Graph-based Retrieval Augmented Generation) technology, MedGraph Navigator revolutionizes healthcare analytics by enabling:

- Natural language querying of complex medical data
- Visual exploration of patient journeys through medical systems
- Risk factor identification and analysis
- Discovery of treatment patterns and outcomes
- Comprehensive healthcare analytics dashboards

## ✨ Key Features

- **Natural Language Query Interface** - Query the medical database using everyday language
- **Patient Explorer** - Visualize and analyze individual patient journeys
- **Analytics Dashboard** - Comprehensive visualizations of healthcare metrics
- **Intent Detection** - AI-powered understanding of query intent
- **GraphRAG Implementation** - Combines graph traversal with LLM reasoning

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS, Recharts
- **Backend**: Next.js API Routes
- **Database**: ArangoDB Graph Database
- **AI/ML**: LangChain, Together AI (Llama 3.2)
- **Deployment**: Render.com

## 🏗️ System Architecture

MedGraph Navigator follows a modern, layered architecture:

```mermaid
graph TB
    User([👤 User]) --> NextApp[["⚛️ Next.js App"]]
    
    subgraph "Frontend Layer"
        NextApp --> Pages["📄 Pages"]
        NextApp --> Components["🧩 UI Components"]
    end
    
    subgraph "API Layer"
        NextApp --> APIRoutes["🔌 API Routes"]
        APIRoutes --> QueryAPI["🔍 Query API"]
        APIRoutes --> PatientAPI["👨‍⚕️ Patient API"]
        APIRoutes --> AnalyticsAPI["📊 Analytics API"]
    end
    
    subgraph "Integration Layer"
        QueryAPI --> LangChain["🦜️ LangChain"]
        LangChain --> TogetherAI["🤖 Together AI"]
        APIRoutes --> ArangoClient["📦 ArangoDB Client"]
    end
    
    subgraph "Data Layer"
        ArangoClient --> ArangoDB[("🗄️ ArangoDB")]
        ArangoDB --> MedicalData["💊 Medical Graph Data"]
    end

    classDef frontend fill:#d6e4ff,stroke:#9cb2eb,stroke-width:1px;
    classDef api fill:#ffe6cc,stroke:#d79b00,stroke-width:1px;
    classDef integration fill:#d5e8d4,stroke:#82b366,stroke-width:1px;
    classDef database fill:#e1d5e7,stroke:#9673a6,stroke-width:1px;

    class Pages,Components,NextApp frontend;
    class APIRoutes,QueryAPI,PatientAPI,AnalyticsAPI api;
    class LangChain,TogetherAI,ArangoClient integration;
    class ArangoDB,MedicalData database;
```

## 🔧 Installation & Setup

### Prerequisites

- Node.js 18+ and npm
- ArangoDB 3.10+
- Together AI API key

### Local Development

1. Clone the repository:

   ```bash
   git clone https://github.com/ajitonelsonn/medgraph-navigator.git
   cd medgraph-navigator
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your ArangoDB and Together AI credentials.

4. Prepare your ArangoDB database:

   - Follow the setup instructions in the [H_ArngoDB repository](https://github.com/ajitonelsonn/H_ArngoDB) to load the Synthea medical dataset

5. Run the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Production Deployment

For production deployment to Render.com:

1. Fork this repository
2. Create a new Web Service on Render
3. Link your GitHub repository
4. Configure environment variables
5. Deploy!

## 📊 Usage Examples

### Querying the Medical Database

MedGraph Navigator allows natural language queries against the medical database:

- "How many patients have the race 'white'?"
- "List 10 patients with their birthdates and genders"
- "What is the most common race among patients?"
- "Show me patients born in 2016"

### Analytics Dashboards

The Analytics section provides comprehensive healthcare insights:

- Demographics analysis
- Condition prevalence and trends
- Medication usage patterns
- Treatment outcomes

## 📁 Project Structure

```
medgraph-navigator/
├── app/                  # Next.js app directory
│   ├── analytics/        # Analytics dashboard
│   ├── api/              # API routes
│   ├── components/       # Shared components
│   ├── patients/         # Patient explorer
│   ├── query/            # Query interface
│   └── utils/            # Utility functions
├── public/               # Static assets
├── styles/               # Global styles
├── next.config.js        # Next.js configuration
└── package.json          # Project dependencies
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👏 Acknowledgments

- [ArangoDB](https://www.arangodb.com/) for the powerful graph database
- [NVIDIA Rapids cuGraph](https://github.com/rapidsai/cugraph) for GPU-accelerated graph analytics
- [Synthea](https://synthea.mitre.org/) for the synthetic healthcare dataset
- [Together AI](https://together.ai/) for the LLM infrastructure
- [ArangoDB Hackathon](https://arangodbhackathon.devpost.com/) for the inspiration

## 📬 Contact

For questions or feedback, please reach out via GitHub Issues or contact:

- GitHub: [@ajitonelsonn](https://github.com/ajitonelsonn)

---

Made with ❤️ in Timor-Leste 🇹🇱
