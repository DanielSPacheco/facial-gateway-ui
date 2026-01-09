require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function inspect() {
    const { data, error } = await supabase
        .from("facials")
        .select("*")
        .limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Facials Record Keys:", data && data.length > 0 ? Object.keys(data[0]) : "No data");
        console.log("Sample Data:", data);
    }
}

inspect();
