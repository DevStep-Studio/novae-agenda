import mysql from "mysql2/promise";
import "dotenv/config";

async function main() {
  const pmaUrl = "https://phpmyadmin.devstep.com.br/";
  console.log("1. Connecting to phpMyAdmin...");
  const res1 = await fetch(pmaUrl);
  const text1 = await res1.text();
  const setCookies1 = res1.headers.getSetCookie ? res1.headers.getSetCookie() : [res1.headers.get("set-cookie") || ""];
  const tokenMatch = text1.match(/name="token"\s+value="([^"]+)"/);
  const token = tokenMatch ? tokenMatch[1] : "";
  const cookieHeader1 = setCookies1.map(c => c.split(";")[0]).join("; ");

  const form = new URLSearchParams();
  form.append("pma_username", "reserveiuser");
  form.append("pma_password", "lqlzgWVFeZb1VVwMxWsf");
  form.append("server", "1");
  form.append("target", "index.php");
  if (token) form.append("token", token);

  const res2 = await fetch(pmaUrl + "index.php?route=/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookieHeader1,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      "Referer": pmaUrl,
    },
    body: form.toString(),
    redirect: "manual",
  });

  const setCookies2 = res2.headers.getSetCookie ? res2.headers.getSetCookie() : [res2.headers.getSetCookie() || ""];
  const cookieMap = new Map();
  const setCookiesCombined = [...setCookies1, ...setCookies2].flat();
  for (const c of setCookiesCombined) {
    if (!c || typeof c !== "string") continue;
    const [pair] = c.split(";");
    const [k, v] = pair.split("=");
    if (k && v) cookieMap.set(k.trim(), v.trim());
  }
  const loggedInCookieHeader = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");

  const resHome = await fetch(pmaUrl + "index.php?route=/", {
    headers: {
      "Cookie": loggedInCookieHeader,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
  });
  const homeText = await resHome.text();
  const tokenMatch2 = homeText.match(/token=([a-f0-9]{32})/i) || homeText.match(/name="token"\s+value="([^"]+)"/);
  const activeToken = tokenMatch2 ? tokenMatch2[1] : token;

  async function queryPma(sql: string, dbName = "reserveiprod") {
    const sqlForm = new URLSearchParams();
    sqlForm.append("sql_query", sql);
    sqlForm.append("token", activeToken);
    sqlForm.append("ajax_request", "true");
    if (dbName) sqlForm.append("db", dbName);

    const resSql = await fetch(pmaUrl + "index.php?route=/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": loggedInCookieHeader,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: sqlForm.toString(),
    });

    const json = await resSql.json();
    return json.message || "";
  }

  console.log("2. Querying all tables in reserveiprod...");
  const tablesHtml = await queryPma("SHOW TABLES;");
  const tableMatches = tablesHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
  const tables: string[] = [];
  for (const td of tableMatches) {
    const name = td.replace(/<[^>]+>/g, "").trim();
    if (name && !name.includes(" ") && !name.includes("&") && !tables.includes(name)) {
      tables.push(name);
    }
  }
  console.log(`Found ${tables.length} tables in reserveiprod:`, tables);

  // Connect to local MySQL
  const localConn = await mysql.createConnection({
    uri: process.env.DATABASE_URL || "mysql://root:root@127.0.0.1:3309/novae_agenda",
  });
  console.log("Connected to local MySQL");

  // Disable FK checks during import
  await localConn.execute("SET FOREIGN_KEY_CHECKS = 0;");

  for (const table of tables) {
    // Check if table exists in local DB
    const [localTableCheck] = await localConn.execute(
      `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
      [table]
    );
    if ((localTableCheck as any)[0]?.cnt === 0) {
      console.log(`Skipping table ${table} (not in local schema)`);
      continue;
    }

    // Get columns of table in local DB
    const [colRows] = await localConn.execute<any[]>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position`,
      [table]
    );
    const colNames: string[] = colRows.map((r: any) => r.COLUMN_NAME || r.column_name);
    const colsSql = colNames.map(c => `\`${c}\``).join(", ");

    console.log(`Syncing table: ${table} (${colNames.length} columns)...`);
    // Query table rows from PMA
    const selectSql = `SELECT ${colsSql} FROM \`${table}\`;`;
    const rowsHtml = await queryPma(selectSql);

    // Extract table rows
    const trMatches = rowsHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    const rowsToInsert: any[][] = [];

    for (const tr of trMatches) {
      const tdMatches = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (tdMatches.length === 0) continue;

      // Filter out action columns
      const cells: string[] = [];
      for (const td of tdMatches) {
        let clean = td.replace(/<[^>]+>/g, "").trim();
        clean = clean.replace(/&quot;/g, "\"").replace(/&#039;/g, "\'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        cells.push(clean);
      }

      // Check if this row is a data row matching our columns
      // PMA rows usually have 3 action cells at start (Edit, Copy, Delete) or none
      let dataCells = cells;
      if (cells.length > colNames.length) {
        dataCells = cells.slice(cells.length - colNames.length);
      }
      if (dataCells.length === colNames.length && !dataCells[0].includes("Show all") && !dataCells[0].includes("Number of rows")) {
        // Convert 'NULL' string to null, boolean 1/0, JSON etc
        const parsed = dataCells.map((val, idx) => {
          if (val === "NULL" || val === "null" || val === "") {
            const colType = colRows[idx]?.DATA_TYPE || colRows[idx]?.data_type;
            if (val === "" && (colType?.includes("varchar") || colType?.includes("text"))) return "";
            return null;
          }
          return val;
        });
        rowsToInsert.push(parsed);
      }
    }

    if (rowsToInsert.length > 0) {
      console.log(`  -> Inserting ${rowsToInsert.length} rows into ${table}...`);
      const placeholders = colNames.map(() => "?").join(", ");
      const insertSql = `REPLACE INTO \`${table}\` (${colsSql}) VALUES (${placeholders})`;

      for (const row of rowsToInsert) {
        try {
          await localConn.execute(insertSql, row);
        } catch (err: any) {
          console.warn(`  Warning on inserting row into ${table}: ${err.message}`);
        }
      }
    } else {
      console.log(`  -> 0 rows in ${table}`);
    }
  }

  await localConn.execute("SET FOREIGN_KEY_CHECKS = 1;");
  await localConn.end();
  console.log("ALL TABLES SYNCHRONIZED SUCCESSFULLY FROM RESERVEIPROD TO LOCAL MYSQL!");
}

main().catch(console.error);
