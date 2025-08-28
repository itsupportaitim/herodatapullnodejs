
export function getBasicAuthHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf-8").toString("base64")}`;
}

export async function getAuthToken(username, password) {
  if (!username || !password) throw new Error("Missing credentials");

  const res = await fetch("https://backend.apexhos.com/authentication", {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(username, password),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      company: null,
      email: username,
      password,
      rCode: "hero",
      strategy: "local",
    }),
  });

  if (!res.ok) throw new Error(`Authentication failed: ${res.statusText}`);
  const data = await res.json();
  return data.accessToken;
}
