import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'indranilgamer@gmail.com',
    password: 'password123'
  });
  
  if (authErr) {
    console.error('Auth error:', authErr.message);
    return;
  }
  
  console.log('Logged in as:', authData.user.email);
  
  const { data: docs, error: docErr } = await supabase
    .from('application_documents')
    .select('*')
    .limit(1);
    
  if (docErr || !docs || docs.length === 0) {
    console.error('Doc error:', docErr);
    return;
  }
  
  const filePath = docs[0].file_path;
  console.log('Found file path:', filePath);
  
  const { data: signed, error: signErr } = await supabase
    .storage
    .from('application-docs')
    .createSignedUrl(filePath, 3600);
    
  if (signErr) {
    console.error('Sign error:', signErr.message);
  } else {
    console.log('Signed URL created:', signed.signedUrl);
  }
}

run();
