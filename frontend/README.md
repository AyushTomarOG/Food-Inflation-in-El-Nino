# Food Inflation Lab — SSR React dashboard

## Run locally
1. Start the existing FastAPI backend from `backend/`: `uvicorn main:app --reload`
2. In a second terminal: `cd frontend`
3. Install packages: `npm install`
4. Start the SSR dev server: `npm run dev`
5. Open `http://localhost:5173`

The dashboard server-renders the page with React `renderToString` and hydrates it in the browser. Charts become interactive after hydration. Evaluation cards have a local saved-results fallback if the API is asleep/unavailable.

## API URL
By default it uses `https://food-inflation-in-el-nino.onrender.com`. For local development, create `frontend/.env` with:
`VITE_API_URL=http://127.0.0.1:8000`

## Production
`npm run build` builds the client and the server-rendered entry. `npm start` serves the built application. Deploy this as a Node web service; set `VITE_API_URL` to your deployed FastAPI URL before building.

Note: the frontend is SSR, but its data-fetching currently happens after hydration. To have model results included in the initial HTML response for crawlers, server-side data fetching would need to be added to the SSR request path.
