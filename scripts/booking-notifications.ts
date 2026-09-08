import "dotenv/config";
import { processBookingNotifications } from "../src/lib/booking/notifications";
import { pool } from "../src/db";
async function main(){try{console.log(`Notificações processadas: ${await processBookingNotifications()}`);}finally{await pool.end();}}
main().catch(error=>{console.error(error);process.exitCode=1;});
