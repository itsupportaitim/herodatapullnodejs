
export async function getCompanies(token) {
  const res = await fetch("https://backend.apexhos.com/companies", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch companies: ${res.statusText}`);
  const data = await res.json();
  return data;
}


// Фильтрация до companyId и name + удаление компаний, имя которых начинается с "zzz"
export function filterCompanies(raw) {
  if (!raw.data || !Array.isArray(raw.data)) throw new Error("Invalid companies structure");

  return raw.data
    .map(c => ({ companyId: c.companyId, name: c.name }))
    .filter(c => !c.name.toLowerCase().startsWith("zzz"));
}
