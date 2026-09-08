import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"tests/browser",workers:1,timeout:120000,expect:{timeout:15000},use:{baseURL:process.env.TEST_BASE_URL??"http://localhost:3100",headless:true,trace:"retain-on-failure",screenshot:"only-on-failure"},reporter:"list"});
