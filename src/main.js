import express from "express";
import dotenv from "dotenv";

import { getAuthToken } from "./services/auth.js";
import { getCompanies, filterCompanies } from "./services/companies.js";
import { writeJSON } from "./services/file.js";

dotenv.config();
const app = express();
app.use(express.json());

app.get("/fetch-companies", async (req, res) => {
  try {
    const username = process.env.HEROELD_USERNAME;
    const password = process.env.HEROELD_PASSWORD;

    const token = await getAuthToken(username, password);
    const companiesRaw = await getCompanies(token);
    const companiesFiltered = filterCompanies(companiesRaw);

    await writeJSON("companies_filtered.json", companiesFiltered);

    return res.json({
      message: "Companies fetched, filtered, and saved",
      count: companiesFiltered.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
