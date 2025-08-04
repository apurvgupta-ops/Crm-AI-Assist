# CRM AI Server Documentation

## Introduction

This CRM AI server is designed to convert natural language queries into MongoDB queries, allowing you to interact with leads stored in MongoDB using a simple conversational interface powered by OpenAI.

## Project Structure
- `src/`
  - `app.js`: Main entry point for the Express server.
  - `config/`
    - `database.js`: MongoDB connection setup.
  - `database/`
    - `seed.js`: Script to seed the database with sample data.
  - `models/`
    - `Lead.js`: Mongoose model for lead data.
  - `routes/`
    - `queryRoutes.js`: API for processing natural language queries.
    - `leadRoutes.js`: CRUD API for interacting with leads.
    - `healthRoutes.js`: Health check route.
  - `services/`
    - `openaiService.js`: Service to convert natural language to MongoDB queries using OpenAI.
  - `utils/`
    - `logger.js`: Logging configuration with Winston.
    - `validation.js`: Utility functions for validation.
  - `middleware/`
    - `errorHandler.js`: Middleware for handling errors.

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/crm-ai-server.git
   cd crm-ai-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` and fill in the required fields.
   ```bash
   cp .env.example .env
   ```

## Running the Server
- Start the server in development mode:
  ```bash
  npm run dev
  ```

- Start the server in production mode:
  ```bash
  npm start
  ```

## Seeding the Database
- Seed the database with sample leads:
  ```bash
  npm run seed
  ```

## API Endpoints
- **Query Routes:**
  - `POST /api/v1/query/natural-language`: Convert natural language query to database query and execute it.
  - `POST /api/v1/query/mongodb`: Execute raw MongoDB queries.
  - `GET /api/v1/query/suggestions`: Get example queries that users can try.
  - `GET /api/v1/query/schema`: Get the lead schema information.

- **Lead Routes:**
  - `GET /api/v1/leads`: Get all leads with pagination and filtering.
  - `GET /api/v1/leads/:id`: Get a single lead by ID.
  - `POST /api/v1/leads`: Create a new lead.
  - `PUT /api/v1/leads/:id`: Update a lead.
  - `DELETE /api/v1/leads/:id`: Soft delete a lead.

## Environment Variables
- **Server Configuration**
  - `PORT`: Port number to run the server on.
  - `NODE_ENV`: Environment mode (development/production).

- **MongoDB Configuration**
  - `MONGODB_URI`: MongoDB connection URI.

- **OpenAI Configuration**
  - `OPENAI_API_KEY`: API Key for OpenAI.

## Customizing
You can customize various aspects of the server, such as the schema, validation, endpoints, and more, to suit your specific CRM needs.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing
Contributions are welcome! Please see `CONTRIBUTING.md` for more information on how you can contribute.
