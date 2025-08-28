// filter_inactive_drivers.js
import fs from "fs/promises";

async function filterInactiveDrivers() {
  try {
    // 1. Read existing JSON
    const raw = await fs.readFile("companies_with_drivers.json", "utf-8");
    const companies = JSON.parse(raw);

    // 2. Filter out inactive drivers
    const filtered = companies.map(company => ({
      ...company,
      drivers: company.drivers.filter(driver => driver.active === true)
    }));

    // 3. Save to new file
    await fs.writeFile("companies_with_drivers_active.json", JSON.stringify(filtered, null, 2));

    console.log("Filtered inactive drivers. Saved to companies_with_drivers_active.json");
  } catch (err) {
    console.error("Error filtering drivers:", err);
  }
}

filterInactiveDrivers();
