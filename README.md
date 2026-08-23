# 🌊 FloatChat (SIH-40)

**FloatChat** is a comprehensive full-stack application built for the Smart India Hackathon (SIH) that visualizes global oceanographic data from Argo floats. It features a stunning "Deep Ocean / Cyber-Nautical" aesthetic and provides interactive maps, depth profiles, and an integrated AI chatbot for exploring marine data (temperature, salinity, pressure, etc.).

---

## ✨ Features

- **Interactive Ocean Maps:** High-performance, edge-to-edge map visualizer using Deck.GL and React Map GL for plotting Argo float locations globally.
- **Data Dashboards & Profiles:** Detailed D3.js-based depth profile charts (e.g., Temperature vs. Depth, Salinity vs. Depth).
- **AI Chatbot Assistant:** A built-in AI assistant to query oceanographic data contextually and quickly.
- **Robust Data Pipeline:** A Node.js and PostgreSQL backend capable of directly ingesting raw NetCDF (`.nc`) files from the Argo program.
- **Cyber-Nautical UI:** A meticulously crafted glassmorphic dark-mode UI that prioritizes visual excellence and readability.

---

## 🛠️ Tech Stack

### Frontend (`frontend_sid/`)
- **Framework:** React 19 + Vite (Single Page Application)
- **Styling:** Tailwind CSS + Custom Vanilla CSS variables for a deep-sea theme
- **Visualization:** Deck.GL, React Map GL, MapLibre GL, D3.js, Recharts
- **State & Routing:** React Redux, React Router v7

### Backend (`backend_sid/`)
- **Server:** Node.js + Express
- **Database:** PostgreSQL (with `pg` driver)
- **Data Processing:** `netcdfjs` for parsing complex `.nc` scientific data formats
- **Environment:** `dotenv` for configuration

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/) (running locally, default port `5432`)
- Raw Argo `.nc` files for data ingestion

---

### 1. Backend Setup

The backend handles the PostgreSQL database, NetCDF data ingestion, and API serving.

1. **Navigate to the backend directory:**
   ```bash
   cd backend_sid
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Setup Database:**
   Ensure your local PostgreSQL server is running. Create a database named `argo_data` (default config):
   ```bash
   createdb -h localhost -U postgres argo_data
   ```
   *(Update `backend_sid/database/db.js` if you have a different username/password).*
4. **Create the Table Structure:**
   ```bash
   npm run create:table
   ```
5. **Ingest Data (Optional but recommended):**
   Place your Argo `.nc` files in `backend_sid/Argo data/`, then run:
   ```bash
   npm run insert:argo
   ```
6. **Start the API Server:**
   ```bash
   node server.js
   ```
   *The server will run on port 3000.*

---

### 2. Frontend Setup

The frontend serves the visually immersive React SPA and map visualization layers.

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend_sid
   ```
2. **Install dependencies:**
   We recommend using `npm` or `pnpm`.
   ```bash
   npm install
   ```
3. **Run the Development Server:**
   ```bash
   npm run dev
   ```
4. **View the App:**
   Open the localhost URL provided by Vite in your browser to experience FloatChat.

---

## 📂 Project Structure

```text
FloatChat/
├── frontend_sid/       # React + Vite application (UI, Maps, Charts)
│   ├── src/            # Components, pages, and React logic
│   ├── public/         # Static assets
│   ├── index.html      # Main HTML entry
│   └── design.md       # Detailed UI/UX architecture and aesthetic guide
│
├── backend_sid/        # Express + Node.js API and Ingestion Pipeline
│   ├── Argo data/      # Put your NetCDF (.nc) files here
│   ├── database/       # DB connection configurations
│   ├── create_table.js # Script to initialize PostgreSQL tables
│   ├── insert_argo.js  # Script to ingest .nc data into DB
│   └── server.js       # Main Express API server
│
└── README.md           # This file
```

---

*Built with 💙 for the Smart India Hackathon.*
