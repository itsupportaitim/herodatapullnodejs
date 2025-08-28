// fetch_all_companies_drivers.js
import fs from "fs/promises";
import dotenv from "dotenv";

dotenv.config();

const AUTH_URL = "https://backend.apexhos.com/authentication";
const DRIVERS_URL = "https://backend.apexhos.com/drivers";

const USERNAME = process.env.HEROELD_USERNAME;
const PASSWORD = process.env.HEROELD_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error("Missing HEROELD_USERNAME or HEROELD_PASSWORD in .env");
  process.exit(1);
}

function basicAuthHeader(username, password) {
  return "Basic " + Buffer.from(`${username}:${password}`, "utf-8").toString("base64");
}

async function retry(fn, { attempts = 3, initialDelayMs = 500 } = {}) {
  let attempt = 0;
  let delay = initialDelayMs;
  while (attempt < attempts) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= attempts) throw err;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

// Authenticate for a specific companyId and return token (flexible to pick token field)
async function getCompanyToken(companyId) {
  const body = {
    company: companyId,
    email: USERNAME,
    password: PASSWORD,
    rCode: "hero",
    strategy: "local",
  };

  const res = await retry(() =>
    fetch(AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(USERNAME, PASSWORD),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    }), { attempts: 3, initialDelayMs: 700 }
  );

  if (!res.ok) {
    const text = await res.text().catch(()=>"<no body>");
    throw new Error(`Auth failed for company ${companyId}: ${res.status} ${res.statusText} - ${text}`);
  }

  const json = await res.json().catch(() => ({}));
  const token = json?.accessToken || json?.token || json?.data?.token || json?.data?.accessToken;
  if (!token) throw new Error(`No token found in auth response for company ${companyId}`);
  return token;
}

// Get drivers list for a company using company token
async function getDriversForCompany(token) {
  const res = await retry(() =>
    fetch(DRIVERS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }), { attempts: 3, initialDelayMs: 700 }
  );

  if (!res.ok) {
    const text = await res.text().catch(()=>"<no body>");
    throw new Error(`Drivers fetch failed: ${res.status} ${res.statusText} - ${text}`);
  }

  const json = await res.json().catch(() => ({}));
  // Structure may be { data: [...] } or [...]
  const arr = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
  return arr;
}


// Filter drivers to required fields (only those with updatedAt)
function filterDrivers(rawDrivers) {
  return rawDrivers
    .filter(d => d.updatedAt) // ✅ keep only drivers that have updatedAt
    .map(d => ({
      firstName: d.firstName ?? d.firstname ?? d.first_name ?? null,
      lastName:  d.lastName  ?? d.lastname  ?? d.last_name  ?? null,
      _id:       d._id ?? null,
      active:    typeof d.active === "boolean" ? d.active : !!d.active,
      updatedAt: d.updatedAt
    }));
}


async function main({
  companiesFile = "companies_filtered.json",
  outFile = "companies_with_drivers.json",
  sequential = true, // if false, you could implement concurrency
} = {}) {
  const raw = await fs.readFile(companiesFile, "utf-8");
  const companies = JSON.parse(raw);

  if (!Array.isArray(companies)) throw new Error("companies_filtered.json must be an array");

  const result = [];
  let i = 0;

  for (const company of companies) {
    i++;
    const companyId = company.companyId ?? company.id ?? company.company_id;
    const companyName = company.name ?? company.companyName ?? company.company_name;

    if (!companyId) {
      console.warn(`Skipping company without id at index ${i - 1}`);
      continue;
    }

    console.log(`[${i}/${companies.length}] Processing ${companyName} (${companyId})`);
    try {
      const token = await getCompanyToken(companyId);
      const driversRaw = await getDriversForCompany(token);
      const drivers = filterDrivers(driversRaw);

      result.push({
        companyId,
        name: companyName || null,
        drivers,
      });

      // Optionally snapshot each company as you go to avoid losing progress
      await fs.writeFile(outFile, JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`Error for company ${companyId}:`, err.message);
      // push error entry if desired:
      result.push({
        companyId,
        name: companyName || null,
        drivers: [],
        _error: err.message,
      });
      // continue loop
    }

    // polite delay between companies (adjust or remove)
    await new Promise(r => setTimeout(r, 300)); // 300ms
  }

  // final save
  await fs.writeFile(outFile, JSON.stringify(result, null, 2));
  console.log(`Done. Saved ${result.length} company entries to ${outFile}`);
}

// Run
main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
