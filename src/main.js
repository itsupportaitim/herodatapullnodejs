import express from "express";
import dotenv from "dotenv";
import fs from "fs/promises";

import { getAuthToken } from "./services/auth.js";
import { getCompanies, filterCompanies } from "./services/companies.js";
import { writeJSON } from "./services/file.js";
import { fetchAllCompaniesDrivers } from "./services/fetchAllCompaniesDrivers.js";

dotenv.config();
const app = express();
app.use(express.json());

// --- Retry Utility ---
async function retryWithAlert(fn, fnName, maxRetries = 3, delayMs = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${fnName}] Attempt ${attempt}/${maxRetries}...`);
      const result = await fn();

      if (attempt > 1) {
        console.log(`✅ [${fnName}] Succeeded on attempt ${attempt}`);
      }

      return result;
    } catch (error) {
      lastError = error;
      console.error(`❌ [${fnName}] Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        // Final attempt failed - trigger alert
        await sendAlert({
          service: fnName,
          error: error.message,
          attempts: maxRetries,
          timestamp: new Date().toISOString()
        });

        throw new Error(`${fnName} failed after ${maxRetries} attempts: ${error.message}`);
      }

      // Wait before retrying (exponential backoff)
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

// --- Alert System ---
async function sendAlert(alertData) {
  const alertMessage = `
🚨 API FAILURE ALERT 🚨
Service: ${alertData.service}
Error: ${alertData.error}
Attempts: ${alertData.attempts}
Time: ${alertData.timestamp}
`;

  console.error(alertMessage);

  // Log to file
  try {
    const alertLog = {
      ...alertData,
      alertId: Date.now(),
    };

    let existingAlerts = [];
    try {
      const data = await fs.readFile("alerts.json", "utf-8");
      existingAlerts = JSON.parse(data);
    } catch (e) {
      // File doesn't exist yet
    }

    existingAlerts.push(alertLog);
    await fs.writeFile("alerts.json", JSON.stringify(existingAlerts, null, 2));
  } catch (err) {
    console.error("Failed to log alert:", err);
  }

  // Add additional alert methods here:
  // await sendEmailAlert(alertData);
  // await sendSlackNotification(alertData);
  // await sendWebhook(alertData);
}

// --- Filter Inactive Drivers ---
async function filterInactiveDrivers(inputFile = "companies_with_drivers.json", outputFile = "companies_with_drivers_active.json") {
  const raw = await fs.readFile(inputFile, "utf-8");
  const companies = JSON.parse(raw);

  const filtered = companies.map(company => ({
    ...company,
    drivers: company.drivers.filter(driver => driver.active === true)
  }));

  await fs.writeFile(outputFile, JSON.stringify(filtered, null, 2));
  console.log(`Filtered inactive drivers. Saved to ${outputFile}`);
  return filtered;
}

// --- Main Endpoint ---
app.get("/fetch-companies", async (req, res) => {
  const startTime = Date.now();

  try {
    const username = process.env.HEROELD_USERNAME;
    const password = process.env.HEROELD_PASSWORD;

    // 1️⃣ Authenticate with retry
    const token = await retryWithAlert(
      () => getAuthToken(username, password),
      "Authentication",
      3,
      1000
    );

    // 2️⃣ Fetch companies with retry
    const companiesRaw = await retryWithAlert(
      () => getCompanies(token),
      "Fetch Companies",
      3,
      2000
    );

    // 3️⃣ Filter companies (no retry needed - local operation)
    const companiesFiltered = filterCompanies(companiesRaw);

    // 4️⃣ Save filtered companies (no retry needed - local operation)
    await writeJSON("companies_filtered.json", companiesFiltered);

    // 5️⃣ Fetch drivers for each company with retry
    await retryWithAlert(
      () => fetchAllCompaniesDrivers({
        companiesFile: "companies_filtered.json",
        outFile: "companies_with_drivers.json",
      }),
      "Fetch All Drivers",
      3,
      3000
    );

    // 6️⃣ Filter inactive drivers (no retry needed - local operation)
    const activeCompanies = await filterInactiveDrivers();

    const executionTime = Date.now() - startTime;

    return res.json({
      success: true,
      message: "Companies fetched, filtered, drivers fetched, and inactive drivers removed",
      companiesCount: companiesFiltered.length,
      activeCompaniesCount: activeCompanies.length,
      executionTimeMs: executionTime,
    });

  } catch (err) {
    console.error("❌ Request failed:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
      executionTimeMs: Date.now() - startTime,
    });
  }
});

// --- Health Check Endpoint ---
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// --- View Alerts Endpoint ---
app.get("/alerts", async (req, res) => {
  try {
    const data = await fs.readFile("alerts.json", "utf-8");
    const alerts = JSON.parse(data);
    res.json({ alerts, count: alerts.length });
  } catch (err) {
    res.json({ alerts: [], count: 0 });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running on http://localhost:${port}`));