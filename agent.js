const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Tenta carregar .env.local de múltiplos locais
const pathsToCheck = [
  '.env.local',
  path.join(process.cwd(), '.env.local'),
  path.join(__dirname, '.env.local'),
];

let loaded = false;
for (const p of pathsToCheck) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.log(`✅ Loaded env from: ${p}`);
    loaded = true;
    break;
  }
}

if (!loaded) {
  console.warn("⚠️  Aviso: .env.local não encontrado. Certifique-se de ter as variáveis de ambiente setadas.");
}

const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");

// ===== CONFIG =====
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Força porta 4000 se não especificado 
const GATEWAY_URL = process.env.GATEWAY_BASE_URL || "http://localhost:4000"; 
const POLL_INTERVAL = 3000;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ ERRO FATAL: Faltam variáveis de ambiente (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("========================================");
console.log("🤖 FACIAL AGENT STARTED (RESCUE MODE)");
console.log(`📡 Supabase: ${SUPABASE_URL.slice(0, 20)}...`);
console.log(`🔌 Gateway Alvo: ${GATEWAY_URL}`);
console.log("========================================");

async function processJob(job) {
  console.log(`\n[JOB #${job.id}] 🔄 Processando: ${job.type} (User: ${job.payload?.userID || 'N/A'})`);
  
  try {
    let endpoint = "";
    
    // Mapeamento de rotas
    switch (job.type) {
      case "create_user": endpoint = "/facial/user/create"; break;
      case "update_user": endpoint = "/facial/user/update"; break;
      case "delete_user": endpoint = "/facial/user/delete"; break;
      case "add_card":    endpoint = "/facial/card/add"; break;
      case "open_door":   endpoint = "/facial/door/open"; break;
      case "upload_face_base64": endpoint = "/facial/face/uploadBase64"; break;
      default:
        console.warn(`⚠️  Job type desconhecido ignorado: ${job.type}`);
        // Marca como falha para não travar a fila, mas com erro explicativo
        throw new Error(`Tipo de job não suportado pelo agente: ${job.type}`);
    }

    const url = `${GATEWAY_URL}${endpoint}`;
    console.log(`   👉 POST ${url}`);
    
    const response = await axios.post(url, job.payload);
    console.log(`   ✅ Sucesso!`);

    await supabase.from("jobs").update({ 
      status: "completed", 
      processed_at: new Date().toISOString(),
      result: response.data 
    }).eq("id", job.id);

  } catch (error) {
    console.error(`   ❌ FALHA: ${error.message}`);
    
    // Tenta extrair erro detalhado do backend
    const details = error.response ? JSON.stringify(error.response.data) : error.message;

    await supabase.from("jobs").update({ 
      status: "failed", 
      processed_at: new Date().toISOString(),
      error: details
    }).eq("id", job.id);
  }
}

async function loop() {
  try {
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (jobs && jobs.length > 0) {
      await processJob(jobs[0]);
    }
  } catch (e) {
    console.error("Erro no loop:", e.message);
  }
  setTimeout(loop, POLL_INTERVAL);
}

loop();
